import { Emitter } from '../utils/Emitter.js';
import { clamp } from '../utils/math.js';

/**
 * Press-and-hold button that advances to the next chapter. Holding fills a
 * ring; releasing early drains it. Works with pointer, Enter and Space.
 */
export class NextButton extends Emitter {
  constructor(root, { duration }) {
    super();
    this.duration = duration;
    this.progress = 0;
    this.holding = false;

    this.el = document.createElement('div');
    this.el.className = 'next';
    this.el.innerHTML = `
      <button type="button" class="next-btn" aria-label="Press and hold to continue">
        <span class="next-core"></span>
        <svg class="next-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="46" pathLength="1" />
        </svg>
      </button>
      <span class="next-label" aria-hidden="true">Hold to<br/>continue</span>
    `;
    root.appendChild(this.el);
    this.btn = this.el.querySelector('.next-btn');
    this.ring = this.el.querySelector('.next-ring circle');

    const start = (e) => {
      if (e.type === 'pointerdown') this.btn.setPointerCapture(e.pointerId);
      this.#start();
    };
    const end = () => this.#end();
    this.btn.addEventListener('pointerdown', start);
    this.btn.addEventListener('pointerup', end);
    this.btn.addEventListener('pointercancel', end);
    this.btn.addEventListener('lostpointercapture', end);
    this.btn.addEventListener('contextmenu', (e) => e.preventDefault());
    this.btn.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
        e.preventDefault();
        this.#start();
      }
    });
    this.btn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') this.#end();
    });
  }

  get visible() {
    return this.el.classList.contains('is-visible');
  }

  show() {
    this.progress = 0;
    this.done = false;
    this.#render();
    this.el.classList.add('is-visible');
  }

  hide() {
    this.#end();
    this.el.classList.remove('is-visible');
  }

  #start() {
    if (!this.visible || this.holding || this.done) return;
    this.holding = true;
    this.el.classList.add('is-holding');
    this.emit('holdstart');
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.#tick);
  }

  #end() {
    if (!this.holding) return;
    this.holding = false;
    this.el.classList.remove('is-holding');
    this.emit('holdend');
  }

  #tick = () => {
    const now = performance.now();
    const dt = now - this.last;
    this.last = now;
    const rate = dt / this.duration;
    this.progress = clamp(this.progress + (this.holding ? rate : -rate * 2));
    this.emit('progress', this.progress);
    this.#render();

    if (this.progress >= 1) {
      this.done = true;
      this.#end();
      this.emit('confirm');
      return;
    }
    if (this.holding || this.progress > 0) this.raf = requestAnimationFrame(this.#tick);
  };

  #render() {
    this.ring.style.strokeDashoffset = String(1 - this.progress);
    this.btn.style.setProperty('--p', this.progress.toFixed(3));
  }
}
