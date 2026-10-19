'use strict';
const test = require('node:test');
const assert = require('node:assert');
const lz = require('./lzgolf.js');

// ---- decoder ---------------------------------------------------------------

test('decode literals', () => {
  assert.strictEqual(lz.decode('hello'), 'hello');
});

test('decode repeat', () => {
  assert.strictEqual(lz.decode('3{ab}'), 'ababab');
  assert.strictEqual(lz.decode('10{x}'), 'xxxxxxxxxx');
});

test('decode nested repeat', () => {
  assert.strictEqual(lz.decode('2{3{ab}c}'), 'abababcabababc');
});

test('decode backref, overlapping copies use the growing buffer', () => {
  assert.strictEqual(lz.decode('ab~2,4~'), 'ababab');  // distance 2: a b a b
  assert.strictEqual(lz.decode('ab~1,3~'), 'abbbb');   // distance 1: always last char
  assert.strictEqual(lz.decode('abcd~4,2~'), 'abcdab');
});

test('backref inside a repeat block is confined to the block', () => {
  assert.strictEqual(lz.decode('zq2{xy~2,2~}'), 'zqxyxyxyxy');
});

test('invalid programs are rejected', () => {
  assert.throws(() => lz.decode(''));
  assert.throws(() => lz.decode('2{ab'), /unclosed/);
  assert.throws(() => lz.decode('a}b'), /stray/);
  assert.throws(() => lz.decode('a~3,1~'), /out of range/);
  assert.throws(() => lz.decode('a~0,1~'), /distance/);
  assert.throws(() => lz.decode('~1,0~'), /length/);
  assert.throws(() => lz.decode('2x'), /not followed/);
  assert.throws(() => lz.decode('a~x'), /malformed/);
  assert.throws(() => lz.decode('a~2,'), /malformed/);
});

function literalCost(t) {
  let c = 0;
  for (const ch of t) c += (/[0-9{}~\\]/.test(ch) ? 2 : 1);
  return c;
}

// ---- solver ----------------------------------------------------------------

test('solver finds known optima', () => {
  assert.strictEqual(lz.solve('abababab').cost, 5);        // 4{ab}
  assert.strictEqual(lz.solve('aaaaaaaa').cost, 4);        // 8{a}
  assert.strictEqual(lz.solve('abcabcabc').cost, 6);       // 3{abc}
  assert.strictEqual(lz.solve('abcdabcd').cost, 7);        // 2{abcd} beats abcd~4,4 (9)
  assert.strictEqual(lz.solve('aaaaaaaaaaaa').cost, 5);    // 12{a}
});

test('solver uses a backref when it wins', () => {
  // u + 'ab' + u with incompressible u: ~20,18~ (7) beats retyping u (18)
  const u = 'qkwvzmxpjfgybhqznt';
  const t = u + 'ab' + u;
  const s = lz.solve(t);
  assert.strictEqual(s.cost, 27);
  assert.ok(s.program.includes('~'), s.program);
  assert.strictEqual(lz.decode(s.program), t);
});

test('solver escapes literal digits and reserved chars', () => {
  const t = '111222111222';
  const s = lz.solve(t);
  assert.strictEqual(lz.decode(s.program), t);
  assert.ok(s.cost < 24, `expected escape-aware cost < 24, got ${s.cost}`);
});

test('solver program always decodes to the target', () => {
  const targets = [
    'mississippi', 'abbaabbaabba', 'the quick brown fox jumps over the lazy dog',
    'zzzzzzzzzzzzzzzz', 'abababababab', 'aabaabaabaab', 'xyxyxyx',
    'banana', 'hello world hello world', '111222111222', 'qwerty',
  ];
  for (const t of targets) {
    const s = lz.solve(t);
    assert.strictEqual(lz.decode(s.program), t, `program ${s.program} for ${t}`);
    assert.ok(s.cost <= literalCost(t), `${t}: ${s.cost} <= ${literalCost(t)}`);
  }
});

// ---- exhaustive cross-check ------------------------------------------------

