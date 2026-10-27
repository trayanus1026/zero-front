import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

/** Display-referred finishing: subtle chromatic fringe, vignette, film grain. */
export function createFinishPass() {
  return new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uVignette: { value: 0.35 },
      uGrain: { value: 0.035 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime, uVignette, uGrain;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec2 c = vUv - 0.5;
        float r2 = dot(c, c);
        vec2 off = c * r2 * 0.012;
        vec3 col = vec3(
          texture2D(tDiffuse, vUv + off).r,
          texture2D(tDiffuse, vUv).g,
          texture2D(tDiffuse, vUv - off).b
        );
        float vig = smoothstep(0.85, 0.15, length(c * vec2(1.0, 0.85)));
        col *= mix(1.0, vig, uVignette);
        col += (hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5) * uGrain;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
}
