/**
 * Chapter copy. Shows the last line whose `at` threshold the stage progress
 * has passed; lines swap with a staggered word reveal.
 */
export class Narrative {
  constructor(root) {
    this.el = document.createElement('section');
    this.el.className = 'narrative';
    this.el.setAttribute('aria-live', 'polite');
    root.appendChild(this.el);
    this.lines = [];
    this.index = -1;
  }

  setLines(lines) {
    this.lines = lines;
    this.index = -1;
    this.#swap(null);
  }

  update(progress) {
    let idx = -1;
    for (let i = 0; i < this.lines.length; i++) {
      if (progress >= this.lines[i].at - 1e-4) idx = i;
    }
    if (idx !== this.index) {
      this.index = idx;
      this.#swap(this.lines[idx] ?? null);
    }
  }

  #swap(line) {
    const old = this.el.querySelector('.narrative-line:not(.is-out)');
    if (old) {
      old.classList.add('is-out');
      setTimeout(() => old.remove(), 700);
    }
    if (!line) return;

    const block = document.createElement('div');
    block.className = 'narrative-line';
    if (line.eyebrow) {
      const eyebrow = document.createElement('p');
      eyebrow.className = 'narrative-eyebrow';
      eyebrow.textContent = line.eyebrow;
      block.appendChild(eyebrow);
    }
    const text = document.createElement('p');
    text.className = 'narrative-text';
    text.setAttribute('aria-label', line.text);
    line.text.split(' ').forEach((word, i) => {
      const span = document.createElement('span');
      span.className = 'narrative-word';
      span.style.setProperty('--i', i);
      span.setAttribute('aria-hidden', 'true');
      span.textContent = word;
      text.append(span, ' ');
    });
    block.appendChild(text);
    this.el.appendChild(block);
    requestAnimationFrame(() => requestAnimationFrame(() => block.classList.add('is-in')));
  }
}
