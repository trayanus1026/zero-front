import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, PlaneGeometry,
  Points, PointLight, ShaderMaterial, Vector2,
} from 'three';
import { Stage } from './Stage.js';
import { clamp, damp, mulberry32 } from '../utils/math.js';
import { noiseGLSL } from '../utils/glsl.js';
import { createBanknoteTexture } from '../utils/textures.js';

const NOTE_COUNT = 18;
const BURN_RATE = 0.2; // fraction of the chapter burned per held second
const CAM_Z = 7;

/** Chapter 3: press and hold to burn a cloud of banknotes into embers. */
export class CostStage extends Stage {
  post = { bloomStrength: 0.7, bloomRadius: 0.65, bloomThreshold: 0.75, vignette: 0.55, grain: 0.04 };

  async init() {
    const { scene, camera, app } = this;
    camera.fov = 45;
    const rand = mulberry32(42);

    const textures = [1, 2, 3].map((s) => createBanknoteTexture(s));
    const geometry = new PlaneGeometry(2.2, 1.03, 24, 8);
    this.notes = [];
    for (let i = 0; i < NOTE_COUNT; i++) {
      const material = new ShaderMaterial({
        side: DoubleSide,
        uniforms: {
          map: { value: textures[i % textures.length] },
          uBurn: { value: 0 },
          uSeed: { value: rand() * 10 },
          uTime: { value: 0 },
          uOrigin: { value: new Vector2(rand(), rand()) },
          uHeat: { value: 0 },
        },
        vertexShader: /* glsl */ `
          uniform float uTime, uSeed, uBurn;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            vec3 p = position;
            // Paper curl, which tightens as the note burns.
            p.z += sin(p.x * 1.6 + uTime * 0.9 + uSeed) * (0.06 + uBurn * 0.12);
            p.z += cos(p.y * 2.2 + uTime * 0.7 + uSeed) * 0.04;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D map;
          uniform float uBurn, uSeed, uHeat;
          uniform vec2 uOrigin;
          varying vec2 vUv;
          ${noiseGLSL}
          void main() {
            vec4 tex = texture2D(map, vUv);
            float n = fbm(vUv * vec2(5.0, 2.4) + uSeed * 13.0);
            float f = n * 0.55 + length((vUv - uOrigin) * vec2(2.1, 1.0)) * 0.42;
            float e = (uBurn * 1.35 - 0.12) - f; // > 0 means burned away
            if (e > 0.05) discard;
            vec3 col = tex.rgb * (gl_FrontFacing ? 1.0 : 0.72);
            col = mix(col, vec3(0.04, 0.025, 0.02), smoothstep(-0.12, 0.0, e));
            float glow = 1.0 - smoothstep(0.0, 0.03, abs(e - 0.025));
            col += vec3(5.0, 1.7, 0.35) * glow * step(0.001, uBurn);
            col += vec3(0.25, 0.08, 0.02) * uHeat;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      });
      const mesh = new Mesh(geometry, material);
      const a = (i / NOTE_COUNT) * Math.PI * 2;
      mesh.userData = {
        base: [Math.cos(a) * (0.6 + rand() * 2.6), Math.sin(a) * (0.4 + rand() * 1.2), -rand() * 3],
        rot: [rand() * 0.6 - 0.3, rand() * 1 - 0.5, rand() * Math.PI],
        phase: rand() * Math.PI * 2,
        delay: rand() * 0.55,
      };
      scene.add(mesh);
      this.notes.push(mesh);
    }

    // Embers: GPU-animated looping particles; intensity follows the burn.
    const emberCount = app.isMobile ? 350 : 700;
    const seeds = new Float32Array(emberCount * 3);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rand();
    const emberGeo = new BufferGeometry();
    emberGeo.setAttribute('position', new BufferAttribute(new Float32Array(emberCount * 3), 3));
    emberGeo.setAttribute('aSeed', new BufferAttribute(seeds, 3));
    this.embers = new Points(emberGeo, new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uPixelRatio: { value: app.renderer.getPixelRatio() },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aSeed;
        uniform float uTime, uIntensity, uPixelRatio;
        varying float vAlpha;
        void main() {
          float life = fract(uTime * (0.12 + aSeed.x * 0.18) + aSeed.y);
          vec3 p = vec3((aSeed.y - 0.5) * 8.0, -2.5 + life * 7.0, (aSeed.z - 0.5) * 3.0);
          p.x += sin(life * 6.0 + aSeed.z * 20.0) * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + aSeed.x * 5.0) * (1.0 - life) * uPixelRatio * (8.0 / -mv.z);
          vAlpha = smoothstep(0.0, 0.08, life) * (1.0 - life) * uIntensity;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        void main() {
          float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vAlpha;
          gl_FragColor = vec4(vec3(3.0, 1.1, 0.3) * a, a);
        }
      `,
    }));
    this.embers.frustumCulled = false;
    scene.add(this.embers);

    this.fireLight = new PointLight(new Color('#ff7a2e'), 0, 12);
    this.fireLight.position.set(0, -1, 2);
    scene.add(this.fireLight);
    this.reset();
  }

  reset() {
    super.reset();
    this.burn = 0;
    this.holding = false;
    this.heat = 0;
    this.camera.position.set(0, 0, CAM_Z);
    for (const n of this.notes) n.visible = true;
  }

  exit() {
    super.exit();
    this.onHoldEnd();
  }

  onHoldStart() {
    if (this.completed || this.holding) return;
    this.holding = true;
    this.burnSound = this.app.audio.loop('burn');
  }

  onHoldEnd() {
    if (!this.holding) return;
    this.holding = false;
    this.burnSound?.stop();
    this.burnSound = null;
  }

  update(dt, time) {
    const { camera, app } = this;
    if (this.holding) this.burn = clamp(this.burn + dt * BURN_RATE);
    this.progress = this.burn;
    this.heat = damp(this.heat, this.holding ? 1 : 0, 4, dt);
    this.burnSound?.set(this.heat);

    const px = app.reducedMotion ? 0 : app.input.pointer.nx;
    const py = app.reducedMotion ? 0 : app.input.pointer.ny;
    camera.position.x = damp(camera.position.x, px * 0.5, 2.5, dt);
    camera.position.y = damp(camera.position.y, py * 0.3, 2.5, dt);
    camera.position.z = damp(camera.position.z, CAM_Z - this.heat * 1.4, 2.5, dt);
    camera.lookAt(0, 0, -1);

    const shake = this.heat * 0.02;
    for (const n of this.notes) {
      const { base, rot, phase, delay } = n.userData;
      const local = clamp((this.burn * 1.6 - delay) / 1.0);
      n.material.uniforms.uBurn.value = local;
      n.material.uniforms.uTime.value = time;
      n.material.uniforms.uHeat.value = this.heat;
      n.visible = local < 1;
      n.position.set(
        base[0] + Math.sin(time * 0.35 + phase) * 0.25 + (Math.random() - 0.5) * shake,
        base[1] + Math.cos(time * 0.45 + phase) * 0.2 + local * 0.8,
        base[2]
      );
      n.rotation.set(rot[0] + Math.sin(time * 0.3 + phase) * 0.15, rot[1], rot[2] + time * 0.05);
    }

    const em = this.embers.material.uniforms;
    em.uTime.value = time;
    em.uIntensity.value = 0.15 + this.heat * 1.2 * (1 - this.burn * 0.6);
    this.fireLight.intensity = this.heat * (6 + Math.sin(time * 23) * 1.2 + Math.sin(time * 37) * 0.8);

    if (this.burn >= 1) {
      this.onHoldEnd();
      this.complete();
    }
  }
}
