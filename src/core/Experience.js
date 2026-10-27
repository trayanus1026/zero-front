import { ACESFilmicToneMapping, SRGBColorSpace, Vector2, WebGLRenderer } from 'three';
import { Timer } from 'three/addons/misc/Timer.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { AudioEngine } from './Audio.js';
import { Input } from './Input.js';
import { StageMixPass } from './StageMixPass.js';
import { createFinishPass } from './FinishPass.js';
import { damp } from '../utils/math.js';

import { PromiseStage } from '../stages/PromiseStage.js';
import { FilterStage } from '../stages/FilterStage.js';
import { CostStage } from '../stages/CostStage.js';
import { ReverseStage } from '../stages/ReverseStage.js';
import { FieldStage } from '../stages/FieldStage.js';

import { Loader } from '../ui/Loader.js';
import { Hud } from '../ui/Hud.js';
import { NextButton } from '../ui/NextButton.js';
import { Narrative } from '../ui/Narrative.js';
import { Waitlist } from '../ui/Waitlist.js';
import { HubCard } from '../ui/HubCard.js';

/**
 * Owns the renderer, post stack, chapter state machine and UI wiring.
 * Stages never talk to each other or to the DOM chrome directly.
 */
export class Experience {
  constructor({ canvas, uiRoot, content }) {
    this.canvas = canvas;
    this.content = content;
    this.time = 0;
    this.index = -1;
    this.unlocked = 0;
    this.started = false;
    this.isMobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.#setupRenderer();
    this.audio = new AudioEngine();
    this.input = new Input(canvas);

    this.ui = { root: uiRoot, layer: document.createElement('div') };
    this.ui.layer.className = 'ui-layer';
    uiRoot.appendChild(this.ui.layer);

    this.stages = [
      new PromiseStage(this, content.stages[0]),
      new FilterStage(this, content.stages[1]),
      new CostStage(this, content.stages[2]),
      new ReverseStage(this, content.stages[3]),
      new FieldStage(this, content.stages[4], content.hubs),
    ];
    this.stages.forEach((stage, i) => stage.on('complete', () => this.#onStageComplete(i)));

    this.#setupUI(uiRoot);
    this.#bindInput();
    window.addEventListener('resize', this.#onResize);
    this.#onResize();
  }

  #setupRenderer() {
    const renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // MSAA happens in the composer's render targets
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    this.renderer = renderer;
    this.pixelRatio = Math.min(window.devicePixelRatio, this.isMobile ? 1.5 : 2);
    renderer.setPixelRatio(this.pixelRatio);

    const samples = this.isMobile ? 0 : 4;
    this.composer = new EffectComposer(renderer);
    this.composer.renderTarget1.samples = samples;
    this.composer.renderTarget2.samples = samples;

    this.mixPass = new StageMixPass({ samples });
    this.bloomPass = new UnrealBloomPass(new Vector2(256, 256), 0.35, 0.55, 0.82);
    this.outputPass = new OutputPass();
    this.finishPass = createFinishPass();
    this.composer.addPass(this.mixPass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(this.outputPass);
    this.composer.addPass(this.finishPass);

    this.post = { bloomStrength: 0.35, bloomRadius: 0.55, bloomThreshold: 0.82, vignette: 0.35, grain: 0.035 };
  }

  #setupUI(root) {
    const { brand, config, hubs } = this.content;
    this.hud = new Hud(root, { wordmark: brand.wordmark });
    this.narrative = new Narrative(root);
    this.nextButton = new NextButton(root, { duration: config.holdDurationMs });
    this.ui.hubCard = new HubCard(root);
    this.waitlist = new Waitlist(root, { brand, hubs, endpoint: config.waitlistEndpoint });

    this.scrollHint = document.createElement('div');
    this.scrollHint.className = 'scroll-hint';
    this.scrollHint.setAttribute('aria-hidden', 'true');
    this.scrollHint.innerHTML = '<span class="scroll-hint-line"></span><span>Scroll</span>';
    root.appendChild(this.scrollHint);

    this.cta = document.createElement('div');
    this.cta.className = 'final-cta';
    this.cta.innerHTML = `
      <span class="final-cta-text">Ready to grow?</span>
      <button type="button" class="final-cta-join">Join the waitlist</button>
      <button type="button" class="final-cta-replay">Replay</button>
    `;
    root.appendChild(this.cta);
    this.cta.querySelector('.final-cta-join').addEventListener('click', () => this.waitlist.open());
    this.cta.querySelector('.final-cta-replay').addEventListener('click', () => this.goTo(0));

    this.hud.on('audio', () => {
      this.audio.unlock();
      this.audio.setEnabled(!this.audio.enabled);
      this.hud.setAudio(this.audio.enabled);
      this.audio.play('click');
    });
    this.hud.on('waitlist', () => this.waitlist.open());
    this.hud.on('navigate', (i) => this.goTo(i));

    let holdSound = null;
    this.nextButton.on('holdstart', () => { holdSound = this.audio.loop('hold'); });
    this.nextButton.on('progress', (p) => holdSound?.set(p));
    this.nextButton.on('holdend', () => { holdSound?.stop(); holdSound = null; });
    this.nextButton.on('confirm', () => this.goTo(this.index + 1));

    this.ui.hubCard.on('start', (hub) => this.waitlist.open(hub.id));
    this.waitlist.on('joined', () => {
      if (this.awardedWaitlist) return;
      this.awardedWaitlist = true;
      this.hud.addXP(this.content.xpRewards.waitlist);
      this.audio.play('xp');
    });
    this.waitlist.on('replay', () => this.goTo(0));
    // While a dialog is open the canvas must not react to wheel/keys.
    this.waitlist.on('close', () => { this.input.enabled = this.started && !this.mixPass.transitioning; });
    this.waitlist.dialog.addEventListener('toggle', () => {
      if (this.waitlist.dialog.open) this.input.enabled = false;
    });
  }

  #bindInput() {
    const forward = (method) => (payload) => {
      const stage = this.stages[this.index];
      if (stage?.active && !this.mixPass.transitioning) stage[method](payload);
    };
    this.input.on('scroll', forward('onScroll'));
    this.input.on('pointerdown', forward('onPointerDown'));
    this.input.on('pointermove', forward('onPointerMove'));
    this.input.on('pointerup', forward('onPointerUp'));
    this.input.on('holdstart', forward('onHoldStart'));
    this.input.on('holdend', forward('onHoldEnd'));
  }

  /** Builds every stage up front and pre-compiles shaders, reporting 0..1. */
  async load(onProgress) {
    const steps = this.stages.length + 1;
    let done = 0;
    const tick = () => onProgress(++done / steps);

    await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]);
    tick();
    for (const stage of this.stages) {
      await stage.init();
      stage.resize(window.innerWidth, window.innerHeight);
      await this.renderer.compileAsync(stage.scene, stage.camera);
      tick();
      await new Promise((r) => requestAnimationFrame(r)); // keep the loader animating
    }

