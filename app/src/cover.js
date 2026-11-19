// Neon Vice Cover Studio — the cover renderer. Draws one GTA-style multi-panel
// poster onto a canvas from a state object: three photos with per-photo crops,
// one of four layouts, one of four sunset/neon grades, a title and a subtitle,
// at any of the three post sizes. Everything here is drawn from scratch with the
// canvas 2D API: the sky, the slatted sun and the palm silhouettes are procedural,
// the lettering is the bundled Archivo Black font. No image is fetched, no
// network is touched; the photos come from the user's machine or the samples.

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 x 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 x 1350' },
  wide: { w: 1920, h: 1080, label: '1920 x 1080' },
};

export const LAYOUTS = {
  grid: { label: 'Sunset Grid', panels: 4 },
  triptych: { label: 'Triptych', panels: 3 },
  hero: { label: 'Split Hero', panels: 3 },
  quad: { label: 'Quad', panels: 4 },
};

export const GRADES = {
  sunset: { label: 'Sunset' },
  neon: { label: 'Neon' },
  palm: { label: 'Palm Gold' },
  dusk: { label: 'Dusk' },
};

// One palette per grade: sky gradient stops, sun colour, accent for the caption
// shadow and rules, scrim for the caption band, tint washed over the photos.
const PALETTES = {
  sunset: {
    sky: ['#2a1052', '#7a1e6e', '#e14e6b', '#ff8a3d'],
    sun: '#ffd76a', accent: '#ff5e7a', scrim: '#1c0a2e',
    tint: 'rgba(255, 110, 60, 0.16)', wash: 'rgba(255, 90, 140, 0.10)',
  },
  neon: {
    sky: ['#0d0221', '#3b0a6e', '#a4138f', '#ff2e88'],
    sun: '#4de8ff', accent: '#22e6ff', scrim: '#0d0221',
    tint: 'rgba(255, 46, 136, 0.14)', wash: 'rgba(34, 230, 255, 0.08)',
  },
  palm: {
    sky: ['#10243d', '#14586b', '#c98a2e', '#ffd76a'],
    sun: '#fff3b0', accent: '#ffc53d', scrim: '#0a1a2e',
    tint: 'rgba(255, 197, 61, 0.14)', wash: 'rgba(20, 88, 107, 0.10)',
  },
  dusk: {
    sky: ['#070418', '#1c0f4a', '#4a1e7a', '#8f3aa8'],
    sun: '#e8b4ff', accent: '#b388ff', scrim: '#070418',
    tint: 'rgba(143, 58, 168, 0.16)', wash: 'rgba(179, 136, 255, 0.08)',
  },
};

// The poster's vertical bands, as fractions of the canvas height: a sky strip
// with the sun and palms, the photo panels, and the caption band at the foot.
const SKY_H = 0.16;
const CAPTION_H = 0.2;

/** The panel rectangles of a layout, as fractions of the panel area. */
export function layoutPanels(layout) {
  const g = 0.012; // gap between panels, as a fraction of the area width
  switch (layout) {
    case 'triptych':
      return [0, 1, 2].map((i) => ({
        x: i / 3 + (i === 0 ? 0 : g / 2),
        y: 0,
        w: 1 / 3 - (i === 1 ? g : g / 2),
        h: 1,
        photo: i,
      }));
    case 'hero':
      return [
        { x: 0, y: 0, w: 0.62 - g / 2, h: 1, photo: 0 },
        { x: 0.62 + g / 2, y: 0, w: 0.38 - g / 2, h: 0.5 - g / 2, photo: 1 },
        { x: 0.62 + g / 2, y: 0.5 + g / 2, w: 0.38 - g / 2, h: 0.5 - g / 2, photo: 2 },
      ];
    case 'quad':
      return [
        { x: 0, y: 0, w: 1, h: 0.52 - g / 2, photo: 0 },
        { x: 0, y: 0.52 + g / 2, w: 1 / 3 - g / 2, h: 0.48 - g / 2, photo: 1 },
        { x: 1 / 3 + g / 2, y: 0.52 + g / 2, w: 1 / 3 - g, h: 0.48 - g / 2, photo: 2 },
        { x: 2 / 3 + g / 2, y: 0.52 + g / 2, w: 1 / 3 - g / 2, h: 0.48 - g / 2, photo: 0 },
      ];
    case 'grid':
    default:
      return [
        { x: 0, y: 0, w: 0.5 - g / 2, h: 0.5 - g / 2, photo: 0 },
        { x: 0.5 + g / 2, y: 0, w: 0.5 - g / 2, h: 0.5 - g / 2, photo: 1 },
        { x: 0, y: 0.5 + g / 2, w: 0.5 - g / 2, h: 0.5 - g / 2, photo: 2 },
        { x: 0.5 + g / 2, y: 0.5 + g / 2, w: 0.5 - g / 2, h: 0.5 - g / 2, photo: 0 },
      ];
  }
}

