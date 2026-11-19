// Neon Vice Cover Studio — wires the editor: photo slots, layout/grade/size
// pickers, caption fields, per-panel crop (drag, wheel, sliders) and PNG export.
// A `?shot=` query hands the page to ./shots.js, which sets up a fixed scene
// for a screenshot instead of the interactive editor.
import { drawCover, layoutPanels, clampCrop, SIZES, LAYOUTS, GRADES } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('preview');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('title');
const subtitleEl = document.getElementById('subtitle');

// Panel area fractions — kept in step with cover.js (SKY_H 0.16, CAPTION_H 0.2).
const PANEL_TOP = 0.16;
const PANEL_HEIGHT = 0.64;

const SAMPLES = ['boulevard', 'neon', 'pier'];

const state = {
  photos: [null, null, null],
  crops: [{ x: 0, y: 0, scale: 1 }, { x: 0, y: 0, scale: 1 }, { x: 0, y: 0, scale: 1 }],
  layout: 'grid',
  grade: 'sunset',
  size: 'square',
  title: titleEl.value,
  subtitle: subtitleEl.value,
  fillAll: -1,
  selectedPanel: 0,
};

let fontReady = false;

async function ensureFont() {
  if (fontReady) return;
  try {
    await document.fonts.load('100px "Archivo Black"');
    await document.fonts.ready;
  } catch { /* fall back to sans-serif lettering */ }
  fontReady = true;
}

function redraw() {
  drawCover(canvas, state);
  syncCropControls();
}

function applySize() {
  const s = SIZES[state.size];
  canvas.width = s.w;
  canvas.height = s.h;
  redraw();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function loadSample(slot, name) {
  const img = await loadImage(`samples/${name}.jpg`);
  state.photos[slot] = img;
  state.crops[slot] = { x: 0, y: 0, scale: 1 };
  const thumb = document.getElementById(`thumb-${'abc'[slot]}`);
  thumb.src = `samples/${name}.jpg`;
  thumb.style.display = '';
  document.getElementById(`label-${'abc'[slot]}`).textContent = `Photo ${'ABC'[slot]} · ${name}`;
  redraw();
}

// --- option buttons -------------------------------------------------------
function buildButtons() {
  const layoutGrid = document.getElementById('layout-grid');
  for (const [key, def] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'layout-btn';
    b.dataset.layout = key;
    const diagram = key === 'grid' ? 'diagram-grid' : key === 'triptych' ? 'diagram-triptych' : key === 'hero' ? 'diagram-hero' : 'diagram-quad';
    const bars = key === 'grid' ? 4 : key === 'triptych' ? 3 : key === 'hero' ? 3 : 4;
    b.innerHTML = `<span class="diagram ${diagram}">${'<i></i>'.repeat(bars)}</span>${def.label}`;
    b.addEventListener('click', () => {
      state.layout = key;
      state.selectedPanel = 0;
      document.querySelectorAll('.layout-btn').forEach((x) => x.classList.toggle('active', x === b));
      redraw();
    });
    layoutGrid.appendChild(b);
  }
  const gradeGrid = document.getElementById('grade-grid');
  const gradeSwatches = {
    sunset: ['#7a1e6e', '#e14e6b', '#ff8a3d'],
    neon: ['#3b0a6e', '#a4138f', '#ff2e88'],
    palm: ['#14586b', '#c98a2e', '#ffd76a'],
    dusk: ['#1c0f4a', '#4a1e7a', '#8f3aa8'],
  };
  for (const [key, def] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'grade-btn';
    b.dataset.grade = key;
    b.textContent = def.label;
    const [g1, g2, g3] = gradeSwatches[key];
    b.style.setProperty('--g1', g1);
    b.style.setProperty('--g2', g2);
    b.style.setProperty('--g3', g3);
    b.addEventListener('click', () => {
      state.grade = key;
      document.querySelectorAll('.grade-btn').forEach((x) => x.classList.toggle('active', x === b));
      redraw();
    });
    gradeGrid.appendChild(b);
  }
  const sizeGrid = document.getElementById('size-grid');
  for (const [key, def] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-btn';
    b.dataset.size = key;
    b.innerHTML = `${def.label.split(' ')[0]}<small>${def.label}</small>`;
    b.addEventListener('click', () => {
      state.size = key;
      document.querySelectorAll('.size-btn').forEach((x) => x.classList.toggle('active', x === b));
      document.getElementById('export').textContent = `Export PNG ${def.label}`;
      applySize();
    });
    sizeGrid.appendChild(b);
  }
  document.querySelector('.layout-btn[data-layout="grid"]').classList.add('active');
  document.querySelector('.grade-btn[data-grade="sunset"]').classList.add('active');
  document.querySelector('.size-btn[data-size="square"]').classList.add('active');
  document.getElementById('export').textContent = 'Export PNG 1080 x 1080';
}

// --- photo slots -----------------------------------------------------------
function wireSlots() {
  for (let slot = 0; slot < 3; slot += 1) {
    const letter = 'abc'[slot];
    document.getElementById(`file-${letter}`).addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const img = await loadImage(URL.createObjectURL(file));
      state.photos[slot] = img;
      state.crops[slot] = { x: 0, y: 0, scale: 1 };
      const thumb = document.getElementById(`thumb-${letter}`);
      thumb.src = URL.createObjectURL(file);
      thumb.style.display = '';
      document.getElementById(`label-${letter}`).textContent = `Photo ${'ABC'[slot]} · ${file.name}`;
      redraw();
    });
    document.querySelectorAll(`[data-sample-for="${letter}"]`).forEach((b) => {
      b.addEventListener('click', () => loadSample(slot, b.dataset.sample).catch(() => {
        statusEl.textContent = `Could not load the ${b.dataset.sample} sample.`;
      }));
    });
    document.querySelector(`[data-fill="${slot}"]`).addEventListener('click', () => {
      state.fillAll = slot;
      document.querySelectorAll('.fillall').forEach((x) => x.classList.toggle('active', x.dataset.fill === String(slot)));
      document.getElementById('fill-off').classList.remove('active');
      redraw();
    });
  }
  document.getElementById('fill-off').addEventListener('click', () => {
    state.fillAll = -1;
    document.querySelectorAll('.fillall').forEach((x) => x.classList.remove('active'));
    document.getElementById('fill-off').classList.add('active');
    redraw();
  });
  document.getElementById('fill-off').classList.add('active');
}

