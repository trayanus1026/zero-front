import { Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';
import { noiseGLSL } from './glsl.js';

/**
 * Screen-space radial gradient rendered behind everything in a scene.
 * Ignores the camera entirely, so it never moves or clips.
 */
export function createBackdrop(palette) {
  const material = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uInner: { value: new Color(palette.inner) },
      uMid: { value: new Color(palette.mid) },
      uOuter: { value: new Color(palette.outer) },
      uCenter: { value: new Vector2(...palette.center) },
      uRadius: { value: new Vector2(...palette.radius) },
      uAspect: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInner, uMid, uOuter;
      uniform vec2 uCenter, uRadius;
      varying vec2 vUv;
      ${noiseGLSL}
      void main() {
        float d = length((vUv - uCenter) / uRadius);
        vec3 col = mix(uInner, uMid, smoothstep(0.12, 0.55, d));
        col = mix(col, uOuter, smoothstep(0.55, 1.0, d));
        // Dither to kill banding in long, low-contrast gradients.
        col += (hash12(gl_FragCoord.xy) - 0.5) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
