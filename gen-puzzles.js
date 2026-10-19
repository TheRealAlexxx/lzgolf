'use strict';
// Offline puzzle bank generator. Run: node gen-puzzles.js
// Writes puzzles.json: [{ target, par, tier }] with par from the optimal solver.
const lz = require('./lzgolf.js');

const BANK = {
  easy: [
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
    'moo moo moo moo moo moo moo moo',
    'do re mi do re mi do re mi',
    'left right left right left right',
    'ding dong ding dong ding dong',
    'no no no no no no no no no',
    'hey hey hey hey hey hey hey hey',
    'zip zap zip zap zip zap zip zap',
    'hop skip jump hop skip jump hop skip jump',
    'black white black white black white',
    'sun moon sun moon sun moon sun',
    'echo echo echo echo echo echo',
    'wibble wobble wibble wobble wibble wobble',
    'round and round and round and round we go',
  ],
  medium: [
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
    'happy birthday to you happy birthday to you happy birthday',
    'london bridge is falling down falling down falling down london bridge',
    'mirror mirror on the wall who is the fairest mirror mirror on the wall',
    'an apple a day keeps the doctor away an apple a day keeps the doctor',
    'practice makes perfect practice makes perfect practice makes',
    'what goes around comes around what goes around comes around',
    'easy come easy go easy come easy go easy come',
    'first come first served first come first served first come',
    'no pain no gain no pain no gain no pain no gain',
    'been there done that been there done that been there',
    'the end of the beginning of the end of the beginning',
    'never gonna give you up never gonna let you down never gonna',
    'we will we will rock you we will we will rock you',
    'row row row your boat row row row your boat row row',
    'the wheels on the bus go round and round round and round round and round',
    'supercalifragilisticexpialidocious supercalifragilisticexpialidocious',
    'good night sleep tight good night sleep tight good night',
  ],
  hard: [
    'mary had a little lamb little lamb little lamb mary had a little lamb',
    'twinkle twinkle little star twinkle twinkle little star',
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
    'a long time ago in a galaxy far far away a long time ago in a galaxy far far away',
    'may the force be with you may the force be with you may the force be with you',
    'the cake is a lie the cake is a lie the cake is a lie the cake is a lie',
    'winter is coming winter is coming winter is coming winter is coming',
    'to infinity and beyond to infinity and beyond to infinity and beyond',
    'i think therefore i am i think therefore i am i think therefore i am',
    'veni vidi vici veni vidi vici veni vidi vici veni vidi vici',
    'carpe diem seize the day carpe diem seize the day carpe diem',
    'the night is dark and full of terrors the night is dark and full of terrors',
    'knowledge is power knowledge is power knowledge is power knowledge',
    'actions speak louder than words actions speak louder than words actions',
    'better late than never better late than never better late than never',
    'fortune favors the bold fortune favors the bold fortune favors the bold',
    'history repeats itself history repeats itself history repeats itself',
    'be yourself everyone else is already taken be yourself everyone else is already',
    'the best time to plant a tree was twenty years ago the second best time is now the best time',
    'do not go gentle into that good night rage rage against the dying of the light',
    'water water everywhere nor any drop to drink water water everywhere nor any drop',
    'i wandered lonely as a cloud that floats on high i wandered lonely as a cloud',
    'two roads diverged in a wood and i took the one less traveled by two roads diverged',
  ],
};

function literalCost(t) {
  let c = 0;
  for (const ch of t) c += (/[0-9{}~\\]/.test(ch) ? 2 : 1);
  return c;
}

const CAPS = { easy: 18, medium: 26, hard: 30 };
const out = [];
for (const tier of ['easy', 'medium', 'hard']) {
  let kept = 0;
  for (const target of BANK[tier]) {
    if (kept >= CAPS[tier]) break;
    if (/[{}~\\]/.test(target)) throw new Error('reserved char in target: ' + target);
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
    kept++;
    out.push({ target, par: s.cost, tier, solution: s.program });
    console.log(`${tier.padEnd(6)} len ${String(target.length).padStart(3)} par ${String(s.cost).padStart(3)} (${(saving * 100) | 0}% saved, ${ms}ms)  ${target.slice(0, 50)}`);
  }
}
require('fs').writeFileSync('puzzles.json', JSON.stringify({ version: 1, puzzles: out }, null, 2) + '\n');
console.log('wrote', out.length, 'puzzles');
