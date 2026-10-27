import {
  Color, DirectionalLight, DoubleSide, Fog, HemisphereLight, Mesh, MeshStandardMaterial,
  PlaneGeometry, Sprite, SpriteMaterial,
} from 'three';
import { Stage } from './Stage.js';
import { clamp, damp, mulberry32, smoothstep } from '../utils/math.js';
import { createCertificateTexture, createCloudTexture, createGlowTexture } from '../utils/textures.js';

const PATH = 100;
const SCREENS = 7; // viewport-heights of scrolling to finish the chapter
const START_Z = 8;

/** Chapter 1: drift through a sky of clouds and floating certificates. */
export class PromiseStage extends Stage {
  post = { bloomStrength: 0.3, bloomRadius: 0.6, bloomThreshold: 0.85, vignette: 0.3, grain: 0.03 };

  async init() {
    const { scene, camera, content, app } = this;
    camera.fov = 55;
    scene.fog = new Fog(new Color(content.palette.fog), 18, 85);
    scene.add(new HemisphereLight(0xffffff, 0x2d6b58, 1.7));
    const sun = new DirectionalLight(0xffffff, 1.6);
    sun.position.set(3, 6, 4);
    scene.add(sun);

    const rand = mulberry32(7);
    const cloudTex = createCloudTexture();
    this.clouds = [];
    const count = app.isMobile ? 70 : 120;
    for (let i = 0; i < count; i++) {
      const material = new SpriteMaterial({
        map: cloudTex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        rotation: rand() * Math.PI * 2,
        color: new Color().setHSL(0.42, 0.25, 0.92 + rand() * 0.08),
      });
      const sprite = new Sprite(material);
      // Keep a clear corridor down the middle for the camera.
      const a = rand() * Math.PI * 2;
      const r = 2.6 + rand() * 11;
      sprite.position.set(Math.cos(a) * r * 1.5, Math.sin(a) * r * 0.65 - 0.6, START_Z - 6 - rand() * (PATH + 10));
      sprite.scale.setScalar(5 + rand() * 9);
      sprite.userData.baseOpacity = 0.12 + rand() * 0.3;
      scene.add(sprite);
      this.clouds.push(sprite);
    }

    const certTex = createCertificateTexture();
    const certGeo = new PlaneGeometry(1.6, 1.13);
    const certMat = new MeshStandardMaterial({ map: certTex, side: DoubleSide, roughness: 0.85 });
    this.certificates = [];
    for (let i = 0; i < 46; i++) {
      const mesh = new Mesh(certGeo, certMat);
      const a = rand() * Math.PI * 2;
      const r = 1.4 + rand() * 5;
      mesh.position.set(Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.7, START_Z - 8 - (i / 46) * PATH);
      mesh.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      mesh.userData.spin = [(rand() - 0.5) * 0.6, (rand() - 0.5) * 0.6, (rand() - 0.5) * 0.3];
      mesh.userData.bob = rand() * Math.PI * 2;
      mesh.userData.baseY = mesh.position.y;
      scene.add(mesh);
      this.certificates.push(mesh);
    }

    // A bright opening at the end of the path, bright enough to bloom.
    const glow = new Sprite(new SpriteMaterial({
      map: createGlowTexture(), color: new Color(3, 3.2, 3), transparent: true, depthWrite: false, fog: false,
    }));
    glow.position.set(0, 0, START_Z - PATH - 25);
    glow.scale.setScalar(40);
    scene.add(glow);

    this.reset();
  }

  reset() {
    super.reset();
    this.target = 0;
    this.camera.position.set(0, 0, START_Z);
    this.lookX = 0;
    this.lookY = 0;
  }

  onScroll(delta) {
    this.target = clamp(this.target + delta / SCREENS);
  }

  update(dt, time) {
    const { camera, app } = this;
    this.progress = damp(this.progress, this.target, 3.2, dt);

    const px = app.reducedMotion ? 0 : app.input.pointer.nx;
    const py = app.reducedMotion ? 0 : app.input.pointer.ny;
    camera.position.z = START_Z - this.progress * PATH;
    camera.position.x = damp(camera.position.x, px * 0.8, 2, dt);
    camera.position.y = damp(camera.position.y, py * 0.45 + Math.sin(time * 0.3) * 0.08, 2, dt);
    this.lookX = damp(this.lookX, px * 0.35, 2, dt);
    this.lookY = damp(this.lookY, py * 0.25, 2, dt);
    camera.lookAt(camera.position.x * 0.4 + this.lookX, camera.position.y * 0.4 + this.lookY, camera.position.z - 12);

    const cz = camera.position.z;
    for (const c of this.clouds) {
      const d = cz - c.position.z; // distance ahead of the camera
      c.material.opacity = c.userData.baseOpacity * smoothstep(3, 14, d) * (1 - smoothstep(55, 85, d));
      c.visible = c.material.opacity > 0.002;
    }
    for (const m of this.certificates) {
      const [sx, sy, sz] = m.userData.spin;
      m.rotation.x += sx * dt;
      m.rotation.y += sy * dt;
      m.rotation.z += sz * dt;
      m.position.y = m.userData.baseY + Math.sin(time * 0.6 + m.userData.bob) * 0.15;
    }

    if (this.progress > 0.985) this.complete();
  }
}
