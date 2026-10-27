import { clamp } from '../utils/math.js';

const TWO_PI = Math.PI * 2;
const MIN_DURATION = 1800; // ms; keeps the countdown readable on fast loads
const GOAL = 0.92; // fraction of a full turn needed to begin

/**
 * Countdown loader (99 → 00) followed by a "drag around the ring" gate.
 * The gate doubles as the user gesture that unlocks Web Audio.
 */
export class Loader {
  constructor(root, { wordmark, onBegin }) {
    this.onBegin = onBegin;
    this.target = 0;
    this.shown = 0;
    this.startedAt = performance.now();

    this.el = document.createElement('div');
    this.el.className = 'loader';
    this.el.innerHTML = `
      <div class="loader-brand"></div>
      <div class="loader-count" aria-hidden="true">
        <span class="loader-digit"><span class="loader-strip">${strip()}</span></span>
        <span class="loader-digit"><span class="loader-strip">${strip()}</span></span>
        <span class="loader-unit">%</span>
      </div>
      <p class="sr-only" role="status" aria-live="polite">Loading</p>
      <div class="loader-gate" aria-hidden="true">
        <div class="loader-ring">
          <svg viewBox="0 0 200 200" class="loader-ring-svg">
            <circle cx="100" cy="100" r="88" class="loader-ring-track" />
            <circle cx="100" cy="100" r="88" class="loader-ring-progress" pathLength="1" />
          </svg>
          <div class="loader-handle"></div>
        </div>
        <p class="loader-gate-hint">Drag the dot around the circle</p>
        <button type="button" class="loader-enter">or press here to enter</button>
      </div>
    `;
    this.el.querySelector('.loader-brand').textContent = wordmark;
    root.appendChild(this.el);

    this.strips = [...this.el.querySelectorAll('.loader-strip')];
    this.status = this.el.querySelector('[role="status"]');
    this.gate = this.el.querySelector('.loader-gate');
    this.ring = this.el.querySelector('.loader-ring');
    this.handle = this.el.querySelector('.loader-handle');
    this.arc = this.el.querySelector('.loader-ring-progress');
    this.enterBtn = this.el.querySelector('.loader-enter');

    this.#render(99);
    this.raf = requestAnimationFrame(this.#tick);
  }

  setProgress(p) {
    this.target = clamp(p);
  }

  /** Resolves once the countdown has visibly reached 00. */
  finish() {
    this.target = 1;
    return new Promise((resolve) => {
      this.onDone = resolve;
    });
  }

  #tick = () => {
    const elapsed = performance.now() - this.startedAt;
    const cap = clamp(elapsed / MIN_DURATION);
    const goal = Math.min(this.target, cap);
    this.shown += (goal - this.shown) * 0.12;
    if (goal - this.shown < 0.002) this.shown = goal;
    const value = Math.round(99 * (1 - this.shown));
    this.#render(value);

    if (this.shown >= 1 && this.onDone) {
      this.onDone();
      this.onDone = null;
      return;
    }
    this.raf = requestAnimationFrame(this.#tick);
  };

  #render(value) {
    if (value === this.lastValue) return;
    this.lastValue = value;
    const tens = Math.floor(value / 10);
    const ones = value % 10;
    this.strips[0].style.transform = `translateY(${-tens}em)`;
    this.strips[1].style.transform = `translateY(${-ones}em)`;
    if (value % 10 === 0) this.status.textContent = `Loading ${100 - value}%`;
  }

  showGate() {
    this.el.classList.add('is-ready');
    this.status.textContent = 'Ready. Drag around the circle or press the enter button to begin.';
    this.gate.removeAttribute('aria-hidden');
    this.angle = 0;
    this.#setRing(0);

    let last = null;
    let accumulated = 0;
    const center = () => {
      const r = this.ring.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    };
    const angleAt = (e) => {
      const [cx, cy] = center();
      // 0 at 12 o'clock, increasing clockwise.
      return (Math.atan2(e.clientX - cx, -(e.clientY - cy)) + TWO_PI) % TWO_PI;
    };

    const onDown = (e) => {
      if (this.begun) return;
      e.preventDefault();
      this.ring.setPointerCapture(e.pointerId);
      this.el.classList.add('is-dragging');
      last = angleAt(e);
      accumulated = this.angle;
    };
    const onMove = (e) => {
      if (last === null || this.begun) return;
      const a = angleAt(e);
      let d = a - last;
      if (d > Math.PI) d -= TWO_PI;
      if (d < -Math.PI) d += TWO_PI;
      last = a;
      accumulated = clamp(accumulated + d, 0, TWO_PI);
      this.angle = accumulated;
      this.#setRing(accumulated / TWO_PI);
      if (accumulated / TWO_PI >= GOAL) this.#begin();
    };
    const onUp = () => {
      if (last === null) return;
      last = null;
      this.el.classList.remove('is-dragging');
      if (this.begun) return;
      // Spring back so a half-finished drag reads as "not yet".
      const from = this.angle;
      const t0 = performance.now();
      const spring = () => {
        if (last !== null || this.begun) return;
        const t = clamp((performance.now() - t0) / 450);
        this.angle = from * (1 - t) ** 3;
        this.#setRing(this.angle / TWO_PI);
        if (t < 1) requestAnimationFrame(spring);
      };
      spring();
    };

    this.ring.addEventListener('pointerdown', onDown);
    this.ring.addEventListener('pointermove', onMove);
    this.ring.addEventListener('pointerup', onUp);
    this.ring.addEventListener('pointercancel', onUp);
    this.enterBtn.addEventListener('click', () => this.#begin());
    this.enterBtn.focus({ preventScroll: true });
  }

  #setRing(p) {
    const a = p * TWO_PI;
    const r = this.ring.offsetWidth / 2 * 0.88;
    this.handle.style.transform = `translate(${Math.sin(a) * r}px, ${-Math.cos(a) * r}px)`;
    this.arc.style.strokeDashoffset = String(1 - p);
  }

  #begin() {
    if (this.begun) return;
    this.begun = true;
    this.#setRing(1);
    this.el.classList.add('is-leaving');
    this.onBegin();
    setTimeout(() => this.el.remove(), 1200);
  }
}

function strip() {
  return Array.from({ length: 10 }, (_, i) => `<span>${i}</span>`).join('');
}
