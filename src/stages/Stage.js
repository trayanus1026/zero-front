import { PerspectiveCamera, Scene } from 'three';
import { Emitter } from '../utils/Emitter.js';
import { createBackdrop } from '../utils/backdrop.js';

/**
 * A chapter of the story: owns a scene + camera and reports `progress` (0..1)
 * which drives the narrative text. Calls `complete()` once its interaction
 * goal is met; the Experience decides what happens next.
 *
 * Lifecycle: init() once → [reset() → enter() → update()* → exit()]*
 */
export class Stage extends Emitter {
  /** Post-processing targets; the Experience eases toward these. */
  post = { bloomStrength: 0.35, bloomRadius: 0.55, bloomThreshold: 0.82, vignette: 0.35, grain: 0.035 };

  constructor(app, content) {
    super();
    this.app = app;
    this.content = content;
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(45, 1, 0.1, 300);
    this.active = false;
    this.completed = false;
    this.progress = 0;
    this.backdrop = createBackdrop(content.palette);
    this.scene.add(this.backdrop);
  }

  async init() {}

  reset() {
    this.completed = false;
    this.progress = 0;
  }

  enter() {
    this.active = true;
  }

  exit() {
    this.active = false;
  }

  // eslint-disable-next-line no-unused-vars
  update(dt, time) {}

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /* Input hooks — only called while the stage is the interactive one. */
  onScroll() {}
  onPointerDown() {}
  onPointerMove() {}
  onPointerUp() {}
  onHoldStart() {}
  onHoldEnd() {}

  complete() {
    if (this.completed) return;
    this.completed = true;
    this.emit('complete', this);
  }
}
