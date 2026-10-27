import { CanvasTexture, SRGBColorSpace } from 'three';
import { mulberry32 } from './math.js';

// Every texture in the experience is drawn at runtime: no binary assets to
// ship, and the art direction stays editable in code.

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')];
}

function toTexture(canvas, { srgb = true } = {}) {
  const tex = new CanvasTexture(canvas);
  if (srgb) tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCloudTexture(seed = 3) {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = mulberry32(seed);
  for (let i = 0; i < 28; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * size * 0.22;
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r * 0.7;
    const rad = size * (0.12 + rand() * 0.16);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.32)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return toTexture(canvas);
}

export function createGlowTexture() {
  const size = 128;
  const [canvas, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return toTexture(canvas);
}

export function createCertificateTexture() {
  const w = 512;
  const h = 362;
  const [canvas, ctx] = makeCanvas(w, h);
  ctx.fillStyle = '#f7f1e3';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#b89a5e';
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(30, 30, w - 60, h - 60);

  ctx.fillStyle = '#3b3326';
  ctx.textAlign = 'center';
  ctx.font = '600 15px Georgia, serif';
  ctx.fillText('CERTIFICATE OF COMPLETION', w / 2, 82);
  ctx.font = 'italic 30px Georgia, serif';
  ctx.fillText('Bachelor of Something', w / 2, 140);

  ctx.fillStyle = 'rgba(59,51,38,0.35)';
  for (let i = 0; i < 4; i++) ctx.fillRect(110, 175 + i * 18, w - 220, 4);

  ctx.beginPath();
  ctx.arc(w - 110, h - 90, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#b5523b';
  ctx.fill();
  ctx.strokeStyle = '#f7f1e3';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(w - 110, h - 90, 26, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#3b3326';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(90, h - 80);
  ctx.bezierCurveTo(120, h - 110, 150, h - 60, 190, h - 88);
  ctx.stroke();
  return toTexture(canvas);
}

export function createBanknoteTexture(seed = 1) {
  const w = 512;
  const h = 240;
  const [canvas, ctx] = makeCanvas(w, h);
  const rand = mulberry32(seed);
  const hue = 120 + rand() * 30;

  ctx.fillStyle = `hsl(${hue}, 22%, 78%)`;
  ctx.fillRect(0, 0, w, h);

  // Guilloche-style line work.
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 18; k++) {
    ctx.strokeStyle = `hsla(${hue}, 30%, 35%, 0.25)`;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const y = h / 2 + Math.sin(x * 0.03 + k * 0.6) * (40 + k * 3) * Math.cos(x * 0.006);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = `hsl(${hue}, 35%, 25%)`;
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, 62, 78, 0, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${hue}, 25%, 88%)`;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  // Geometric emblem instead of a portrait.
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 22 : 44;
    ctx.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = `hsl(${hue}, 35%, 22%)`;
  ctx.font = '700 44px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('100', 26, 62);
  ctx.textAlign = 'right';
  ctx.fillText('100', w - 26, h - 26);
  ctx.font = '600 13px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('PROMISSORY NOTE · TUITION', 26, h - 30);
  return toTexture(canvas);
}

export function createJobCardTexture({ title, company, chips }) {
  const w = 512;
  const h = 300;
  const [canvas, ctx] = makeCanvas(w, h);

  ctx.fillStyle = 'rgba(10, 28, 22, 0.82)';
  roundRect(ctx, 2, 2, w - 4, h - 4, 28);
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 230, 200, 0.45)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(160, 230, 200, 0.9)';
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.fillText('JOB → TASKS → SKILLS', 34, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = '500 40px Inter, sans-serif';
  ctx.fillText(title, 34, 118);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '400 22px Inter, sans-serif';
  ctx.fillText(company, 34, 154);

  let x = 34;
  ctx.font = '500 19px Inter, sans-serif';
  for (const chip of chips) {
    const cw = ctx.measureText(chip).width + 32;
    ctx.fillStyle = 'rgba(160, 230, 200, 0.16)';
    roundRect(ctx, x, 204, cw, 44, 22);
    ctx.fill();
    ctx.fillStyle = 'rgba(210, 250, 232, 0.95)';
    ctx.fillText(chip, x + 16, 233);
    x += cw + 10;
  }
  return toTexture(canvas);
}

export function createFrostTexture(seed = 9) {
  const size = 256;
  const [canvas, ctx] = makeCanvas(size, size);
  const rand = mulberry32(seed);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 215 + rand() * 40;
    img.data[i] = v;
    img.data[i + 1] = v + 5;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = toTexture(canvas);
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
