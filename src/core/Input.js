import { Emitter } from '../utils/Emitter.js';
import { clamp } from '../utils/math.js';

/**
 * Normalizes wheel / touch / keyboard / pointer into a few semantic events:
 *  - scroll(delta)       delta in "screens" (1 = one viewport height)
 *  - pointerdown/up/move pointer state in pixels + NDC
 *  - holdstart/holdend   pointer press on the canvas or Space held on the page
 */
export class Input extends Emitter {
  constructor(canvas) {
    super();
    this.canvas = canvas;
    this.enabled = false;
    this.pointer = { x: 0, y: 0, nx: 0, ny: 0, down: false, startX: 0, startY: 0 };
    this.lastTouchY = null;
    this.keyHolding = false;

    window.addEventListener('wheel', this.#onWheel, { passive: true });
    canvas.addEventListener('touchstart', this.#onTouchStart, { passive: true });
    canvas.addEventListener('touchmove', this.#onTouchMove, { passive: true });
    canvas.addEventListener('touchend', this.#onTouchEnd, { passive: true });
    canvas.addEventListener('pointerdown', this.#onPointerDown);
    window.addEventListener('pointermove', this.#onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.#onPointerUp);
    window.addEventListener('pointercancel', this.#onPointerUp);
    window.addEventListener('keydown', this.#onKeyDown);
    window.addEventListener('keyup', this.#onKeyUp);
    window.addEventListener('blur', this.#onBlur);
  }

  #updatePointer(e) {
    const p = this.pointer;
    p.x = e.clientX;
    p.y = e.clientY;
    p.nx = (e.clientX / window.innerWidth) * 2 - 1;
    p.ny = -(e.clientY / window.innerHeight) * 2 + 1;
  }

  #onWheel = (e) => {
    if (!this.enabled) return;
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 33;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    this.emit('scroll', clamp(d, -240, 240) / window.innerHeight);
  };

  #onTouchStart = (e) => {
    this.lastTouchY = e.touches[0]?.clientY ?? null;
  };

  #onTouchMove = (e) => {
    if (!this.enabled || this.lastTouchY === null) return;
    const y = e.touches[0].clientY;
    this.emit('scroll', ((this.lastTouchY - y) / window.innerHeight) * 1.6);
    this.lastTouchY = y;
  };

  #onTouchEnd = () => {
    this.lastTouchY = null;
  };

  #onPointerDown = (e) => {
    this.#updatePointer(e);
    const p = this.pointer;
    p.down = true;
    p.startX = e.clientX;
    p.startY = e.clientY;
    if (!this.enabled) return;
    this.emit('pointerdown', p);
    this.emit('holdstart');
  };

  #onPointerMove = (e) => {
    this.#updatePointer(e);
    if (this.enabled) this.emit('pointermove', this.pointer);
  };

  #onPointerUp = (e) => {
    if (!this.pointer.down) return;
    this.#updatePointer(e);
    const p = this.pointer;
    p.down = false;
    if (!this.enabled) return;
    p.wasClick = Math.hypot(p.x - p.startX, p.y - p.startY) < 6;
    this.emit('pointerup', p);
    this.emit('holdend');
  };

  #isPageFocus() {
    const el = document.activeElement;
    return !el || el === document.body || el === this.canvas;
  }

  #onKeyDown = (e) => {
    if (!this.enabled || !this.#isPageFocus()) return;
    if (e.code === 'ArrowDown' || e.code === 'PageDown') {
      this.emit('scroll', e.code === 'PageDown' ? 0.5 : 0.12);
    } else if (e.code === 'ArrowUp' || e.code === 'PageUp') {
      this.emit('scroll', e.code === 'PageUp' ? -0.5 : -0.12);
    } else if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      this.keyHolding = true;
      this.emit('holdstart');
    }
  };

  #onKeyUp = (e) => {
    if (e.code === 'Space' && this.keyHolding) {
      this.keyHolding = false;
      this.emit('holdend');
    }
  };

  #onBlur = () => {
    if (this.pointer.down || this.keyHolding) this.emit('holdend');
    this.pointer.down = false;
    this.keyHolding = false;
  };
}