/** Clamps a crop so the photo always covers its panel. */
export function clampCrop(crop, photo, panelW, panelH) {
  const base = Math.max(panelW / photo.naturalWidth, panelH / photo.naturalHeight);
  const scale = Math.min(3, Math.max(1, crop.scale || 1));
  const pw = photo.naturalWidth * base * scale;
  const ph = photo.naturalHeight * base * scale;
  const maxX = Math.max(0, (pw - panelW) / 2 / panelW);
  const maxY = Math.max(0, (ph - panelH) / 2 / panelH);
  return {
    scale,
    x: Math.min(maxX, Math.max(-maxX, crop.x || 0)),
    y: Math.min(maxY, Math.max(-maxY, crop.y || 0)),
  };
}

/** Draws one photo into a panel rect, cover-fit, with its crop applied. */
function panelPhoto(ctx, photo, crop, px, py, pw, ph) {
  const c = clampCrop(crop, photo, pw, ph);
  const base = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
  const w = photo.naturalWidth * base * c.scale;
  const h = photo.naturalHeight * base * c.scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(px, py, pw, ph);
  ctx.clip();
  ctx.drawImage(photo, px + (pw - w) / 2 + c.x * pw, py + (ph - h) / 2 + c.y * ph, w, h);
  ctx.restore();
}

/** A sun disc cut by horizontal slats, GTA-poster style. */
function drawSlattedSun(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 0.9;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Slats: dark bars across the lower half, widening toward the base.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(20, 8, 40, 0.55)';
  let y = cy + r * 0.05;
  let gap = r * 0.07;
  while (y < cy + r) {
    ctx.fillRect(cx - r, y, r * 2, gap * 0.55);
    y += gap;
    gap *= 1.45;
  }
  ctx.restore();
}

/** One palm silhouette: a leaning trunk and a crown of curved fronds. */
function drawPalm(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(s, s);
  ctx.strokeStyle = '#12061f';
  ctx.fillStyle = '#12061f';
  ctx.lineCap = 'round';
  // Trunk, curving gently as it rises.
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(6, -55, -4, -105);
  ctx.stroke();
  // Fronds: seven blades fanning from the crown, each a filled curve.
  ctx.translate(-4, -105);
  for (let i = 0; i < 7; i += 1) {
    const a = (-160 + i * 27) * (Math.PI / 180);
    const len = 62 - Math.abs(i - 3) * 7;
    const tx = Math.cos(a) * len;
    const ty = Math.sin(a) * len * 0.55 - 14;
    const mx = Math.cos(a) * len * 0.55;
    const my = Math.sin(a) * len * 0.55 - 26;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(mx, my, tx, ty);
    ctx.quadraticCurveTo(mx + 9, my + 12, 0, 0);
    ctx.fill();
  }
  ctx.restore();
}

/** Deterministic film grain: the same specks on every render. */
function drawGrain(ctx, w, h) {
  let seed = 20261119;
  const next = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.save();
  const count = Math.floor((w * h) / 900);
  for (let i = 0; i < count; i += 1) {
    const v = next();
    ctx.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.09)';
    ctx.fillRect(next() * w, next() * h, 1 + next() * 1.6, 1 + next() * 1.6);
  }
  ctx.restore();
}

