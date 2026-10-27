import './styles.css';
import * as content from './content.js';
import { Experience } from './core/Experience.js';
import { renderFallback } from './ui/Fallback.js';

function hasWebGL2() {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

const canvas = document.getElementById('webgl');
const uiRoot = document.getElementById('ui');

if (hasWebGL2()) {
  const experience = new Experience({ canvas, uiRoot, content });
  experience.run();
  if (import.meta.env.DEV) window.experience = experience;
} else {
  canvas.remove();
  renderFallback(uiRoot, content);
}