// --- caption ---------------------------------------------------------------
titleEl.addEventListener('input', () => { state.title = titleEl.value; redraw(); });
subtitleEl.addEventListener('input', () => { state.subtitle = subtitleEl.value; redraw(); });

// --- crop controls ---------------------------------------------------------
/** The photo index the selected panel shows (fill-all aware). */
function selectedPhoto() {
  const panels = layoutPanels(state.layout);
  const panel = panels[Math.min(state.selectedPanel, panels.length - 1)];
  return state.fillAll >= 0 ? state.fillAll : panel.photo;
}

function syncCropControls() {
  const idx = selectedPhoto();
  const photo = state.photos[idx];
  const panels = layoutPanels(state.layout);
  const panel = panels[Math.min(state.selectedPanel, panels.length - 1)];
  const pw = panel.w * canvas.width;
  const ph = panel.h * canvas.height * PANEL_HEIGHT;
  const crop = photo ? clampCrop(state.crops[idx], photo, pw, ph) : { x: 0, y: 0, scale: 1 };
  document.getElementById('zoom').value = crop.scale;
  document.getElementById('panx').value = crop.x;
  document.getElementById('pany').value = crop.y;
  document.getElementById('crop-hint').textContent =
    `Panel ${state.selectedPanel + 1} · Photo ${'ABC'[idx]} — drag it to reposition, scroll to zoom.`;
}

document.getElementById('zoom').addEventListener('input', (e) => {
  const idx = selectedPhoto();
  state.crops[idx].scale = Number(e.target.value);
  redraw();
});
document.getElementById('panx').addEventListener('input', (e) => {
  const idx = selectedPhoto();
  state.crops[idx].x = Number(e.target.value);
  redraw();
});
document.getElementById('pany').addEventListener('input', (e) => {
  const idx = selectedPhoto();
  state.crops[idx].y = Number(e.target.value);
  redraw();
});

/** Panel rectangles in canvas pixels, for hit-testing pointer input. */
function panelRects() {
  return layoutPanels(state.layout).map((p) => ({
    x: p.x * canvas.width,
    y: canvas.height * PANEL_TOP + p.y * canvas.height * PANEL_HEIGHT,
    w: p.w * canvas.width,
    h: p.h * canvas.height * PANEL_HEIGHT,
    photo: p.photo,
  }));
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const hit = panelRects().findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  if (hit < 0) return;
  state.selectedPanel = hit;
  canvas.setPointerCapture(e.pointerId);
  const idx = selectedPhoto();
  drag = { startX: x, startY: y, moved: false, crop: { ...state.crops[idx] }, rect: panelRects()[hit] };
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const dx = x - drag.startX;
  const dy = y - drag.startY;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  const idx = selectedPhoto();
  state.crops[idx] = {
    ...drag.crop,
    x: drag.crop.x + dx / drag.rect.w,
    y: drag.crop.y + dy / drag.rect.h,
  };
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  const hit = panelRects().findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  if (hit < 0) return;
  state.selectedPanel = hit;
  const idx = selectedPhoto();
  const next = state.crops[idx].scale * Math.exp(-e.deltaY * 0.0012);
  state.crops[idx].scale = Math.min(3, Math.max(1, next));
  redraw();
}, { passive: false });

// --- export ----------------------------------------------------------------
document.getElementById('export').addEventListener('click', () => {
  const s = SIZES[state.size];
  const off = document.createElement('canvas');
  off.width = s.w;
  off.height = s.h;
  drawCover(off, state);
  off.toBlob((blob) => {
    if (!blob) { statusEl.textContent = 'Export failed — try again.'; return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-vice-${s.w}x${s.h}.png`;
    a.click();
    statusEl.textContent = `Saved neon-vice-${s.w}x${s.h}.png`;
  }, 'image/png');
});

// --- start -----------------------------------------------------------------
buildButtons();
wireSlots();

const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  runShot(query, state, { loadImage, loadSample, applySize, redraw, ensureFont });
} else {
  (async () => {
    await ensureFont();
    await Promise.all(SAMPLES.map((name, i) => loadSample(i, name).catch(() => {})));
    applySize();
  })();
}
