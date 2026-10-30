'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - light blue
  '#ffb74d', // L - orange
  '#a1887f', // N - nut (bronze)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N (nut)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

const themeToggle = document.getElementById('theme-toggle');
const THEME_KEY = 'tetris-theme';
const themeColors = { grid: '', highlight: '' };

function readThemeColors() {
  const style = getComputedStyle(document.documentElement);
  themeColors.grid = style.getPropertyValue('--grid').trim();
  themeColors.highlight = style.getPropertyValue('--block-highlight').trim();
}

function applyTheme(theme) {
  const isLight = theme === 'light';
  if (isLight) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  themeToggle.setAttribute('aria-pressed', String(isLight));
  themeToggle.setAttribute('aria-label', isLight ? 'Modo oscuro' : 'Modo claro');
  readThemeColors();
  // el loop está detenido en pausa/game over: redibujar a mano
  if (current && next) { draw(); drawNext(); }
}

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  trackCombo(cleared);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = themeColors.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = themeColors.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  onGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (!gameOver) animId = requestAnimationFrame(loop);
}

function init() {
  commitPendingRecord();
  gameoverRecords.classList.add('hidden');
  combo = 0;
  maxCombo = 0;
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === nameInput || !started) return; // escribir nombre / pantalla de inicio
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ---- Records locales ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const startOverlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');
const gameoverRecords = document.getElementById('gameover-records');
const recordsNotice = document.getElementById('records-notice');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
let started = false;
let combo = 0, maxCombo = 0;
let pendingRecord = null; // puntuación que entra al top y espera nombre

function trackCombo(cleared) {
  if (cleared) { combo++; if (combo > maxCombo) maxCombo = combo; }
  else combo = 0;
}

function toCount(v) {
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

function loadRecords() {
  const data = { top: [], maxLines: 0, maxCombo: 0 };
  try {
    const p = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (p && typeof p === 'object') {
      if (Array.isArray(p.top)) {
        data.top = p.top
          .filter(r => r && typeof r === 'object')
          .map(r => ({
            name: String(r.name ?? '').slice(0, 12) || 'Anónimo',
            score: toCount(r.score), lines: toCount(r.lines), combo: toCount(r.combo),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, MAX_RECORDS);
      }
      data.maxLines = toCount(p.maxLines);
      data.maxCombo = toCount(p.maxCombo);
    }
  } catch (_) { /* sin datos o corruptos */ }
  for (const r of data.top) {
    data.maxLines = Math.max(data.maxLines, r.lines);
    data.maxCombo = Math.max(data.maxCombo, r.combo);
  }
  return data;
}

function saveRecords(data) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(data)); } catch (_) { /* almacenamiento no disponible */ }
}

function renderRecords(highlight = -1) {
  const data = loadRecords();
  for (const list of document.querySelectorAll('.records-list')) {
    list.replaceChildren();
    if (!data.top.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'Sin records todavía';
      list.appendChild(li);
    }
    data.top.forEach((r, i) => {
      const li = document.createElement('li');
      if (i === highlight) li.className = 'highlight';
      const cells = [
        ['rec-pos', `${i + 1}.`],
        ['rec-name', r.name],
        ['rec-score', r.score.toLocaleString()],
        ['rec-extra', `${r.lines}L x${r.combo}`],
      ];
      for (const [cls, text] of cells) {
        const span = document.createElement('span');
        span.className = cls;
        span.textContent = text;
        li.appendChild(span);
      }
      list.appendChild(li);
    });
  }
  for (const el of document.querySelectorAll('.records-stats')) {
    el.textContent = `Mejor combo: ${data.maxCombo} · Máx. líneas: ${data.maxLines}`;
  }
}

function onGameOverRecords() {
  const data = loadRecords();
  data.maxLines = Math.max(data.maxLines, lines);
  data.maxCombo = Math.max(data.maxCombo, maxCombo);
  saveRecords(data);
  const qualifies = score > 0 && (data.top.length < MAX_RECORDS || score > data.top[data.top.length - 1].score);
  pendingRecord = qualifies ? { score, lines, combo: maxCombo } : null;
  recordsNotice.textContent = '¡Nuevo récord! Entras al top 5';
  recordsNotice.classList.toggle('hidden', !qualifies);
  nameForm.classList.toggle('hidden', !qualifies);
  gameoverRecords.classList.remove('hidden');
  renderRecords();
  if (qualifies) { nameInput.value = ''; nameInput.focus(); }
}

// guarda el récord pendiente; devuelve su posición en el top (o -1)
function commitPendingRecord() {
  if (!pendingRecord) return -1;
  const data = loadRecords();
  const rec = { name: nameInput.value.trim().slice(0, 12) || 'Anónimo', ...pendingRecord };
  pendingRecord = null;
  let idx = data.top.findIndex(r => r.score < rec.score);
  if (idx === -1) idx = data.top.length;
  data.top.splice(idx, 0, rec);
  data.top.length = Math.min(data.top.length, MAX_RECORDS);
  saveRecords(data);
  nameForm.classList.add('hidden');
  return idx < MAX_RECORDS ? idx : -1;
}

nameForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!pendingRecord) return;
  const idx = commitPendingRecord();
  recordsNotice.classList.toggle('hidden', idx < 0);
  renderRecords(idx);
  nameInput.blur();
});

for (const btn of document.querySelectorAll('.reset-records')) {
  btn.addEventListener('click', () => {
    if (confirm('¿Borrar todos los records?')) {
      pendingRecord = null;
      nameForm.classList.add('hidden');
      recordsNotice.classList.add('hidden');
      try { localStorage.removeItem(RECORDS_KEY); } catch (_) { /* almacenamiento no disponible */ }
      renderRecords();
    }
    btn.blur();
  });
}

startBtn.addEventListener('click', () => {
  started = true;
  startOverlay.classList.add('hidden');
  startBtn.blur();
  init();
});

themeToggle.addEventListener('click', () => {
  const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(theme);
  try { localStorage.setItem(THEME_KEY, theme); } catch (_) { /* almacenamiento no disponible */ }
  themeToggle.blur(); // evita que Space/flechas reactiven el botón
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'; } catch (_) {}
applyTheme(savedTheme);

// pantalla de inicio: el juego no corre hasta pulsar Jugar
renderRecords();
init();
cancelAnimationFrame(animId);
draw();