/** The caption band: accent rules, title in Archivo Black, subtitle spaced out. */
function drawCaption(ctx, w, h, title, subtitle, palette) {
  const bandY = h * (1 - CAPTION_H);
  const cx = w / 2;
  // Accent rules flanking the title.
  ctx.fillStyle = palette.accent;
  ctx.fillRect(w * 0.08, bandY + h * 0.018, w * 0.1, Math.max(3, h * 0.004));
  ctx.fillRect(w * 0.82, bandY + h * 0.018, w * 0.1, Math.max(3, h * 0.004));
  const text = (title || '').trim().toUpperCase();
  if (text) {
    let size = h * 0.085;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fit = (s) => {
      ctx.font = `${s}px "Archivo Black", sans-serif`;
      return ctx.measureText(text).width;
    };
    while (fit(size) > w * 0.88 && size > 16) size -= 2;
    const ty = bandY + h * 0.115;
    // Accent drop shadow, then a dark outline, then the white face.
    ctx.font = `${size}px "Archivo Black", sans-serif`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(text, cx + size * 0.035, ty + size * 0.035);
    ctx.lineWidth = Math.max(2, size * 0.07);
    ctx.strokeStyle = 'rgba(10, 4, 22, 0.9)';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, cx, ty);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, cx, ty);
  }
  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const size = Math.max(13, h * 0.024);
    ctx.font = `${size}px "Archivo Black", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(size * 0.32)}px`; } catch { /* older canvas: no spacing */ }
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.textAlign = 'center';
    ctx.fillText(sub, cx, bandY + h * 0.165);
    try { ctx.letterSpacing = '0px'; } catch { /* reset */ }
  }
}

/**
 * Draws the whole poster onto `canvas` from `state`:
 * { photos: [img|null, img|null, img|null], crops: [{x,y,scale} x3],
 *   layout, grade, size, title, subtitle, fillAll }
 * `fillAll` is -1 (each panel its own photo) or 0/1/2 (one photo everywhere).
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const palette = PALETTES[state.grade] || PALETTES.sunset;
  const skyH = h * SKY_H;
  const panelY = skyH;
  const panelH = h * (1 - SKY_H - CAPTION_H);

  // Sky: vertical gradient, slatted sun, palms, and the wordmark.
  const sky = ctx.createLinearGradient(0, 0, 0, skyH);
  palette.sky.forEach((c, i) => sky.addColorStop(i / (palette.sky.length - 1), c));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, skyH);
  drawSlattedSun(ctx, w * 0.8, skyH * 0.62, skyH * 0.52, palette.sun);
  drawPalm(ctx, w * 0.06, skyH * 0.98, skyH / 130, -0.1);
  drawPalm(ctx, w * 0.16, skyH * 1.0, skyH / 170, 0.12);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `${Math.round(skyH * 0.26)}px "Archivo Black", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('NEON VICE', w * 0.045, skyH * 0.42);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(w * 0.045, skyH * 0.62, w * 0.085, Math.max(2, skyH * 0.035));

  // Photo panels.
  ctx.fillStyle = '#12061f';
  ctx.fillRect(0, panelY, w, panelH);
  const panels = layoutPanels(state.layout);
  for (const p of panels) {
    const idx = state.fillAll >= 0 ? state.fillAll : p.photo;
    const photo = state.photos[idx];
    const px = p.x * w;
    const py = panelY + p.y * panelH;
    const pw = p.w * w;
    const ph = p.h * panelH;
    if (photo) {
      panelPhoto(ctx, photo, state.crops[idx] || { x: 0, y: 0, scale: 1 }, px, py, pw, ph);
    } else {
      // Empty slot: a dark panel with a dashed frame and a hint.
      ctx.save();
      ctx.fillStyle = '#241534';
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([10, 8]);
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 10, py + 10, pw - 20, ph - 20);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = `${Math.round(Math.min(pw, ph) * 0.07)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD A PHOTO', px + pw / 2, py + ph / 2);
      ctx.restore();
    }
  }

  // Grade wash over the photos, then the caption band's scrim.
  ctx.fillStyle = palette.tint;
  ctx.fillRect(0, panelY, w, panelH);
  ctx.fillStyle = palette.wash;
  ctx.fillRect(0, panelY, w, panelH);
  const capY = h * (1 - CAPTION_H);
  const scrim = ctx.createLinearGradient(0, capY - panelH * 0.12, 0, h);
  scrim.addColorStop(0, 'rgba(10,4,22,0)');
  scrim.addColorStop(0.35, palette.scrim);
  scrim.addColorStop(1, palette.scrim);
  ctx.fillStyle = scrim;
  ctx.fillRect(0, capY - panelH * 0.12, w, h - capY + panelH * 0.12);

  drawCaption(ctx, w, h, state.title, state.subtitle, palette);
  drawGrain(ctx, w, h);
}
