'use strict';
// Offline puzzle bank generator. Run: node gen-puzzles.js
// Writes puzzles.json: [{ target, par, tier }] with par from the optimal solver.
const lz = require('./lzgolf.js');

const BANK = [
  // ---- easy: one clear trick
  'nananana nananana nananana batman',
  'abcabcabcabcabcabc',
  'hahahahahahahaha',
  'xyzxyzxyzxyzxyzxyz',
  'beep beep beep beep beep beep',
  'tick tock tick tock tick tock',
  'bla bla bla bla bla bla bla bla',
  'up down up down up down up down',
  'same same same same same same',
  'wo wo wo wo wo wo wo wo wo',
  'go go go go go go go go',
  'la la la la la la la la la la',
  // ---- medium: structure takes some finding
  'abba abba abba abba abba abba',
  'the cat sat on the mat the cat sat on the mat the cat sat',
  'peter piper picked a peck of pickled peppers peter piper picked',
  'red lorry yellow lorry red lorry yellow lorry red lorry yellow',
  'how much wood would a woodchuck chuck how much wood would a woodchuck chuck',
  'buffalo buffalo buffalo buffalo buffalo buffalo buffalo buffalo',
  'eeny meeny miny moe eeny meeny miny moe',
  'a man a plan a canal panama a man a plan a canal panama',
  'dogs bark cats meow dogs bark cats meow dogs bark cats meow',
  'one two buckle my shoe one two buckle my shoe one two buckle my shoe',
  'rain rain go away come again another day rain rain go away',
  'to be or not to be to be or not to be to be or not to be',
  'jack and jill went up the hill jack and jill went up the hill jack and jill',
  'she sells sea shells she sells sea shells she sells sea shells',
  'i scream you scream we all scream for ice cream i scream you scream we all scream',
  'mary had a little lamb little lamb little lamb mary had a little lamb',
  'twinkle twinkle little star twinkle twinkle little star',
  // ---- hard: long with scattered structure
  'the quick brown fox jumps over the lazy dog the quick brown fox jumps over the lazy dog',
  'pack my box with five dozen liquor jugs pack my box with five dozen liquor jugs',
  'it was the best of times it was the worst of times it was the best of times it was the worst of times',
  'all work and no play makes jack a dull boy all work and no play makes jack a dull boy',
  'around the rugged rocks the ragged rascals ran around the rugged rocks the ragged rascals ran',
  'how vexingly quick daft zebras jump how vexingly quick daft zebras jump',
  'the fifth boxing wizards jump quickly the fifth boxing wizards jump quickly',
  'double double toil and trouble fire burn and cauldron bubble double double toil and trouble',
  'if you can dream it you can do it if you can dream it you can do it if you can dream it',
  'watson come here i need you watson come here i need you watson come here',
  'elementary my dear watson elementary my dear watson elementary',
  'one small step for man one giant leap for mankind one small step for man',
  'float like a butterfly sting like a bee float like a butterfly sting like a bee',
  'the only thing we have to fear is fear itself the only thing we have to fear',
];

function literalCost(t) {
  let c = 0;
  for (const ch of t) c += (/[0-9{}~\\]/.test(ch) ? 2 : 1);
  return c;
}

const tiers = { easy: [0, 12], medium: [12, 27], hard: [27, 42] };
const out = [];
let idx = 0;
outer: for (const target of BANK) {
  const tier = idx < tiers.easy[1] ? 'easy' : idx < tiers.medium[1] ? 'medium' : 'hard';
  idx++;
  if (/[{}~\\]/.test(target)) throw new Error('reserved char in target: ' + target);
  if (out.filter(p => p.tier === tier).length >= (tier === 'easy' ? 12 : tier === 'medium' ? 15 : 15)) continue outer;
  const t0 = Date.now();
  const s = lz.solve(target);
  const ms = Date.now() - t0;
  if (lz.decode(s.program) !== target) throw new Error('solve mismatch: ' + target);
  const lit = literalCost(target);
  const saving = 1 - s.cost / lit;
  if (saving < 0.15) {
    console.log(`SKIP   boring (saving ${(saving * 100) | 0}%): ${target.slice(0, 60)}`);
    continue;
  }
  out.push({ target, par: s.cost, tier, solution: s.program });
  console.log(`${tier.padEnd(6)} len ${String(target.length).padStart(3)} par ${String(s.cost).padStart(3)} (${(saving * 100) | 0}% saved, ${ms}ms)  ${target.slice(0, 50)}`);
}
require('fs').writeFileSync('puzzles.json', JSON.stringify({ version: 1, puzzles: out }, null, 2) + '\n');
console.log('wrote', out.length, 'puzzles');