// Independent enumerator: try every composition of the target into segments,
// every token assignment per segment, take the minimum. Exponential but
// structurally different from the solver's prefix DP, so agreement is a real
// cross-check. Only feasible for short targets.
function exhaustive(target) {
  const n = target.length;
  const memoString = {};
  function optString(s) {  // optimal cost for a self-contained block of text
    if (s in memoString) return memoString[s];
    memoString[s] = s.length; // all-literal floor
    // repeat factorisations of s itself
    for (let u = 1; u * 2 <= s.length; u++) {
      if (s.length % u !== 0) continue;
      const unit = s.slice(0, u);
      let ok = true;
      for (let k = 1; k < s.length / u; k++) {
        if (s.slice(k * u, (k + 1) * u) !== unit) { ok = false; break; }
      }
      if (ok) {
        const cost = String(s.length / u).length + 2 + optString(unit);
        if (cost < memoString[s]) memoString[s] = cost;
      }
    }
    return memoString[s];
  }
  let best = Infinity;
  function walk(pos, cost) {
    if (cost >= best) return;
    if (pos === n) { best = cost; return; }
    for (let end = pos + 1; end <= n; end++) {
      const seg = target.slice(pos, end);
      let litCost = 0;                                  // literal run (escape-aware)
      for (const c of seg) litCost += (/[0-9{}~\\]/.test(c) ? 2 : 1);
      walk(end, cost + litCost);
      // backref: single token ~D,L with L = segment length
      const L = end - pos;
      for (let D = 1; D <= pos; D++) {
        let ok = true;
        for (let t = 0; t < L; t++) {
          if (target[pos + t] !== target[pos - D + t]) { ok = false; break; }
        }
        if (ok) walk(end, cost + 3 + String(D).length + String(L).length);
      }
      // repeat token covering this segment exactly
      for (let u = 1; u * 2 <= L; u++) {
        if (L % u !== 0) continue;
        const unit = target.slice(pos, pos + u);
        let ok = true;
        for (let k = 1; k < L / u; k++) {
          if (target.slice(pos + k * u, pos + (k + 1) * u) !== unit) { ok = false; break; }
        }
        if (ok) {
          const N = L / u;
          walk(end, cost + String(N).length + 2 + optString(unit));
        }
      }
    }
  }
  walk(0, 0);
  return best;
}

test('solver matches the exhaustive enumerator on short strings', () => {
  // systematic small alphabet strings
  const alphabet = 'ab';
  const targets = [];
  for (let n = 1; n <= 8; n++) {
    for (let mask = 0; mask < (1 << n); mask++) {
      let s = '';
      for (let b = 0; b < n; b++) s += alphabet[(mask >> b) & 1];
      targets.push(s);
    }
  }
  // plus a few structured longer ones still inside enumerator range
  targets.push('abcabcabc', 'aaaaaaaaaaaa', 'abababababab', 'mississippi');
  for (const t of targets) {
    const dp = lz.solve(t).cost;
    const ex = exhaustive(t);
    assert.strictEqual(dp, ex, `target ${t}: dp=${dp} exhaustive=${ex}`);
  }
});

// ---- fuzz round-trip -------------------------------------------------------

test('fuzz: solve output round-trips and beats naive', () => {
  const rng = lz.mulberry32(12345);
  const motifs = ['ab', 'abc', 'x', 'the ', 'na', '01', 'qz', '7'];
  for (let iter = 0; iter < 200; iter++) {
    let t = '';
    const parts = 2 + Math.floor(rng() * 4);
    for (let p = 0; p < parts; p++) {
      const m = motifs[Math.floor(rng() * motifs.length)];
      const reps = 1 + Math.floor(rng() * 6);
      for (let r = 0; r < reps; r++) t += m;
    }
    const s = lz.solve(t);
    assert.strictEqual(lz.decode(s.program), t, `fuzz target ${t}`);
    assert.ok(s.cost <= literalCost(t), `fuzz ${t}: ${s.cost} <= ${literalCost(t)}`);
  }
});

// ---- determinism -----------------------------------------------------------

test('mulberry32 known vector', () => {
  const rng = lz.mulberry32(42);
  const vals = [rng(), rng(), rng()];
  assert.deepStrictEqual(vals, [0.6011037519201636, 0.44829055899754167, 0.8524657934904099]);
});

test('dailyIndex is deterministic and in range', () => {
  for (const day of [0, 1, 100, 10000]) {
    const a = lz.dailyIndex(lz.EPOCH + day * 86400000, 40);
    const b = lz.dailyIndex(lz.EPOCH + day * 86400000, 40);
    assert.strictEqual(a, b);
    assert.ok(a >= 0 && a < 40);
  }
});

// ---- puzzle bank -----------------------------------------------------------

test('puzzle bank integrity', () => {
  const bank = require('./puzzles.json').puzzles;
  assert.ok(bank.length >= 40, `bank has ${bank.length} puzzles`);
  for (const p of bank) {
    assert.ok(/^[\x20-\x7E]+$/.test(p.target), `ascii only: ${p.target}`);
    assert.ok(!/[{}~\\]/.test(p.target), `no reserved chars: ${p.target}`);
    const s = lz.solve(p.target);
    assert.strictEqual(p.par, s.cost, `par is optimal for ${p.target.slice(0, 30)}`);
    assert.strictEqual(lz.decode(p.solution), p.target, `solution decodes: ${p.target.slice(0, 30)}`);
    assert.strictEqual(p.solution.length, p.par);
    const lit = [...p.target].reduce((c, ch) => c + (/[0-9{}~\\]/.test(ch) ? 2 : 1), 0);
    assert.ok(p.par <= lit * 0.85, `worth playing: ${p.target.slice(0, 30)}`);
  }
});
