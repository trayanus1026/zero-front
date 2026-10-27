// All copy, brand and data live here so the experience can be re-skinned
// without touching rendering code.

export const brand = {
  name: 'Origin',
  wordmark: 'ORIGIN',
  shareTitle: 'Origin — Start From the Work',
  shareText: 'I just walked the long way round to a shorter path. Join me on Origin.',
};

export const config = {
  // POST { email, path } as JSON. Leave empty to store sign-ups locally (demo mode).
  waitlistEndpoint: '',
  holdDurationMs: 900,
};

export const xpRewards = {
  stage: [100, 150, 200, 250, 0],
  waitlist: 300,
};

/**
 * Palette notes: colors are authored in sRGB hex. Backdrops are radial
 * gradients: `inner` at `center`, through `mid`, to `outer` at `radius`.
 */
export const stages = [
  {
    id: 'promise',
    label: 'The Promise',
    hint: 'Scroll to drift',
    usesScroll: true,
    theme: 'dark',
    palette: {
      inner: '#d8f5ea', mid: '#4a917c', outer: '#173f33',
      center: [0.5, -0.3], radius: [1.27, 1.43], fog: '#5c9f8a',
    },
    lines: [
      { at: 0, eyebrow: 'Chapter 01 — The Promise', text: 'For a hundred years, the deal was simple.' },
      { at: 0.22, text: 'Collect the paper. Climb the ladder.' },
      { at: 0.5, text: 'Millions followed the same map into the same clouds.' },
      { at: 0.8, text: 'But the map was drawn for a world that has already moved on.' },
    ],
  },
  {
    id: 'filter',
    label: 'The Filter',
    hint: 'Click the glass',
    usesScroll: false,
    theme: 'dark',
    palette: {
      inner: '#7cc4ab', mid: '#1f4a3f', outer: '#0b1c17',
      center: [0.5, 0.45], radius: [0.95, 1.1],
    },
    lines: [
      { at: 0, eyebrow: 'Chapter 02 — The Filter', text: 'Between you and the work sits a pane of credentials.' },
      { at: 0.5, text: 'It looks transparent. It never was.' },
      { at: 1, text: 'What is on the other side was always reachable.' },
    ],
  },
  {
    id: 'cost',
    label: 'The Cost',
    hint: 'Press and hold to let go',
    usesScroll: false,
    theme: 'dark',
    palette: {
      inner: '#a0532a', mid: '#3a1d10', outer: '#120a07',
      center: [0.5, -0.25], radius: [1.1, 1.2],
    },
    lines: [
      { at: 0, eyebrow: 'Chapter 03 — The Cost', text: 'Years of tuition. A mountain of debt.' },
      { at: 0.35, text: 'Spent on proof of learning, not on the learning itself.' },
      { at: 0.75, text: 'Let it go.' },
    ],
  },
  {
    id: 'reverse',
    label: 'The Reverse',
    hint: 'Scroll to travel',
    usesScroll: true,
    theme: 'dark',
    palette: {
      inner: '#2c6b58', mid: '#0f2a22', outer: '#07140f',
      center: [0.5, 0.5], radius: [1, 1],
    },
    lines: [
      { at: 0, eyebrow: 'Chapter 04 — The Reverse', text: 'So start at the other end.' },
      { at: 0.2, text: 'Take a real job. Take it apart, task by task.' },
      { at: 0.45, text: 'Rebuild it as work you do, not lectures you sit through.' },
      { at: 0.75, text: 'Every step maps to something someone will pay for.' },
    ],
  },
  {
    id: 'field',
    label: 'The Field',
    hint: 'Drag to explore · tap the ground',
    usesScroll: false,
    theme: 'light',
    palette: {
      inner: '#ffffff', mid: '#e8f5ee', outer: '#c4e3d3',
      center: [0.5, 1.15], radius: [1.3, 1.5],
    },
    lines: [
      { at: 0, eyebrow: 'Chapter 05 — The Field', text: 'Learn by building. Get seen by doing.' },
      { at: 0.5, text: 'Pick a path. Grow where the work is.' },
    ],
  },
];

// Role clusters shown as pins in the final chapter. x/z are world units on a
// ~30×30 field centered at the origin.
export const hubs = [
  {
    id: 'design', name: 'Product Design', x: -6.5, z: -3.5, openings: 1240,
    blurb: 'Ship flows end to end: research, prototypes, and hand-off that engineers love.',
    skills: ['Figma', 'Prototyping', 'Research'],
  },
  {
    id: 'ai', name: 'AI Engineering', x: 3.5, z: -6, openings: 2180,
    blurb: 'Build agents and retrieval pipelines that survive contact with real users.',
    skills: ['Python', 'LLM APIs', 'Evals'],
  },
  {
    id: 'growth', name: 'Growth Marketing', x: 7, z: 2.5, openings: 980,
    blurb: 'Run experiments, read the numbers, and grow a product week over week.',
    skills: ['Experiments', 'SQL', 'Copy'],
  },
  {
    id: 'data', name: 'Data Analytics', x: -2, z: 4.5, openings: 1530,
    blurb: 'Turn messy tables into decisions a leadership team can act on Monday.',
    skills: ['SQL', 'Dashboards', 'Storytelling'],
  },
  {
    id: 'ops', name: "Founder's Office", x: -8.5, z: 4, openings: 610,
    blurb: 'Be the person who makes things happen across every team in a startup.',
    skills: ['Ops', 'Finance', 'Hiring'],
  },
];
