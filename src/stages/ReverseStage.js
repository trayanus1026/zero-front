import {
  BackSide, CatmullRomCurve3, Color, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial,
  Sprite, SpriteMaterial, TubeGeometry, Vector3,
} from 'three';
import { Stage } from './Stage.js';
import { clamp, damp, mulberry32, smoothstep } from '../utils/math.js';
import { createGlowTexture, createJobCardTexture } from '../utils/textures.js';

const SCREENS = 8;
const RADIUS = 3.2;

const JOBS = [
  { title: 'Product Designer', company: 'Series B fintech', chips: ['Flows', 'Prototyping'] },
  { title: 'AI Engineer', company: 'Applied AI lab', chips: ['RAG', 'Evals', 'Python'] },
  { title: 'Growth Lead', company: 'Consumer app', chips: ['Experiments', 'SQL'] },
  { title: 'Data Analyst', company: 'Logistics scale-up', chips: ['SQL', 'Dashboards'] },
  { title: 'Frontend Dev', company: 'Dev tools startup', chips: ['React', 'Perf'] },
  { title: 'Ops Associate', company: "Founder's office", chips: ['Ops', 'Finance'] },
  { title: 'Content Strategist', company: 'Media brand', chips: ['Writing', 'SEO'] },
  { title: 'Solutions Eng.', company: 'B2B SaaS', chips: ['APIs', 'Demos'] },
];

/** Chapter 4: travel a light tunnel lined with deconstructed job cards. */
export class ReverseStage extends Stage {
  post = { bloomStrength: 0.65, bloomRadius: 0.6, bloomThreshold: 0.7, vignette: 0.5, grain: 0.035 };

  async init() {
    const { scene, camera } = this;
    camera.fov = 62;

    const pts = [];
    for (let i = 0; i <= 10; i++) {
      pts.push(new Vector3(Math.sin(i * 0.9) * 4, Math.cos(i * 0.7) * 2.4, -i * 18));
    }
    this.curve = new CatmullRomCurve3(pts, false, 'centripetal');

    this.tunnelMaterial = new ShaderMaterial({
      side: BackSide,
      uniforms: {
        uTime: { value: 0 },
        uDark: { value: new Color('#06140f') },
        uMint: { value: new Color('#8fe0c2') },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vDepth;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uDark, uMint;
        varying vec2 vUv;
        varying float vDepth;
        const float PI = 3.14159265;
        void main() {
          float along = vUv.x;
          float around = vUv.y;
          float rings = pow(abs(sin(along * PI * 110.0)), 90.0);
          float rails = pow(abs(sin(around * PI * 12.0)), 120.0);
          float pulse = exp(-pow((fract(along * 3.0 - uTime * 0.12) - 0.5) * 18.0, 2.0));
          vec3 base = mix(uDark, uMint * 0.35, along * 0.6);
          vec3 col = base + uMint * (rings * (0.5 + pulse * 1.5) + rails * 0.35) * 1.4;
          col = mix(col, uDark, smoothstep(12.0, 48.0, vDepth));
          col += vec3(2.4) * smoothstep(0.93, 1.0, along);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    scene.add(new Mesh(new TubeGeometry(this.curve, 420, RADIUS, 48, false), this.tunnelMaterial));

    const rand = mulberry32(5);
    const cardGeo = new PlaneGeometry(1.7, 1.0);
    const up = new Vector3(0, 1, 0);
    this.cards = [];
    const count = 16;
    for (let i = 0; i < count; i++) {
      const t = 0.07 + (i / count) * 0.84;
      const p = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t);
      const side = new Vector3().crossVectors(tangent, up).normalize();
      const dir = i % 2 ? 1 : -1;
      const pos = p.clone()
        .addScaledVector(side, dir * (1.5 + rand() * 0.4))
        .addScaledVector(up, (rand() - 0.5) * 1.4);
      const mesh = new Mesh(cardGeo, new MeshBasicMaterial({
        map: createJobCardTexture(JOBS[i % JOBS.length]),
        transparent: true,
        depthWrite: false,
      }));
      mesh.position.copy(pos);
      mesh.lookAt(pos.clone().addScaledVector(tangent, -3).addScaledVector(side, -dir * 1.2));
      mesh.userData.t = t;
      scene.add(mesh);
      this.cards.push(mesh);
    }

    const end = new Sprite(new SpriteMaterial({
      map: createGlowTexture(), color: new Color(4, 4.2, 4), transparent: true, depthWrite: false,
    }));
    end.position.copy(this.curve.getPointAt(1));
    end.scale.setScalar(14);
    scene.add(end);

    this.tmpLook = new Vector3();
    this.reset();
  }

  reset() {
    super.reset();
    this.target = 0;
    this.velocity = 0;
    this.#place(0);
  }

  onScroll(delta) {
    this.target = clamp(this.target + delta / SCREENS);
  }

  #place(u) {
    const t = 0.005 + u * 0.93;
    this.camera.position.copy(this.curve.getPointAt(t));
    this.curve.getPointAt(Math.min(t + 0.025, 1), this.tmpLook);
  }

  update(dt, time) {
    const { camera, app } = this;
    const prev = this.progress;
    this.progress = damp(this.progress, this.target, 2.6, dt);
    this.velocity = damp(this.velocity, (this.progress - prev) / Math.max(dt, 1e-4), 6, dt);

    this.#place(this.progress);
    if (!app.reducedMotion) {
      camera.position.x += app.input.pointer.nx * 0.35;
      camera.position.y += app.input.pointer.ny * 0.25;
    }
    camera.lookAt(this.tmpLook);
    const fov = 62 + clamp(this.velocity * 120, 0, 18);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = damp(camera.fov, fov, 4, dt);
      camera.updateProjectionMatrix();
    }

    this.tunnelMaterial.uniforms.uTime.value = time;
    const camT = 0.005 + this.progress * 0.93;
    for (const c of this.cards) {
      const ahead = c.userData.t - camT;
      c.material.opacity = smoothstep(-0.005, 0.02, ahead) * (1 - smoothstep(0.12, 0.2, ahead));
      c.visible = c.material.opacity > 0.002;
    }

    if (this.progress > 0.985) this.complete();
  }
}
