/* lzgolf - a daily byte-golf puzzle.
 *
 * The lzgolf language (v1). A program decodes left to right:
 *   literal    any character except { } ~               cost 1 per char
 *   repeat     N{program}   N copies of the inner decode cost digits(N) + 2 + inner
 *   backref    ~D,L~        copy L chars, each taken from D back cost 3 + digits(D) + digits(L)
 *                           (the trailing ~ ends the token, so a repeat can follow)
 *
 * Inside a repeat block the inner program decodes with a fresh output
 * buffer, so a backref inside {} can only reach within that block.
 * A program's score is simply its length in characters.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LZGOLF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RESERVED = ['{', '}', '~'];

  function isDigit(ch) { return ch >= '0' && ch <= '9'; }

  function needsEscape(ch) {
    return isDigit(ch) || ch === '{' || ch === '}' || ch === '~' || ch === '\\';
  }

  function digits(n) { return String(n).length; }

  // Decode a program string. Throws Error on any invalid program.
  function decode(program) {
    if (typeof program !== 'string' || program.length === 0) {
      throw new Error('empty program');
    }
    return decodeSeq(program, 0, program.length);
  }

  // Decode program[start..end). Backrefs see only this call's output.
  function decodeSeq(program, start, end) {
    var out = '';
    var i = start;
    while (i < end) {
      var ch = program[i];
      if (ch === '\\') {
        if (i + 1 >= end) throw new Error('dangling escape at ' + i);
        out += program[i + 1];
        i += 2;
      } else if (isDigit(ch)) {
        var j = i;
        while (j < end && isDigit(program[j])) j++;
        var n = parseInt(program.slice(i, j), 10);
        if (n < 1 || n > 999) throw new Error('repeat count out of range at ' + i);
        if (program[j] !== '{') throw new Error('digit not followed by { at ' + i + ' (escape literal digits with \\)');
        var close = matchBrace(program, j, end);
        var unit = decodeSeq(program, j + 1, close);
        if (unit.length === 0) throw new Error('empty repeat block at ' + i);
        for (var k = 0; k < n; k++) out += unit;
        i = close + 1;
      } else if (ch === '~') {
        var m = /^~(\d+),(\d+)~/.exec(program.slice(i, end));
        if (!m) throw new Error('malformed backref at ' + i + ' (expected ~D,L~)');
        var dist = parseInt(m[1], 10), len = parseInt(m[2], 10);
        if (dist < 1) throw new Error('backref distance must be >= 1 at ' + i);
        if (len < 1) throw new Error('backref length must be >= 1 at ' + i);
        if (dist > out.length) throw new Error('backref out of range at ' + i);
        for (var t = 0; t < len; t++) out += out[out.length - dist];
        i += m[0].length;
      } else if (ch === '{' || ch === '}') {
        throw new Error('stray ' + ch + ' at ' + i + ' (escape with \\)');
      } else {
        out += ch;
        i++;
      }
    }
    return out;
  }

  // Index of the '}' matching the '{' at openIdx (nesting-aware).
  function matchBrace(program, openIdx, end) {
    var depth = 0;
    for (var i = openIdx; i < end; i++) {
      if (program[i] === '{') depth++;
      else if (program[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    throw new Error('unclosed { at ' + openIdx);
  }

  // Cost of a program is its length. Validation doubles as the check.
  function score(program) {
    decode(program);
    return program.length;
  }

  /* Optimal solver.
   *
   * solve(target) returns { cost, program } minimising length over every
   * valid program that decodes to target. Left-to-right programs decompose
   * cleanly: the last token is a literal, a backref, or a repeat block, so a
   * prefix DP with memoised substring costs is exact (verified against an
   * exhaustive enumerator in test.js).
   */
  function solve(target) {
    if (!target || target.length === 0) throw new Error('empty target');
    var n = target.length;
    var memo = {};

    function solveSlice(a, b) {
      var key = a + ':' + b;
      if (memo[key]) return memo[key];
      var len = b - a;
      var best = new Array(len + 1).fill(Infinity);
      var choice = new Array(len + 1).fill(null);
      best[0] = 0;
      for (var i = 1; i <= len; i++) {
        // literal (digits and reserved chars cost 2: they need an escape)
        var ch2 = target[a + i - 1];
        var lcost = needsEscape(ch2) ? 2 : 1;
        if (best[i - 1] + lcost < best[i]) {
          best[i] = best[i - 1] + lcost;
          choice[i] = { from: i - 1, text: needsEscape(ch2) ? '\\' + ch2 : ch2 };
        }
        // backref ~D,L covering [i-L, i), distance D back inside this slice
        for (var L = 1; L <= i; L++) {
          for (var D = 1; D <= i - L; D++) {
            var ok = true;
            for (var t2 = 0; t2 < L; t2++) {
              if (target[a + i - L + t2] !== target[a + i - L - D + t2]) { ok = false; break; }
            }
            if (!ok) continue;
            var cost = best[i - L] + 3 + digits(D) + digits(L);
            if (cost < best[i]) {
              best[i] = cost;
              choice[i] = { from: i - L, text: '~' + D + ',' + L + '~' };
            }
          }
        }
        // repeat N{unit} covering [i - N*u, i), N >= 2
        for (var u = 1; u * 2 <= i; u++) {
          for (var N = 2; N * u <= i; N++) {
            var start = i - N * u;
            var unitStr = target.slice(a + start, a + start + u);
            var okR = true;
            for (var rep = 1; rep < N; rep++) {
              if (target.slice(a + start + rep * u, a + start + (rep + 1) * u) !== unitStr) { okR = false; break; }
            }
            if (!okR) continue;
            var sub = solveSlice(a + start, a + start + u);
            var rcost = best[start] + digits(N) + 2 + sub.cost;
            if (rcost < best[i]) {
              best[i] = rcost;
              choice[i] = { from: start, text: N + '{' + sub.program + '}' };
            }
          }
        }
      }
      var program = '';
      for (var p = len; p > 0; p = choice[p].from) program = choice[p].text + program;
      var result = { cost: best[len], program: program };
      memo[key] = result;
      return result;
    }

    return solveSlice(0, n);
  }

  // mulberry32 - tiny deterministic PRNG for daily/practice seeds.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var EPOCH = Date.UTC(2026, 9, 19); // day 0 = 2026-10-19

  // Which bank puzzle a UTC date gets. Deterministic, no backend needed.
  function dailyIndex(dateUtcMs, bankSize) {
    var day = Math.floor((dateUtcMs - EPOCH) / 86400000);
    var rng = mulberry32(day * 2654435761 >>> 0);
    return Math.floor(rng() * bankSize);
  }

  return {
    decode: decode,
    score: score,
    solve: solve,
    mulberry32: mulberry32,
    dailyIndex: dailyIndex,
    EPOCH: EPOCH,
    RESERVED: RESERVED,
  };
});
