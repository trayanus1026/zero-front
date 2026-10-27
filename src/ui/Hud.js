import { Emitter } from '../utils/Emitter.js';

const ICON_XP = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11l-4 2.2 1-4.4-3.4-3 4.5-.5z" fill="currentColor"/></svg>`;
const ICON_MENU = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const ICON_AUDIO = `<svg viewBox="0 0 20 20" aria-hidden="true"><g class="hud-wave">${[3, 6.5, 10, 13.5, 17]
  .map((x, i) => `<rect x="${x - 0.8}" y="4" width="1.6" height="12" rx="0.8" style="--i:${i}"/>`)
  .join('')}</g></svg>`;

/**
 * Persistent heads-up display: wordmark + XP on the left; audio, waitlist and
 * chapter menu on the right; a status hint near the bottom.
 */
export class Hud extends Emitter {
  constructor(root, { wordmark }) {
    super();
    this.xp = 0;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-left">
        <span class="hud-wordmark"></span>
        <div class="hud-pill hud-xp" role="status" aria-live="polite">
          <span class="hud-xp-icon">${ICON_XP}</span>
          <span class="hud-xp-value">0</span><span class="hud-xp-label">XP</span>
        </div>
      </div>
      <div class="hud-right">
        <button type="button" class="hud-pill hud-icon-btn hud-audio" aria-pressed="true" aria-label="Sound on">${ICON_AUDIO}</button>
        <button type="button" class="hud-pill hud-waitlist">Join waitlist</button>
        <div class="hud-menu">
          <button type="button" class="hud-pill hud-icon-btn hud-menu-btn" aria-expanded="false" aria-haspopup="true" aria-label="Chapters">${ICON_MENU}</button>
          <nav class="hud-menu-dropdown" aria-label="Chapters"><ol></ol></nav>
        </div>
      </div>
      <p class="hud-status" aria-live="polite"></p>
    `;
    this.el.querySelector('.hud-wordmark').textContent = wordmark;
    root.appendChild(this.el);

    this.xpEl = this.el.querySelector('.hud-xp');
    this.xpValue = this.el.querySelector('.hud-xp-value');
    this.audioBtn = this.el.querySelector('.hud-audio');
    this.menuBtn = this.el.querySelector('.hud-menu-btn');
    this.dropdown = this.el.querySelector('.hud-menu-dropdown');
    this.menuList = this.dropdown.querySelector('ol');
    this.statusEl = this.el.querySelector('.hud-status');

    this.audioBtn.addEventListener('click', () => this.emit('audio'));
    this.el.querySelector('.hud-waitlist').addEventListener('click', () => this.emit('waitlist'));
    this.menuBtn.addEventListener('click', () => this.toggleMenu());
    document.addEventListener('pointerdown', (e) => {
      if (this.menuOpen && !this.el.querySelector('.hud-menu').contains(e.target)) this.toggleMenu(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.menuOpen) {
        this.toggleMenu(false);
        this.menuBtn.focus();
      }
    });
  }

  show() {
    this.el.classList.add('is-visible');
  }

  setTheme(theme) {
    document.body.classList.toggle('theme-light', theme === 'light');
  }

  setAudio(on) {
    this.audioBtn.setAttribute('aria-pressed', String(on));
    this.audioBtn.setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    this.audioBtn.classList.toggle('is-muted', !on);
  }

  addXP(amount) {
    if (!amount) return;
    const from = this.xp;
    this.xp += amount;
    const to = this.xp;
    const t0 = performance.now();
    const tick = () => {
      const t = Math.min(1, (performance.now() - t0) / 900);
      this.xpValue.textContent = String(Math.round(from + (to - from) * (1 - (1 - t) ** 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    tick();
    this.xpEl.classList.remove('is-ripple');
    void this.xpEl.offsetWidth; // restart the CSS animation
    this.xpEl.classList.add('is-ripple');
  }

  setStatus(text) {
    this.statusEl.classList.remove('is-visible');
    clearTimeout(this.statusTimer);
    if (!text) return;
    this.statusTimer = setTimeout(() => {
      this.statusEl.textContent = text;
      this.statusEl.classList.add('is-visible');
    }, 350);
  }

  setChapters(stages, current, unlocked) {
    this.menuList.innerHTML = '';
    stages.forEach((s, i) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-menu-item';
      btn.innerHTML = `<span class="hud-menu-num">0${i + 1}</span><span></span>`;
      btn.lastChild.textContent = s.label;
      btn.disabled = i > unlocked;
      if (i === current) btn.setAttribute('aria-current', 'step');
      btn.addEventListener('click', () => {
        this.toggleMenu(false);
        this.emit('navigate', i);
      });
      li.appendChild(btn);
      this.menuList.appendChild(li);
    });
  }

  toggleMenu(force) {
    this.menuOpen = force ?? !this.menuOpen;
    this.dropdown.classList.toggle('is-open', this.menuOpen);
    this.menuBtn.setAttribute('aria-expanded', String(this.menuOpen));
    if (this.menuOpen) this.menuList.querySelector('button:not(:disabled)')?.focus();
  }
}
