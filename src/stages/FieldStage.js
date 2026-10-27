import {
  Color, CylinderGeometry, DirectionalLight, Group, HemisphereLight, IcosahedronGeometry, InstancedMesh,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Plane, PlaneGeometry, Raycaster, RingGeometry,
  ConeGeometry, ShaderMaterial, SphereGeometry, Vector2, Vector3, Vector4,
} from 'three';
import { Stage } from './Stage.js';
import { clamp, damp, easeOutBack, mulberry32 } from '../utils/math.js';
import { noiseGLSL } from '../utils/glsl.js';

const MAX_RIPPLES = 8;
const PAN_LIMIT = 9;
const FIELD_R = 17;

/** Chapter 5: a living field of role clusters you can explore and pick from. */
export class FieldStage extends Stage {
  post = { bloomStrength: 0.18, bloomRadius: 0.4, bloomThreshold: 0.95, vignette: 0.2, grain: 0.025 };

  constructor(app, content, hubs) {
    super(app, content);
    this.hubs = hubs;
  }

  async init() {
    const { scene, camera, app } = this;
    camera.fov = 35;
    camera.far = 200;
    scene.add(new HemisphereLight(0xffffff, 0x9cc9b4, 1.5));
    const sun = new DirectionalLight(0xfff6e8, 2);
    sun.position.set(-6, 12, 8);
    scene.add(sun);

    this.ripples = Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, -100, 0));
    this.rippleIndex = 0;
    this.groundMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uRipples: { value: this.ripples },
        uA: { value: new Color('#9fd3b6') },
        uB: { value: new Color('#c9ead6') },
        uBg: { value: new Color(this.content.palette.mid) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorld;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec4 uRipples[${MAX_RIPPLES}];
        uniform vec3 uA, uB, uBg;
        varying vec3 vWorld;
        ${noiseGLSL}
        void main() {
          vec2 p = vWorld.xz;
          float n = fbm(p * 0.11 + 3.0);
          vec3 col = mix(uA, uB, smoothstep(0.3, 0.7, n));
          col *= 0.94 + 0.06 * vnoise(p * 2.5);
          float ring = 0.0;
          for (int i = 0; i < ${MAX_RIPPLES}; i++) {
            vec4 r = uRipples[i];
            float age = uTime - r.z;
            if (age > 0.0 && age < 3.5) {
              float w = length(p - r.xy) - age * 4.0;
              ring += exp(-w * w * 3.0) * (1.0 - age / 3.5) * r.w;
            }
          }
          col += vec3(1.0, 1.0, 0.95) * ring * 0.45;
          col = mix(col, uBg, smoothstep(${(FIELD_R - 2).toFixed(1)}, ${(FIELD_R + 10).toFixed(1)}, length(p)));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.ground = new Mesh(new PlaneGeometry(90, 90).rotateX(-Math.PI / 2), this.groundMaterial);
    scene.add(this.ground);

    // Sprouts and blooms grow outward in a wave when the chapter opens.
    const rand = mulberry32(99);
    const sproutCount = app.isMobile ? 700 : 1500;
    const sproutGeo = new ConeGeometry(0.05, 0.5, 5).translate(0, 0.25, 0);
    this.sprouts = new InstancedMesh(sproutGeo, new MeshStandardMaterial({ roughness: 0.8 }), sproutCount);
    this.bloomsMesh = null;
    this.growth = [];
    const color = new Color();
    for (let i = 0; i < sproutCount; i++) {
      const r = Math.sqrt(rand()) * FIELD_R;
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      this.growth.push({ x, z, h: 0.6 + rand() * 1.2, tilt: (rand() - 0.5) * 0.4, yaw: rand() * 6.28, delay: r / FIELD_R * 1.6 + rand() * 0.3 });
      this.sprouts.setColorAt(i, color.setHSL(0.36 + rand() * 0.08, 0.45, 0.32 + rand() * 0.2));
    }
    scene.add(this.sprouts);

    const bloomPalette = ['#ffffff', '#ffd6c9', '#ff8f6b', '#f6e58d', '#9fe6c9'].map((c) => new Color(c));
    const bloomCount = 160;
    this.blooms = new InstancedMesh(new IcosahedronGeometry(0.13, 1), new MeshStandardMaterial({ roughness: 0.5 }), bloomCount);
    this.bloomData = [];
    for (let i = 0; i < bloomCount; i++) {
      const g = this.growth[Math.floor(rand() * this.growth.length)];
      this.bloomData.push({ g, s: 0.7 + rand() * 0.8 });
      this.blooms.setColorAt(i, bloomPalette[i % bloomPalette.length]);
    }
    scene.add(this.blooms);
    this.dummy = new Object3D();

    // Hub pins.
    const stemGeo = new CylinderGeometry(0.03, 0.03, 1.6, 8).translate(0, 0.8, 0);
    const headGeo = new SphereGeometry(0.26, 24, 16);
    const ringGeo = new RingGeometry(0.42, 0.5, 48).rotateX(-Math.PI / 2);
    this.pins = this.hubs.map((hub) => {
      const group = new Group();
      group.position.set(hub.x, 0, hub.z);
      const stem = new Mesh(stemGeo, new MeshStandardMaterial({ color: '#ffffff' }));
      const head = new Mesh(headGeo, new MeshStandardMaterial({
        color: '#ff7a59', emissive: '#ff5a36', emissiveIntensity: 0.35, roughness: 0.35,
      }));
      head.position.y = 1.7;
      head.userData.hub = hub;
      const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#ff7a59', transparent: true, depthWrite: false }));
      ring.position.y = 0.02;
      group.add(stem, head, ring);
      scene.add(group);
      return { hub, group, head, ring, label: null, hover: 0 };
    });

    this.raycaster = new Raycaster();
    this.groundPlane = new Plane(new Vector3(0, 1, 0), 0);
    this.tmp = new Vector3();
    this.reset();
  }

  reset() {
    super.reset();
    this.enterTime = this.app.time;
    this.growthDone = false;
    this.target = new Vector2(0, 2);
    this.focus = new Vector2(0, 2);
    this.distance = 30;
    this.distanceTarget = 22;
    this.dragging = false;
    this.selected = null;
    this.ripples.forEach((r) => r.set(0, 0, -100, 0));
  }

  enter() {
    super.enter();
    this.enterTime = this.app.time;
    this.#buildLabels();
  }

  exit() {
    super.exit();
    this.labelLayer?.remove();
    this.labelLayer = null;
    this.app.canvas.style.cursor = '';
  }

  #buildLabels() {
    this.labelLayer?.remove();
    const layer = document.createElement('div');
    layer.className = 'hub-layer';
    for (const pin of this.pins) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hub-label';
      btn.innerHTML = `<span class="hub-name"></span><span class="hub-count"></span>`;
      btn.querySelector('.hub-name').textContent = pin.hub.name;
      btn.querySelector('.hub-count').textContent = `${pin.hub.openings.toLocaleString()} open roles`;
      btn.setAttribute('aria-label', `${pin.hub.name}: ${pin.hub.openings} open roles. Show details.`);
      btn.addEventListener('click', () => this.#select(pin));
      btn.addEventListener('pointerenter', () => { pin.hovered = true; });
      btn.addEventListener('pointerleave', () => { pin.hovered = false; });
      layer.appendChild(btn);
      pin.label = btn;
    }
    this.app.ui.layer.appendChild(layer);
    this.labelLayer = layer;
  }

  #select(pin) {
    this.selected = pin;
    this.target.set(pin.hub.x, pin.hub.z + 2);
    this.distanceTarget = 16;
    this.#ripple(pin.hub.x, pin.hub.z, 1.4);
    this.app.audio.play('click');
    this.app.ui.hubCard.show(pin.hub);
    this.progress = 1;
  }

  #ripple(x, z, strength = 1) {
    this.ripples[this.rippleIndex].set(x, z, this.app.time, strength);
    this.rippleIndex = (this.rippleIndex + 1) % MAX_RIPPLES;
  }

  #ndc(pointer) {
    return new Vector2(pointer.nx, pointer.ny);
  }

  onScroll(delta) {
    this.distanceTarget = clamp(this.distanceTarget + delta * 14, 13, 30);
  }

  onPointerDown(pointer) {
    this.dragging = true;
    this.dragLast = { x: pointer.x, y: pointer.y };
    this.app.canvas.style.cursor = 'grabbing';
  }

  onPointerMove(pointer) {
    if (this.dragging && this.dragLast) {
      const scale = this.distance / window.innerHeight * 1.1;
      this.target.x = clamp(this.target.x - (pointer.x - this.dragLast.x) * scale, -PAN_LIMIT, PAN_LIMIT);
      this.target.y = clamp(this.target.y - (pointer.y - this.dragLast.y) * scale, -PAN_LIMIT, PAN_LIMIT);
      this.dragLast = { x: pointer.x, y: pointer.y };
      return;
    }
    this.raycaster.setFromCamera(this.#ndc(pointer), this.camera);
    const hit = this.raycaster.intersectObjects(this.pins.map((p) => p.head), false)[0];
    for (const p of this.pins) p.hovered3d = hit?.object === p.head;
    this.app.canvas.style.cursor = hit ? 'pointer' : 'grab';
  }

  onPointerUp(pointer) {
    this.dragging = false;
    this.app.canvas.style.cursor = 'grab';
    if (!pointer.wasClick) return;
    this.raycaster.setFromCamera(this.#ndc(pointer), this.camera);
    const hit = this.raycaster.intersectObjects(this.pins.map((p) => p.head), false)[0];
    if (hit) {
      this.#select(this.pins.find((p) => p.head === hit.object));
      return;
    }
    if (this.raycaster.ray.intersectPlane(this.groundPlane, this.tmp)) {
      this.#ripple(this.tmp.x, this.tmp.z);
      this.app.audio.play('ripple');
      this.app.ui.hubCard.hide();
    }
  }

  update(dt, time) {
    const { camera, app } = this;
    const since = time - this.enterTime;

    this.focus.x = damp(this.focus.x, this.target.x, 3, dt);
    this.focus.y = damp(this.focus.y, this.target.y, 3, dt);
    this.distance = damp(this.distance, this.distanceTarget, 2, dt);
    const sway = app.reducedMotion ? 0 : Math.sin(time * 0.15) * 0.04;
    const phi = 0.95 + sway; // angle from vertical
    const theta = (app.reducedMotion ? 0 : app.input.pointer.nx * 0.08) + sway;
    camera.position.set(
      this.focus.x + Math.sin(theta) * Math.sin(phi) * this.distance,
      Math.cos(phi) * this.distance,
      this.focus.y + Math.cos(theta) * Math.sin(phi) * this.distance
    );
    camera.lookAt(this.focus.x, 0, this.focus.y - 1.5);
    this.groundMaterial.uniforms.uTime.value = time;

    if (!this.growthDone) this.#updateGrowth(since);

    for (const pin of this.pins) {
      const hovered = pin.hovered || pin.hovered3d || this.selected === pin;
      pin.hover = damp(pin.hover, hovered ? 1 : 0, 8, dt);
      const appear = easeOutBack(clamp((since - 1.2 - pin.hub.x * 0.02) / 0.7));
      pin.group.scale.setScalar(Math.max(0.0001, appear));
      pin.head.position.y = 1.7 + Math.sin(time * 1.6 + pin.hub.x) * 0.06 + pin.hover * 0.15;
      pin.head.material.emissiveIntensity = 0.35 + pin.hover * 0.6;
      const loop = (time * 0.6 + pin.hub.z * 0.1) % 1;
      pin.ring.scale.setScalar(1 + loop * 2.2);
      pin.ring.material.opacity = (1 - loop) * 0.7;

      if (pin.label) {
        this.tmp.set(pin.hub.x, 2.25 + pin.hover * 0.15, pin.hub.z).project(camera);
        const x = (this.tmp.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-this.tmp.y * 0.5 + 0.5) * window.innerHeight;
        const onScreen = x > 40 && x < window.innerWidth - 40 && y > 70 && y < window.innerHeight - 20;
        const visible = this.tmp.z < 1 && appear > 0.5 && onScreen;
        pin.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
        pin.label.classList.toggle('is-visible', visible);
        pin.label.classList.toggle('is-active', hovered);
      }
    }

    if (since > 2.2 && this.progress < 0.5) this.progress = 0.5;
    if (since > 3.5) this.complete();
  }

  #updateGrowth(since) {
    const { dummy } = this;
    let done = true;
    for (let i = 0; i < this.growth.length; i++) {
      const g = this.growth[i];
      const t = clamp((since - g.delay) / 0.9);
      if (t < 1) done = false;
      dummy.position.set(g.x, 0, g.z);
      dummy.rotation.set(g.tilt, g.yaw, g.tilt * 0.5);
      dummy.scale.set(1, Math.max(0.0001, easeOutBack(t) * g.h), 1);
      dummy.updateMatrix();
      this.sprouts.setMatrixAt(i, dummy.matrix);
    }
    for (let i = 0; i < this.bloomData.length; i++) {
      const { g, s } = this.bloomData[i];
      const t = clamp((since - g.delay - 0.5) / 0.7);
      if (t < 1) done = false;
      dummy.position.set(g.x, 0.5 * g.h + 0.05, g.z);
      dummy.rotation.set(0, g.yaw, 0);
      dummy.scale.setScalar(Math.max(0.0001, easeOutBack(t) * s));
      dummy.updateMatrix();
      this.blooms.setMatrixAt(i, dummy.matrix);
    }
    this.sprouts.instanceMatrix.needsUpdate = true;
    this.blooms.instanceMatrix.needsUpdate = true;
    this.growthDone = done;
  }
}
