/* global LZGOLF */
'use strict';

const $ = (id) => document.getElementById(id);

const state = {
  mode: 'daily',            // 'daily' | 'practice'
  puzzle: null,             // { target, par, tier, solution }
  done: false,
};

function todayUtcMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function stats() {
  try { return JSON.parse(localStorage.getItem('lzgolf-stats')) || {}; }
  catch { return {}; }
}
function saveStats(s) { localStorage.setItem('lzgolf-stats', JSON.stringify(s)); }

function loadBank() {
  return fetch('puzzles.json').then((r) => r.json()).then((d) => d.puzzles);
}

function pickDaily(bank) {
  const idx = LZGOLF.dailyIndex(todayUtcMs(), bank.length);
  return bank[idx];
}

function pickPractice(bank) {
  const seed = (Math.random() * 0xffffffff) >>> 0;
  const rng = LZGOLF.mulberry32(seed);
  return bank[Math.floor(rng() * bank.length)];
}

function render() {
  const p = state.puzzle;
  $('target').textContent = p.target;
  $('tier').textContent = state.mode === 'daily' ? ` (${p.tier})` : ' (practice)';
  const day = new Date(todayUtcMs()).toISOString().slice(0, 10);
  $('date-line').textContent = state.mode === 'daily' ? `daily puzzle - ${day}` : 'practice round';
  $('program').value = '';
  $('verdict').textContent = '';
  $('verdict').className = '';
  $('share-row').classList.add('hidden');
  state.done = false;
  updatePreview();
}

function updatePreview() {
  const program = $('program').value;
  const target = state.puzzle.target;
  const par = state.puzzle.par;
  $('counter').textContent = program ? `${program.length} chars (par ${par})` : `par ${par}`;
  $('counter').className = program.length && program.length < par ? 'beat' : '';
  const preview = $('preview');
  preview.textContent = '';
  if (!program) { preview.textContent = 'your decoded output appears here'; return; }
  let decoded;
  try {
    decoded = LZGOLF.decode(program);
  } catch (e) {
    const span = document.createElement('span');
    span.className = 'bad';
    span.textContent = e.message;
    preview.appendChild(span);
    return;
  }
  const max = Math.max(decoded.length, target.length);
  for (let i = 0; i < max; i++) {
    const span = document.createElement('span');
    if (i >= decoded.length) { span.className = 'bad'; span.textContent = '·'; }
    else if (i >= target.length) { span.className = 'extra'; span.textContent = decoded[i]; }
    else if (decoded[i] === target[i]) { span.className = 'ok'; span.textContent = decoded[i]; }
    else { span.className = 'bad'; span.textContent = decoded[i]; }
    preview.appendChild(span);
  }
}

function submit() {
  if (state.done) return;
  const program = $('program').value;
  const target = state.puzzle.target;
  const par = state.puzzle.par;
  let decoded;
  try {
    decoded = LZGOLF.decode(program);
  } catch (e) {
    $('verdict').textContent = 'invalid program: ' + e.message;
    $('verdict').className = 'lose';
    return;
  }
  if (decoded !== target) {
    $('verdict').textContent = 'decodes to the wrong string. keep going.';
    $('verdict').className = 'lose';
    return;
  }
  state.done = true;
  const delta = program.length - par;
  let line;
  if (delta < 0) line = `impossible: ${program.length} beats par ${par}. you broke the solver - file an issue.`;
  else if (delta === 0) line = `perfect round: ${program.length}, exactly par ${par}.`;
  else line = `solved in ${program.length}, ${delta} over par ${par}.`;
  $('verdict').textContent = line;
  $('verdict').className = 'win';

  if (state.mode === 'daily') {
    const s = stats();
    const today = new Date(todayUtcMs()).toISOString().slice(0, 10);
    if (s.lastDay !== today) {
      const yesterday = new Date(todayUtcMs() - 86400000).toISOString().slice(0, 10);
      s.streak = s.lastDay === yesterday ? (s.streak || 0) + 1 : 1;
      s.played = (s.played || 0) + 1;
      s.best = s.best === undefined ? delta : Math.min(s.best, delta);
      s.lastDay = today;
      saveStats(s);
    }
    $('share-row').classList.remove('hidden');
  }
}

function share() {
  const par = state.puzzle.par;
  const len = $('program').value.length;
  const day = new Date(todayUtcMs()).toISOString().slice(0, 10);
  const text = `lzgolf ${day} - ${len} chars (par ${par})${len <= par ? ' ⛳' : ''}`;
  navigator.clipboard.writeText(text).then(() => {
    $('share').textContent = 'copied';
    setTimeout(() => { $('share').textContent = 'copy share text'; }, 1500);
  });
}

function renderStats() {
  const s = stats();
  $('stats').textContent = s.played
    ? `daily rounds played: ${s.played} - current streak: ${s.streak || 0} - best delta: ${s.best >= 0 ? '+' + s.best : s.best}`
    : 'no daily rounds yet.';
}

window.addEventListener('DOMContentLoaded', () => {
  loadBank().then((bank) => {
    state.puzzle = pickDaily(bank);
    render();
    $('program').addEventListener('input', updatePreview);
    $('submit').addEventListener('click', submit);
    $('program').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    $('practice').addEventListener('click', () => {
      state.mode = state.mode === 'daily' ? 'practice' : 'daily';
      state.puzzle = state.mode === 'daily' ? pickDaily(bank) : pickPractice(bank);
      $('practice').textContent = state.mode === 'daily' ? 'practice' : 'back to daily';
      render();
    });
    $('how').addEventListener('click', () => {
      $('howto').classList.toggle('hidden');
      renderStats();
    });
    $('share').addEventListener('click', share);
  }).catch((e) => {
    $('verdict').textContent = 'failed to load puzzles: ' + e.message;
    $('verdict').className = 'lose';
  });
});
