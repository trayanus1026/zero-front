import {
  BoxGeometry, BufferGeometry, Color, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Group,
  IcosahedronGeometry, InstancedMesh, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial,
  MeshPhysicalMaterial, Object3D, PMREMGenerator, Plane, Raycaster, RingGeometry, Shape, Vector2, Vector3,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Stage } from './Stage.js';
import { clamp, damp, mulberry32 } from '../utils/math.js';
import { createFrostTexture } from '../utils/textures.js';

const CAM_Z = 6;
const GRAVITY = -7;

/** Chapter 2: a frosted pane. First click cracks it, second shatters it. */
export class FilterStage extends Stage {
  post = { bloomStrength: 0.5, bloomRadius: 0.5, bloomThreshold: 0.92, vignette: 0.45, grain: 0.035 };

  async init() {
    const { scene, camera, app } = this;
    camera.fov = 40;

    const pmrem = new PMREMGenerator(app.renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.glassMaterial = new MeshPhysicalMaterial({
      color: new Color('#6f9f8d'),
      map: createFrostTexture(),
      roughness: 0.3,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.42,
      side: DoubleSide,
      envMapIntensity: 0.55,
    });

    this.pane = new Mesh(new BoxGeometry(1, 1, 0.04), this.glassMaterial);
    scene.add(this.pane);

    this.shardGroup = new Group();
    scene.add(this.shardGroup);
    this.crackLines = null;

    // "Opportunities" waiting behind the glass.
    const rand = mulberry32(21);
    const orbCount = 70;
    this.orbs = new InstancedMesh(
      new IcosahedronGeometry(0.07, 2),
      new MeshBasicMaterial({ color: new Color(1.4, 2.6, 2.0) }),
      orbCount
    );
    this.orbData = Array.from({ length: orbCount }, () => ({
      x: (rand() - 0.5) * 12, y: (rand() - 0.5) * 6, z: -1.5 - rand() * 8,
      s: 0.6 + rand() * 1.6, phase: rand() * Math.PI * 2,
    }));
    scene.add(this.orbs);
    this.dummy = new Object3D();

    this.reticle = new Mesh(
      new RingGeometry(0.09, 0.11, 48),
      new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false })
    );
    this.reticle.renderOrder = 10;
    scene.add(this.reticle);

