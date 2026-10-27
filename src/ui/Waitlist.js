import { Emitter } from '../utils/Emitter.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STORAGE_KEY = 'origin:waitlist';

/** Modal sign-up dialog with inline validation, plus a sharing success state. */
export class Waitlist extends Emitter {
  constructor(root, { brand, hubs, endpoint }) {
    super();
    this.brand = brand;
    this.endpoint = endpoint;

    this.dialog = document.createElement('dialog');
    this.dialog.className = 'waitlist';
    this.dialog.setAttribute('aria-labelledby', 'waitlist-title');
    this.dialog.innerHTML = `
      <button type="button" class="waitlist-close" aria-label="Close">×</button>
      <div class="waitlist-step waitlist-form-step">
        <p class="waitlist-eyebrow">Early access</p>
        <h2 id="waitlist-title" class="waitlist-title">Start from the work.</h2>
        <p class="waitlist-copy">Join the waitlist and we'll open your path as soon as a cohort starts.</p>
        <form class="waitlist-form" novalidate>
          <label class="waitlist-field">
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" inputmode="email" required placeholder="you@domain.com" />
          </label>
          <label class="waitlist-field">
            <span>Path you're curious about</span>
            <select name="path">
              <option value="">Not sure yet</option>
              ${hubs.map((h) => `<option value="${h.id}">${h.name}</option>`).join('')}
            </select>
          </label>
          <p class="waitlist-error" role="alert"></p>
          <button type="submit" class="waitlist-submit">Join the waitlist</button>
        </form>
      </div>
      <div class="waitlist-step waitlist-done-step" hidden>
        <p class="waitlist-eyebrow">You're in</p>
        <h2 class="waitlist-title">See you in the field.</h2>
        <p class="waitlist-copy">We'll email you when your cohort opens. Bring a friend along.</p>
        <div class="waitlist-actions">
          <button type="button" class="waitlist-share">Share</button>
          <button type="button" class="waitlist-replay">Replay story</button>
        </div>
        <p class="waitlist-toast" role="status"></p>
      </div>
    `;
    root.appendChild(this.dialog);

    this.form = this.dialog.querySelector('form');
    this.error = this.dialog.querySelector('.waitlist-error');
    this.submitBtn = this.dialog.querySelector('.waitlist-submit');
    this.toast = this.dialog.querySelector('.waitlist-toast');

    this.dialog.querySelector('.waitlist-close').addEventListener('click', () => this.close());
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) this.close(); // backdrop click
    });
    this.dialog.addEventListener('close', () => this.emit('close'));
    this.form.addEventListener('submit', (e) => this.#submit(e));
    this.form.email.addEventListener('input', () => { this.error.textContent = ''; });
    this.dialog.querySelector('.waitlist-share').addEventListener('click', () => this.#share());
    this.dialog.querySelector('.waitlist-replay').addEventListener('click', () => {
      this.close();
      this.emit('replay');
    });

    if (this.#stored()) this.#showDone();
  }

  open(pathId) {
    if (pathId) this.form.path.value = pathId;
    if (!this.dialog.open) this.dialog.showModal();
    (this.joined ? this.dialog.querySelector('.waitlist-share') : this.form.email).focus();
  }

  close() {
    if (this.dialog.open) this.dialog.close();
  }

  #stored() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    } catch {
      return null;
    }
  }

  async #submit(e) {
    e.preventDefault();
    const email = this.form.email.value.trim();
    const path = this.form.path.value;
    if (!EMAIL_RE.test(email)) {
      this.error.textContent = 'Please enter a valid email address.';
      this.form.email.focus();
      return;
    }

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Joining…';
    try {
      if (this.endpoint) {
        const res = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, path }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ email, path, at: Date.now() }));
      } catch {
        /* storage unavailable: the sign-up itself still succeeded */
      }
      this.#showDone();
      this.emit('joined', { email, path });
    } catch {
      this.error.textContent = 'Something went wrong. Please try again in a moment.';
    } finally {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = 'Join the waitlist';
    }
  }

  #showDone() {
    this.joined = true;
    this.dialog.querySelector('.waitlist-form-step').hidden = true;
    this.dialog.querySelector('.waitlist-done-step').hidden = false;
  }

  async #share() {
    const data = { title: this.brand.shareTitle, text: this.brand.shareText, url: location.href };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(`${data.text} ${data.url}`);
      this.toast.textContent = 'Link copied to clipboard.';
    } catch (err) {
      if (err?.name !== 'AbortError') this.toast.textContent = `Copy this link: ${data.url}`;
    }
  }
}
