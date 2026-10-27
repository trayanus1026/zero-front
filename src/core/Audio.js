// Fully synthesized sound design (Web Audio): ambient pads per chapter plus
// one-shot and looping effects. No audio files to download.

const CHORDS = [
  [110.0, 164.81, 220.0, 329.63],
  [98.0, 146.83, 196.0, 293.66],
  [87.31, 130.81, 174.61, 261.63],
  [123.47, 185.0, 246.94, 369.99],
  [130.81, 196.0, 261.63, 392.0],
];

const MASTER_LEVEL = 0.85;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.ambient = null;
    this.ambientIndex = -1;
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? MASTER_LEVEL : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else ctx.resume();
    });
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? MASTER_LEVEL : 0, t, 0.15);
  }

  setAmbient(index) {
    if (!this.ctx || index === this.ambientIndex) return;
    this.ambientIndex = index;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    if (this.ambient) {
      const old = this.ambient;
      old.gain.gain.setTargetAtTime(0, t, 0.8);
      setTimeout(() => old.nodes.forEach((n) => n.stop()), 5000);
    }

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.11, t, 1.4);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.7;
    filter.connect(gain).connect(this.master);

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 350;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();

    const nodes = [lfo];
    CHORDS[index % CHORDS.length].forEach((freq, i) => {
      for (const detune of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = i % 2 ? 'triangle' : 'sine';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.value = 0.22 / (i + 1);
        osc.connect(g).connect(filter);
        osc.start();
        nodes.push(osc);
      }
    });
    this.ambient = { gain, nodes };
  }

  #noiseSource() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    return src;
  }

  #tone(freq, { type = 'sine', at = 0, attack = 0.005, decay = 0.2, gain = 0.1, to } = {}) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + attack + decay + 0.05);
  }

  #noiseBurst({ type = 'highpass', freq = 1000, to, q = 0.8, gain = 0.3, attack = 0.005, decay = 0.4, at = 0 }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const src = this.#noiseSource();
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (to) filter.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  }

  play(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'click':
        this.#tone(1100, { to: 620, decay: 0.07, gain: 0.08 });
        break;
      case 'tick':
        this.#tone(2400, { decay: 0.025, gain: 0.025 });
        break;
      case 'begin':
        this.#tone(55, { attack: 0.4, decay: 2.2, gain: 0.25 });
        this.#noiseBurst({ type: 'lowpass', freq: 200, to: 3000, attack: 0.6, decay: 1.4, gain: 0.18 });
        break;
      case 'whoosh':
        this.#noiseBurst({ type: 'bandpass', freq: 300, to: 2600, q: 1.4, attack: 0.5, decay: 0.9, gain: 0.32 });
        break;
      case 'crack':
        this.#noiseBurst({ freq: 2200, decay: 0.12, gain: 0.5 });
        this.#tone(3400, { decay: 0.09, gain: 0.05 });
        break;
      case 'shatter':
        this.#noiseBurst({ freq: 1400, decay: 1.3, gain: 0.55 });
        this.#noiseBurst({ type: 'lowpass', freq: 400, decay: 0.5, gain: 0.4 });
        for (let i = 0; i < 12; i++) {
          this.#tone(2500 + Math.random() * 4500, { at: Math.random() * 0.7, decay: 0.25, gain: 0.04 });
        }
        break;
      case 'ripple':
        this.#tone(380 + Math.random() * 200, { type: 'triangle', to: 190, decay: 0.6, gain: 0.07 });
        break;
      case 'xp':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
          this.#tone(f, { type: 'triangle', at: i * 0.07, decay: 0.3, gain: 0.07 })
        );
        break;
      default:
        break;
    }
  }

  /** Continuous sounds driven by a 0..1 value. Returns a controller. */
  loop(name) {
    if (!this.ctx) return { set() {}, stop() {} };
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.master);
    const sources = [];

    if (name === 'burn') {
      const src = this.#noiseSource();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900;
      // Amplitude-modulate with very slow noise for a crackling texture.
      const mod = this.#noiseSource();
      const modLp = ctx.createBiquadFilter();
      modLp.type = 'lowpass';
      modLp.frequency.value = 18;
      const modGain = ctx.createGain();
      modGain.gain.value = 2.5;
      const crackle = ctx.createGain();
      crackle.gain.value = 0.6;
      mod.connect(modLp).connect(modGain).connect(crackle.gain);
      src.connect(lp).connect(crackle).connect(out);
      src.start();
      mod.start(0, 0.7);
      sources.push(src, mod);
    } else if (name === 'hold') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 220;
      osc.connect(out);
      osc.start();
      sources.push(osc);
      out.frequency = osc.frequency;
    }

    const peak = name === 'burn' ? 0.35 : 0.05;
    return {
      set: (v) => {
        const t = ctx.currentTime;
        out.gain.setTargetAtTime(v * peak, t, 0.06);
        if (out.frequency) out.frequency.setTargetAtTime(220 + v * 440, t, 0.05);
      },
      stop: () => {
        out.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
        setTimeout(() => sources.forEach((s) => s.stop()), 600);
      },
    };
  }
}