    this.raycaster = new Raycaster();
    this.plane = new Plane(new Vector3(0, 0, 1), 0);
    this.hit = new Vector3();
    this.reset();
  }

  reset() {
    super.reset();
    this.clicks = 0;
    this.shatterTime = -1;
    this.reveal = 0;
    this.hovering = false;
    this.camera.position.set(0, 0, CAM_Z);
    this.pane.visible = true;
    this.#clearShards();
    this.#fitPane();
  }

  exit() {
    super.exit();
    this.app.canvas.style.cursor = '';
  }

  resize(w, h) {
    super.resize(w, h);
    if (this.clicks === 0) this.#fitPane();
  }

  #fitPane() {
    const visH = 2 * CAM_Z * Math.tan((this.camera.fov * Math.PI) / 360);
    const visW = visH * this.camera.aspect;
    this.paneW = Math.min(visW * 0.8, 7.4);
    this.paneH = Math.min(visH * 0.6, this.paneW * 0.75);
    this.pane.scale.set(this.paneW, this.paneH, 1);
  }

  #raycast(pointer) {
    this.raycaster.setFromCamera(new Vector2(pointer.nx, pointer.ny), this.camera);
    if (!this.raycaster.ray.intersectPlane(this.plane, this.hit)) return null;
    const inside = Math.abs(this.hit.x) <= this.paneW / 2 && Math.abs(this.hit.y) <= this.paneH / 2;
    return { point: this.hit.clone(), inside };
  }

  onPointerMove(pointer) {
    if (this.clicks >= 2) return;
    const res = this.#raycast(pointer);
    this.hovering = Boolean(res?.inside);
    if (res) this.reticle.position.set(res.point.x, res.point.y, 0.05);
    this.app.canvas.style.cursor = this.hovering ? 'pointer' : '';
  }

  onPointerUp(pointer) {
    if (!pointer.wasClick || this.clicks >= 2) return;
    const res = this.#raycast(pointer);
    if (!res) return;
    const p = res.point;
    p.x = clamp(p.x, -this.paneW / 2 * 0.9, this.paneW / 2 * 0.9);
    p.y = clamp(p.y, -this.paneH / 2 * 0.9, this.paneH / 2 * 0.9);

    if (this.clicks === 0) {
      this.#buildShards(p);
      this.app.audio.play('crack');
      this.progress = 0.5;
    } else {
      this.#shatter();
      this.app.audio.play('shatter');
      this.progress = 1;
    }
    this.clicks++;
  }

  /**
   * Radial fracture: jittered rings × jittered rays around the impact point
   * form cells, clipped to the pane rectangle and extruded into shards.
   * Neighboring cells share vertices so seams line up perfectly.
   */
  #buildShards(impact) {
    this.#clearShards();
    this.impact = impact.clone();
    const rand = mulberry32(Math.floor(impact.x * 1000 + impact.y * 7919) >>> 0);
    const W = this.paneW;
    const H = this.paneH;
    const maxR = Math.max(
      ...[[-W / 2, -H / 2], [W / 2, -H / 2], [-W / 2, H / 2], [W / 2, H / 2]].map(([x, y]) =>
        Math.hypot(x - impact.x, y - impact.y))
    );

    const radii = [0];
    let r = 0.12;
    while (r < maxR * 1.1) {
      radii.push(r);
      r = r * 1.55 + 0.1;
    }
    radii.push(maxR * 1.6);

    const rays = 13;
    const baseAngles = Array.from({ length: rays }, (_, k) => ((k + (rand() - 0.5) * 0.6) / rays) * Math.PI * 2);
    const grid = radii.map((rad, i) =>
      baseAngles.map((a) => {
        const aj = a + (i ? (rand() - 0.5) * 0.25 : 0);
        const rj = rad * (i ? 0.88 + rand() * 0.24 : 0);
        return [impact.x + Math.cos(aj) * rj, impact.y + Math.sin(aj) * rj];
      })
    );

    const linePositions = [];
    const depth = 0.04;
    for (let i = 0; i < radii.length - 1; i++) {
      for (let k = 0; k < rays; k++) {
        const k2 = (k + 1) % rays;
        let poly = i === 0
          ? [grid[0][k], grid[1][k], grid[1][k2]]
          : [grid[i][k], grid[i + 1][k], grid[i + 1][k2], grid[i][k2]];
        poly = clipToRect(poly, W / 2, H / 2);
        if (poly.length < 3) continue;

        const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
        const cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
        const shape = new Shape(poly.map(([x, y]) => new Vector2(x - cx, y - cy)));
        const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        const mesh = new Mesh(geo, this.glassMaterial);
        mesh.position.set(cx, cy, 0);
        // Tiny misalignment so light catches the fracture seams.
        mesh.rotation.set((rand() - 0.5) * 0.02, (rand() - 0.5) * 0.02, (rand() - 0.5) * 0.01);
        mesh.position.z += (rand() - 0.5) * 0.01;

        const dx = cx - impact.x;
        const dy = cy - impact.y;
        const dist = Math.hypot(dx, dy) + 0.001;
        const speed = (1.6 + rand() * 2.4) / (0.6 + dist * 0.5);
        mesh.userData.velocity = new Vector3((dx / dist) * speed, (dy / dist) * speed + 1, 1.5 + rand() * 4.5);
        mesh.userData.spin = new Vector3((rand() - 0.5) * 8, (rand() - 0.5) * 8, (rand() - 0.5) * 6);
        mesh.userData.life = 1.4 + rand() * 1.4;
        this.shardGroup.add(mesh);

        for (let j = 0; j < poly.length; j++) {
          const a = poly[j];
          const b = poly[(j + 1) % poly.length];
          linePositions.push(a[0], a[1], depth / 2 + 0.002, b[0], b[1], depth / 2 + 0.002);
        }
      }
    }

    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute('position', new Float32BufferAttribute(linePositions, 3));
    this.crackLines = new LineSegments(
      lineGeo,
      new LineBasicMaterial({ color: new Color(1.6, 1.8, 1.7), transparent: true, opacity: 0.7 })
    );
    this.scene.add(this.crackLines);
    this.pane.visible = false;
  }

  #shatter() {
    this.shatterTime = this.app.time;
    if (this.crackLines) this.crackLines.visible = false;
    this.reticle.material.opacity = 0;
    this.app.canvas.style.cursor = '';
  }

  #clearShards() {
    for (const m of [...this.shardGroup.children]) {
      m.geometry.dispose();
      this.shardGroup.remove(m);
    }
    if (this.crackLines) {
      this.crackLines.geometry.dispose();
      this.crackLines.material.dispose();
      this.scene.remove(this.crackLines);
      this.crackLines = null;
    }
  }

  update(dt, time) {
    const { camera, app } = this;
    const shattered = this.shatterTime >= 0;
    const since = shattered ? time - this.shatterTime : 0;

    const px = app.reducedMotion ? 0 : app.input.pointer.nx;
    const py = app.reducedMotion ? 0 : app.input.pointer.ny;
    camera.position.x = damp(camera.position.x, px * 0.35, 3, dt);
    camera.position.y = damp(camera.position.y, py * 0.2, 3, dt);
    camera.position.z = damp(camera.position.z, shattered ? 3.6 : CAM_Z, 1.6, dt);
    camera.lookAt(0, 0, -2);

    this.reveal = damp(this.reveal, shattered ? 1 : 0, 2, dt);
    const orbs = this.orbData;
    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];
      this.dummy.position.set(
        o.x + Math.sin(time * 0.4 + o.phase) * 0.2,
        o.y + Math.cos(time * 0.5 + o.phase) * 0.15,
        o.z + this.reveal * 1.5
      );
      this.dummy.scale.setScalar(o.s * (0.7 + 0.5 * this.reveal) * (0.85 + 0.15 * Math.sin(time * 2 + o.phase)));
      this.dummy.updateMatrix();
      this.orbs.setMatrixAt(i, this.dummy.matrix);
    }
    this.orbs.instanceMatrix.needsUpdate = true;
    this.glassMaterial.opacity = 0.42 - this.reveal * 0.12;

    const rm = this.reticle.material;
    rm.opacity = damp(rm.opacity, this.hovering && !shattered ? 0.9 : 0, 8, dt);
    this.reticle.scale.setScalar(1 + Math.sin(time * 5) * 0.12);

    if (shattered) {
      for (const m of this.shardGroup.children) {
        const { velocity, spin, life } = m.userData;
        velocity.y += GRAVITY * dt;
        m.position.addScaledVector(velocity, dt);
        m.rotation.x += spin.x * dt;
        m.rotation.y += spin.y * dt;
        m.rotation.z += spin.z * dt;
        m.scale.setScalar(Math.max(0.0001, 1 - since / life));
      }
      if (since > 1.3) this.complete();
    }
  }
}

/** Sutherland–Hodgman polygon clip against an axis-aligned box centered at 0. */
function clipToRect(poly, hw, hh) {
  const edges = [
    (p) => p[0] >= -hw, (p) => p[0] <= hw, (p) => p[1] >= -hh, (p) => p[1] <= hh,
  ];
  const intersect = [
    (a, b) => lerpPt(a, b, (-hw - a[0]) / (b[0] - a[0])),
    (a, b) => lerpPt(a, b, (hw - a[0]) / (b[0] - a[0])),
    (a, b) => lerpPt(a, b, (-hh - a[1]) / (b[1] - a[1])),
    (a, b) => lerpPt(a, b, (hh - a[1]) / (b[1] - a[1])),
  ];
  let out = poly;
  for (let e = 0; e < 4 && out.length; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const curIn = edges[e](cur);
      const prevIn = edges[e](prev);
      if (curIn) {
        if (!prevIn) out.push(intersect[e](prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect[e](prev, cur));
      }
    }
  }
  return out;
}

function lerpPt(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