    // Show chapter 1 behind the loader so revealing it is seamless.
    this.index = 0;
    this.mixPass.current = this.stages[0];
    this.stages[0].reset();
    this.#applyPost(this.stages[0].post, true);
    this.timer = new Timer();
    this.renderer.setAnimationLoop(this.#frame);
  }

  run() {
    const { brand } = this.content;
    const loader = new Loader(this.ui.root, {
      wordmark: brand.wordmark,
      onBegin: () => this.#begin(),
    });
    this.load((p) => loader.setProgress(p))
      .then(() => loader.finish())
      .then(() => loader.showGate())
      .catch((err) => {
        console.error(err);
        loader.el.classList.add('is-error');
        loader.status.textContent = 'Something went wrong while loading. Please refresh.';
      });
  }

  #begin() {
    this.audio.unlock();
    this.audio.play('begin');
    this.audio.setAmbient(0);
    document.body.classList.remove('is-loading');
    this.started = true;
    this.input.enabled = true;
    this.hud.show();
    this.#enterStage(0);
  }

  #enterStage(i) {
    const stage = this.stages[i];
    const meta = this.content.stages[i];
    this.index = i;
    this.unlocked = Math.max(this.unlocked, i);
    stage.enter();
    this.narrative.setLines(meta.lines);
    this.hud.setStatus(meta.hint);
    this.hud.setTheme(meta.theme);
    this.hud.setChapters(this.content.stages, i, this.unlocked);
    this.scrollHint.classList.toggle('is-visible', meta.usesScroll);
    this.cta.classList.remove('is-visible');
    this.ui.hubCard.hide();
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', meta.palette.outer);
  }

  goTo(i) {
    if (i < 0 || i >= this.stages.length || this.mixPass.transitioning || !this.started) return;
    if (i === this.index) {
      this.stages[i].reset();
      this.#enterStage(i);
      return;
    }
    const from = this.stages[this.index];
    const to = this.stages[i];
    this.nextButton.hide();
    this.waitlist.close();
    this.input.enabled = false;
    from.onHoldEnd();

    to.reset();
    to.resize(window.innerWidth, window.innerHeight);
    this.mixPass.beginTransition(from, to);
    this.audio.play('whoosh');
    this.audio.setAmbient(i);
    this.hud.setStatus('');
    this.narrative.setLines([]);
    this.scrollHint.classList.remove('is-visible');

    // Advanced by the render loop's clock so it stays in lockstep with the
    // stages it is blending, even when frames are slow.
    this.transition = { from, index: i, t: 0, duration: this.reducedMotion ? 0.6 : 1.8 };
    this.#applyPost(to.post);
  }

  #advanceTransition(dt) {
    const tr = this.transition;
    tr.t = Math.min(1, tr.t + dt / tr.duration);
    const eased = tr.t < 0.5 ? 2 * tr.t * tr.t : 1 - (-2 * tr.t + 2) ** 2 / 2;
    this.mixPass.setTransitionProgress(eased);
    if (tr.t < 1) return;
    this.transition = null;
    tr.from.exit();
    this.mixPass.endTransition();
    this.input.enabled = !this.waitlist.dialog.open;
    this.#enterStage(tr.index);
  }

  #onStageComplete(i) {
    if (i !== this.index) return;
    const reward = this.content.xpRewards.stage[i] ?? 0;
    if (reward && !this.stages[i].rewarded) {
      this.stages[i].rewarded = true;
      this.hud.addXP(reward);
      this.audio.play('xp');
    }
    if (i < this.stages.length - 1) {
      this.unlocked = Math.max(this.unlocked, i + 1);
      this.hud.setChapters(this.content.stages, i, this.unlocked);
      this.scrollHint.classList.remove('is-visible');
      this.hud.setStatus('');
      setTimeout(() => {
        if (this.index === i && !this.mixPass.transitioning) this.nextButton.show();
      }, 600);
    } else {
      this.cta.classList.add('is-visible');
    }
  }

  #applyPost(target, instant = false) {
    this.postTarget = target;
    if (instant) Object.assign(this.post, target);
  }

  #frame = (timestamp) => {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 1 / 20);
    this.time += dt;

    const active = this.mixPass.transitioning ? [this.mixPass.from, this.mixPass.to] : [this.stages[this.index]];
    for (const stage of active) stage.update(dt, this.time);
    if (this.transition) this.#advanceTransition(dt);

    const current = this.stages[this.index];
    if (this.started && !this.mixPass.transitioning) {
      this.narrative.update(current.progress);
      if (this.content.stages[this.index].usesScroll && current.progress > 0.03) {
        this.scrollHint.classList.remove('is-visible');
      }
    }

    // Ease post-processing toward the active chapter's look.
    const p = this.post;
    const t = this.postTarget;
    for (const key of ['bloomStrength', 'bloomRadius', 'bloomThreshold', 'vignette', 'grain']) {
      p[key] = damp(p[key], t[key], 2.5, dt);
    }
    this.bloomPass.strength = p.bloomStrength;
    this.bloomPass.radius = p.bloomRadius;
    this.bloomPass.threshold = p.bloomThreshold;
    const fu = this.finishPass.uniforms;
    fu.uTime.value = this.time;
    fu.uVignette.value = p.vignette;
    fu.uGrain.value = p.grain;

    this.composer.render(dt);
  };

  #onResize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.stages.forEach((s) => s.resize(w, h));
  };
}
