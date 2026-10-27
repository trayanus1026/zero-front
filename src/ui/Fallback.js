import { Waitlist } from './Waitlist.js';

/** Static, fully readable version of the story for devices without WebGL2. */
export function renderFallback(root, { brand, stages, hubs, config }) {
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-fallback');

  const main = document.createElement('main');
  main.className = 'fallback';
  const header = document.createElement('header');
  header.className = 'fallback-header';
  header.textContent = brand.wordmark;
  main.appendChild(header);

  for (const stage of stages) {
    const section = document.createElement('section');
    section.className = 'fallback-chapter';
    stage.lines.forEach((line, i) => {
      if (line.eyebrow) {
        const eyebrow = document.createElement('p');
        eyebrow.className = 'narrative-eyebrow';
        eyebrow.textContent = line.eyebrow;
        section.appendChild(eyebrow);
      }
      const p = document.createElement(i === 0 ? 'h2' : 'p');
      p.className = 'fallback-line';
      p.textContent = line.text;
      section.appendChild(p);
    });
    main.appendChild(section);
  }

  const join = document.createElement('button');
  join.type = 'button';
  join.className = 'waitlist-submit fallback-join';
  join.textContent = 'Join the waitlist';
  main.appendChild(join);
  root.appendChild(main);

  const waitlist = new Waitlist(root, { brand, hubs, endpoint: config.waitlistEndpoint });
  join.addEventListener('click', () => waitlist.open());
  waitlist.on('replay', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}
