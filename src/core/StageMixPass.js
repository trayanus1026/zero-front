import { Color, HalfFloatType, ShaderMaterial, WebGLRenderTarget } from 'three';
import { FullScreenQuad, Pass } from 'three/addons/postprocessing/Pass.js';
import { noiseGLSL } from '../utils/glsl.js';

/**
 * First pass of the composer. Renders the active stage straight into the
 * composer buffer, or — during a chapter change — renders both stages to
 * their own targets and dissolves between them with a glowing noise front.
 */
export class StageMixPass extends Pass {
  constructor({ samples = 4 } = {}) {
    super();
    const opts = { type: HalfFloatType, samples };
    this.rtA = new WebGLRenderTarget(1, 1, opts);
    this.rtB = new WebGLRenderTarget(1, 1, opts);
    this.current = null;
    this.from = null;
    this.to = null;

    this.material = new ShaderMaterial({
      uniforms: {
        tA: { value: this.rtA.texture },
        tB: { value: this.rtB.texture },
        uProgress: { value: 0 },
        uTime: { value: 0 },
        uEdgeColor: { value: new Color(1.6, 2.2, 1.9) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D tA, tB;
        uniform float uProgress, uTime;
        uniform vec3 uEdgeColor;
        varying vec2 vUv;
        ${noiseGLSL}
        void main() {
          float p = mix(-0.12, 1.12, uProgress);
          float n = fbm(vUv * 3.2 + vec2(0.0, uTime * 0.08));
          // Bias the front so it sweeps upward, like a tide rising.
          n = n * 0.75 + (1.0 - vUv.y) * 0.25;
          float showA = smoothstep(p - 0.06, p + 0.06, n);
          vec2 c = vUv - 0.5;
          vec4 a = texture2D(tA, 0.5 + c * (1.0 - uProgress * 0.06));
          vec4 b = texture2D(tB, 0.5 + c * (1.0 + (1.0 - uProgress) * 0.06));
          float edge = 1.0 - smoothstep(0.0, 0.05, abs(n - p));
          vec3 col = mix(b.rgb, a.rgb, showA) + uEdgeColor * edge * 0.6;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  get transitioning() {
    return Boolean(this.from && this.to);
  }

  beginTransition(from, to) {
    this.from = from;
    this.to = to;
    this.material.uniforms.uProgress.value = 0;
  }

  setTransitionProgress(p) {
    this.material.uniforms.uProgress.value = p;
  }

  endTransition() {
    this.current = this.to;
    this.from = null;
    this.to = null;
  }

  setSize(width, height) {
    this.rtA.setSize(width, height);
    this.rtB.setSize(width, height);
  }

  render(renderer, writeBuffer, _readBuffer, deltaTime) {
    const target = this.renderToScreen ? null : writeBuffer;
    if (this.transitioning) {
      this.material.uniforms.uTime.value += deltaTime ?? 0.016;
      renderer.setRenderTarget(this.rtA);
      renderer.render(this.from.scene, this.from.camera);
      renderer.setRenderTarget(this.rtB);
      renderer.render(this.to.scene, this.to.camera);
      renderer.setRenderTarget(target);
      this.quad.render(renderer);
    } else if (this.current) {
      renderer.setRenderTarget(target);
      renderer.render(this.current.scene, this.current.camera);
    }
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.material.dispose();
    this.quad.dispose();
  }
}
