import { Emitter } from '../utils/Emitter.js';

/** Detail card for a selected role cluster in the final chapter. */
export class HubCard extends Emitter {
  constructor(root) {
    super();
    this.el = document.createElement('aside');
    this.el.className = 'hub-card';
    this.el.setAttribute('aria-live', 'polite');
    this.el.innerHTML = `
      <button type="button" class="hub-card-close" aria-label="Close details">×</button>
      <p class="hub-card-count"></p>
      <h3 class="hub-card-title"></h3>
      <p class="hub-card-blurb"></p>
      <ul class="hub-card-skills"></ul>
      <button type="button" class="hub-card-cta">Start this path</button>
    `;
    root.appendChild(this.el);
    this.el.querySelector('.hub-card-close').addEventListener('click', () => this.hide());
    this.el.querySelector('.hub-card-cta').addEventListener('click', () => this.emit('start', this.hub));
  }

  show(hub) {
    this.hub = hub;
    this.el.querySelector('.hub-card-count').textContent = `${hub.openings.toLocaleString()} open roles`;
    this.el.querySelector('.hub-card-title').textContent = hub.name;
    this.el.querySelector('.hub-card-blurb').textContent = hub.blurb;
    const list = this.el.querySelector('.hub-card-skills');
    list.replaceChildren(...hub.skills.map((s) => Object.assign(document.createElement('li'), { textContent: s })));
    this.el.classList.add('is-visible');
  }

  hide() {
    this.el.classList.remove('is-visible');
  }
}
