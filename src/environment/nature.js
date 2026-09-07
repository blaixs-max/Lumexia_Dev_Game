import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const point = (x, y, z) => new THREE.Vector3(x, y, z);

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

// Every material is a single mesh per prototype. There are no leaf objects or
// helper scene nodes for the road recycler to update individually.
class Surface {
  constructor() { this.positions = []; this.normals = []; this.uvs = []; this.colors = []; }

  triangle(a, b, c, color, uv = [[0, 0], [1, 0], [1, 1]], normals) {
    const normal = normals ? null : new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    [a, b, c].forEach((vertex, index) => {
      this.positions.push(vertex.x, vertex.y, vertex.z);
      const n = normals?.[index] || normal;
      this.normals.push(n.x, n.y, n.z);
      this.uvs.push(...uv[index]);
      this.colors.push(color.r, color.g, color.b);
    });
  }

  primitive(geometry, position, rotation, color) {
    const matrix = new THREE.Matrix4().compose(position, new THREE.Quaternion().setFromEuler(rotation), new THREE.Vector3(1, 1, 1));
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const vertices = source.attributes.position;
    for (let i = 0; i < vertices.count; i += 3) {
      const p = [], n = [], uv = [];
      for (let j = 0; j < 3; j++) {
        p.push(new THREE.Vector3().fromBufferAttribute(vertices, i + j).applyMatrix4(matrix));
        n.push(new THREE.Vector3().fromBufferAttribute(source.attributes.normal, i + j).applyMatrix3(normalMatrix).normalize());
        uv.push(source.attributes.uv ? [source.attributes.uv.getX(i + j), source.attributes.uv.getY(i + j)] : [0, 0]);
      }
      this.triangle(...p, color, uv, n);
    }
    if (source !== geometry) source.dispose();
    geometry.dispose();
  }

  mesh(material, name) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    // Weld complete attribute tuples, preserving UV seams, hard normals and
    // needle colors. Unique triangle fans gain nothing from an index buffer.
    const indexed = mergeVertices(geometry, 1e-5);
    const stride = Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.itemSize * attribute.array.BYTES_PER_ELEMENT, 0);
    const savedBytes = (geometry.attributes.position.count - indexed.attributes.position.count) * stride;
    const useIndex = savedBytes > indexed.index.array.byteLength;
    const compact = useIndex ? indexed : geometry;
    (useIndex ? geometry : indexed).dispose();
    compact.computeBoundingBox();
    compact.computeBoundingSphere();
    const mesh = new THREE.Mesh(compact, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function tube(surface, points, startRadius, endRadius, color, radial = 6, segments = 4, fluting = 0.035) {
  const curve = new THREE.CatmullRomCurve3(points);
  const length = curve.getLength();
  const rings = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const center = curve.getPoint(t);
    const orientation = new THREE.Quaternion().setFromUnitVectors(UP, curve.getTangent(t).normalize());
    const radius = THREE.MathUtils.lerp(startRadius, endRadius, t ** 0.82);
    const ring = [];
    for (let j = 0; j <= radial; j++) {
      const angle = j / radial * TAU;
      const normal = point(Math.cos(angle), 0, Math.sin(angle)).applyQuaternion(orientation);
      const taper = radius * (1 + Math.sin(angle * 5 + t * 2) * fluting);
      ring.push({ position: center.clone().addScaledVector(normal, taper), normal, uv: [j / radial * 2, t * length * 0.6] });
    }
    rings.push(ring);
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = rings[i][j], b = rings[i + 1][j], c = rings[i + 1][j + 1], d = rings[i][j + 1];
      surface.triangle(a.position, b.position, c.position, color, [a.uv, b.uv, c.uv], [a.normal, b.normal, c.normal]);
      surface.triangle(a.position, c.position, d.position, color, [a.uv, c.uv, d.uv], [a.normal, c.normal, d.normal]);
    }
  }
}

function leafSpray(surface, center, width, height, random, brightness) {
  const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
    (random() - 0.5) * 1.7, random() * TAU, (random() - 0.5) * 1.2,
  ));
  const normal = point(0, 0, 1).applyQuaternion(orientation);
  const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) =>
    point(x * width, y * height, 0).applyQuaternion(orientation).add(center));
  const tint = new THREE.Color().setRGB(brightness * 0.92, brightness, brightness * (0.76 + random() * 0.14));
  surface.triangle(corners[0], corners[1], corners[2], tint, [[0, 0], [1, 0], [1, 1]], [normal, normal, normal]);
  surface.triangle(corners[0], corners[2], corners[3], tint, [[0, 0], [1, 1], [0, 1]], [normal, normal, normal]);
}

function crownSprays(surface, center, spread, count, random, size = 1.5) {
  for (let i = 0; i < count; i++) {
    const angle = random() * TAU;
    const radius = Math.sqrt(random());
    const location = center.clone().add(point(Math.cos(angle) * radius * spread, (random() - 0.3) * spread, Math.sin(angle) * radius * spread));
    // The center is shaded through vertex tint, leaving the irregular outer
    // sprays brighter. No spherical canopy geometry or stacked cones.
    const brightness = 0.68 + radius * 0.24 + random() * 0.1;
    leafSpray(surface, location, size * (0.8 + random() * 0.35), size * (0.75 + random() * 0.35), random, brightness);
  }
}

function roots(surface, random, radius, color) {
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * TAU + random() * 0.4;
    const reach = radius * (2.7 + random());
    tube(surface, [point(0, radius * 1.4, 0), point(Math.cos(angle) * reach * 0.5, 0.17, Math.sin(angle) * reach * 0.5), point(Math.cos(angle) * reach, 0.025, Math.sin(angle) * reach)], radius * 0.42, 0.018, color, 5, 2);
  }
}

function finish(name, wood, leaves, materials) {
  const group = new THREE.Group();
  group.name = name;
  group.add(wood.mesh(materials.bark, `${name}-branches`), leaves.mesh(materials.leaves, `${name}-leaf-sprays`));
  return group;
}

function oak(seed, materials) {
  const random = seeded(seed), wood = new Surface(), leaves = new Surface();
  const barkTint = new THREE.Color('#c7c0aa');
  const lean = (random() - 0.5) * 0.7;
  tube(wood, [point(0, 0, 0), point(-0.08, 1.9, 0.1), point(lean, 4, -0.12), point(lean + 0.15, 6.6, 0.2)], 0.48, 0.16, barkTint, 10, 7);
  roots(wood, random, 0.47, barkTint);
  const crownHeights = [7.0, 8.7, 7.8, 9.5, 7.5, 8.4, 9.2];
  for (let i = 0; i < 7; i++) {
    const angle = i / 7 * TAU + random() * 0.45;
    const reach = 2.05 + random() * 0.75;
    const start = point(lean, 3.65 + i * 0.22 + random() * 0.3, 0.1);
    const height = crownHeights[i] + random() * 0.3;
    const elbow = point(Math.cos(angle - 0.17) * reach * 0.22, start.y + 1.0, Math.sin(angle - 0.17) * reach * 0.22);
    const fork = point(Math.cos(angle + 0.12) * reach * 0.67, height - 0.75, Math.sin(angle + 0.12) * reach * 0.67);
    const tip = point(Math.cos(angle) * reach, height, Math.sin(angle) * reach);
    tube(wood, [start, elbow, fork, tip], 0.18 + random() * 0.025, 0.026, barkTint, 7, 5);
    // Leaves live on outer secondary growth along the branch, not only on
    // its endpoint. Lower forks build a deep rounded crown from about 5 m.
    const sideFork = fork.clone().add(point(Math.cos(angle + 0.9) * 0.55, -0.22, Math.sin(angle + 0.9) * 0.55));
    tube(wood, [elbow.clone().lerp(fork, 0.58), fork.clone().lerp(sideFork, 0.45), sideFork], 0.055, 0.007, barkTint, 5, 3);
    crownSprays(leaves, sideFork, 0.7, 10, random, 1.48);
    crownSprays(leaves, fork.clone().lerp(tip, 0.55), 0.66, 6, random, 1.42);
    for (let j = 0; j < 3; j++) {
      const branchAngle = angle + (j - 1) * 0.62;
      const end = tip.clone().add(point(Math.cos(branchAngle) * (0.4 + random() * 0.6), (random() - 0.35) * 1.25, Math.sin(branchAngle) * (0.4 + random() * 0.6)));
      tube(wood, [fork.clone().lerp(tip, 0.35 + j * 0.2), tip.clone().lerp(end, 0.45), end], 0.048, 0.006, barkTint, 5, 3);
      crownSprays(leaves, end, 0.65 + random() * 0.2, 8, random, 1.48);
    }
  }
  for (let layer = 0; layer < 3; layer++) {
    const center = point(lean + (random() - 0.5) * 0.6, 6.15 + layer * 1.45, (random() - 0.5) * 0.55);
    crownSprays(leaves, center, layer === 1 ? 1.25 : 0.85, 16, random, 1.4);
  }
  const leader = point(lean + 0.2, 10.25 + random() * 0.25, 0.1);
  tube(wood, [point(lean, 5.5, 0.1), point(-0.1, 8.1, -0.25), leader], 0.14, 0.02, barkTint, 7, 4);
  crownSprays(leaves, leader, 0.8, 22, random, 1.4);
  return finish(`oak-${seed}`, wood, leaves, materials);
}

function poplar(seed, materials) {
  const random = seeded(seed), wood = new Surface(), leaves = new Surface();
  const barkTint = new THREE.Color('#d2d0b9');
  const lean = (random() - 0.5) * 0.7;
  tube(wood, [point(0, 0, 0), point(0.08, 3, -0.12), point(lean, 8, 0.15), point(lean * 0.7, 13.8, 0)], 0.3, 0.025, barkTint, 9, 9);
  roots(wood, random, 0.3, barkTint);
  for (let i = 0; i < 28; i++) {
    const height = 2.6 + i * 0.355;
    const angle = i * 2.39996 + random() * 0.3;
    const reach = (0.92 + random() * 0.18) * (1 - Math.max(0, height - 9.5) * 0.1);
    const start = point(lean * height / 14, height, 0);
    const tip = point(Math.cos(angle) * reach + lean * 0.5, height + 1.75 + random() * 0.13, Math.sin(angle) * reach);
    const fork = start.clone().lerp(tip, 0.53).add(point(Math.cos(angle + 0.35) * 0.1, -0.12, Math.sin(angle + 0.35) * 0.1));
    tube(wood, [start, fork, tip], 0.061 * (1 - i * 0.014), 0.005, barkTint, 5, 3);
    crownSprays(leaves, tip, 0.31, 8, random, 1.12);
    // Upright secondary shoots overlap in height, building the continuous
    // narrow crown characteristic of a mature Lombardy poplar.
    const sideTip = fork.clone().lerp(tip, 0.38).add(point(Math.cos(angle + 0.95) * 0.19, 0.2, Math.sin(angle + 0.95) * 0.19));
    sideTip.y = Math.max(4.25, sideTip.y);
    tube(wood, [fork, fork.clone().lerp(sideTip, 0.5).add(point(0, -0.08, 0)), sideTip], 0.025, 0.003, barkTint, 4, 2);
    crownSprays(leaves, sideTip, 0.29, 4, random, 1.08);
  }
  // Staggered interior sprays fill the central column rather than leaving
  // isolated bunches on the ends of otherwise naked branches.
  for (let layer = 0; layer < 10; layer++) {
    const angle = layer * 2.4;
    const center = point(lean * 0.5 + Math.cos(angle) * 0.26, 4.25 + layer * 0.98, Math.sin(angle) * 0.26);
    crownSprays(leaves, center, 0.38, 6, random, 1.13);
  }
  crownSprays(leaves, point(lean * 0.7, 13.8, 0), 0.32, 16, random, 1.06);
  return finish(`poplar-${seed}`, wood, leaves, materials);
}

function pineNeedleFan(surface, base, end, cross, width, random) {
  const axis = end.clone().sub(base);
  for (let i = 0; i < 7; i++) {
    const t = 0.06 + i * 0.115;
    const spread = width * (0.55 + Math.sin(t * Math.PI) * 0.45);
    for (const side of [-1, 1]) {
      // Four broad pairs use 9 triangles per fan instead of 15, retaining the
      // full spray span. Consume every sample to keep branch positions fixed.
      const tipLength = random(), tipWidth = random();
      const hue = random(), saturation = random(), lightness = random();
      if (i % 2) continue;
      const a = base.clone().addScaledVector(axis, Math.max(0, t - 0.1)).addScaledVector(cross, side * spread * 0.08);
      const b = base.clone().addScaledVector(axis, t + 0.18).addScaledVector(cross, side * spread * 0.08);
      const tip = base.clone().addScaledVector(axis, t + 0.22 + tipLength * 0.08).addScaledVector(cross, side * spread * (0.86 + tipWidth * 0.24));
      const color = new THREE.Color().setHSL(0.32 + hue * 0.035, 0.3 + saturation * 0.12, 0.16 + lightness * 0.08);
      surface.triangle(a, b, tip, color);
    }
  }
  const center = base.clone().lerp(end, 0.8);
  surface.triangle(center.clone().addScaledVector(cross, -width * 0.18), center.clone().addScaledVector(cross, width * 0.18), end.clone().addScaledVector(axis, 0.2), new THREE.Color('#344d36'));
}

function pine(seed, materials) {
  const random = seeded(seed), wood = new Surface(), needles = new Surface();
  const barkTint = new THREE.Color('#a9a391');
  tube(wood, [point(0, 0, 0), point(0.13, 4, -0.08), point(-0.12, 8.6, 0.05), point(0.05, 12, 0)], 0.32, 0.013, barkTint, 8, 9);
  roots(wood, random, 0.3, barkTint);
  for (let tier = 0; tier < 9; tier++) {
    const height = 3.15 + tier * 0.94;
    const tierReach = 3.05 * (1 - tier / 10) ** 0.8;
    for (let branch = 0; branch < 5; branch++) {
      const angle = branch / 5 * TAU + tier * 0.78 + random() * 0.35;
      const reach = tierReach * (0.78 + random() * 0.3);
      const direction = point(Math.cos(angle), 0, Math.sin(angle));
      const side = point(-Math.sin(angle), 0, Math.cos(angle));
      const start = point(0.02, height + (random() - 0.5) * 0.32, 0);
      const tip = start.clone().addScaledVector(direction, reach).add(point(0, -0.14 + random() * 0.24, 0));
      tube(wood, [start, start.clone().lerp(tip, 0.55).add(point(0, -0.25, 0)), tip], 0.045 * (1 - tier * 0.065), 0.004, barkTint, 4, 3);
      for (let twig = 0; twig < 10; twig++) {
        const t = 0.12 + twig * 0.082;
        const base = start.clone().lerp(tip, t).add(point(0, -Math.sin(t * Math.PI) * 0.18, 0));
        const flank = twig % 2 ? 1 : -1;
        const frondLength = Math.max(0.4, reach * 0.25);
        const end = base.clone().addScaledVector(side, flank * Math.max(0.30, reach * 0.27) * (1 - t * 0.45)).addScaledVector(direction, frondLength).add(point(0, (random() - 0.5) * 0.3, 0));
        tube(wood, [base, base.clone().lerp(end, 0.5), end], 0.011, 0.002, barkTint, 3, 1);
        const axis = end.clone().sub(base).normalize();
        const cross = new THREE.Vector3().crossVectors(axis, UP).normalize();
        const width = (0.34 + random() * 0.1) * (1 - tier * 0.035);
        pineNeedleFan(needles, base, end, cross, width, random);
        // Crossed, broad needle sprays retain a dense feathery silhouette at
        // road height. Flat horizontal needles alone disappear edge-on.
        const upright = cross.clone().multiplyScalar(0.3).addScaledVector(UP, 0.95).normalize();
        pineNeedleFan(needles, base, end, upright, width * 0.95, random);
      }
    }
  }
  // Needles clothe the last year's slender leader, avoiding a bare wooden
  // spike above the upper boughs while retaining an uneven conifer apex.
  for (let shoot = 0; shoot < 6; shoot++) {
    const height = 10.95 + shoot * 0.16;
    for (let i = 0; i < 10; i++) {
      const angle = i / 10 * TAU + shoot * 0.9;
      const base = point(0.03, height, 0);
      const tip = base.clone().add(point(Math.cos(angle) * (0.14 + random() * 0.10), 0.16 + random() * 0.09, Math.sin(angle) * (0.14 + random() * 0.10)));
      const color = new THREE.Color().setHSL(0.33, 0.33, 0.19 + random() * 0.06);
      needles.triangle(base.clone().add(point(-0.018, 0, 0)), base.clone().add(point(0.018, 0.025, 0)), tip, color);
    }
  }
  return finish(`pine-${seed}`, wood, needles, { bark: materials.bark, leaves: materials.needles });
}

function shrubs(seed, materials) {
  const random = seeded(seed), wood = new Surface(), leaves = new Surface();
  const color = new THREE.Color('#bcb298');
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * TAU + random() * 0.3;
    const x = Math.cos(angle) * (0.45 + random() * 0.4), z = Math.sin(angle) * (0.4 + random() * 0.3);
    const end = point(x, 0.85 + random() * 0.35, z);
    tube(wood, [point(x * 0.25, 0, z * 0.25), point(x * 0.6, 0.4, z * 0.6), end], 0.035, 0.003, color, 4, 2);
    crownSprays(leaves, end, 0.25, 5, random, 0.96);
  }
  return finish(`shrubs-${seed}`, wood, leaves, materials);
}

function streetlamp(materials) {
  const metal = new Surface(), dark = new Surface(), lens = new Surface();
  const silver = new THREE.Color('#aeb9bf'), charcoal = new THREE.Color('#667179'), white = new THREE.Color('#f2eddb');
  const rotation = new THREE.Euler();
  // A planted base, inspection hatch, fasteners and a curved cantilever share
  // three material batches; there is deliberately no light per streetlamp.
  metal.primitive(new THREE.BoxGeometry(0.48, 0.055, 0.48), point(0, 0.0275, 0), rotation, silver);
  metal.primitive(new THREE.CylinderGeometry(0.145, 0.19, 0.42, 12), point(0, 0.265, 0), rotation, silver);
  tube(metal, [point(0, 0.4, 0), point(0, 3.4, 0), point(-0.05, 6.5, 0), point(-0.10, 7.82, 0)], 0.125, 0.067, silver, 12, 8, 0.022);
  tube(metal, [point(-0.10, 7.66, 0), point(-0.18, 8.03, 0), point(-0.60, 8.35, 0), point(-1.2, 8.43, 0), point(-2.2, 8.36, 0)], 0.067, 0.048, silver, 10, 12, 0);
  tube(metal, [point(-0.08, 7.35, 0), point(-0.48, 7.85, 0), point(-0.98, 8.38, 0)], 0.024, 0.021, silver, 6, 4, 0);
  // Shallow, faceted aluminium LED housing, length aligned with the road arm.
  const housing = new THREE.CylinderGeometry(0.32, 0.29, 0.085, 8);
  housing.scale(1.55, 1, 0.64);
  metal.primitive(housing, point(-2.29, 8.355, 0), rotation, silver);
  dark.primitive(new THREE.BoxGeometry(0.72, 0.026, 0.285), point(-2.29, 8.298, 0), rotation, charcoal);
  lens.primitive(new THREE.BoxGeometry(0.65, 0.012, 0.235), point(-2.29, 8.278, 0), rotation, white);
  // Longitudinal heat sink fins are visible at close range but remain one draw.
  for (let i = 0; i < 6; i++) metal.primitive(new THREE.BoxGeometry(0.54, 0.033, 0.012), point(-2.25, 8.417, (i - 2.5) * 0.044), rotation, silver);
  for (const x of [-0.17, 0.17]) for (const z of [-0.17, 0.17]) {
    dark.primitive(new THREE.CylinderGeometry(0.028, 0.028, 0.035, 6), point(x, 0.069, z), rotation, charcoal);
  }
  dark.primitive(new THREE.BoxGeometry(0.093, 0.29, 0.012), point(0, 0.87, 0.126), rotation, charcoal);
  metal.primitive(new THREE.BoxGeometry(0.078, 0.265, 0.009), point(0, 0.87, 0.136), rotation, silver);
  dark.primitive(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 6), point(0, 0.94, 0.144), new THREE.Euler(Math.PI / 2, 0, 0), charcoal);
  const group = new THREE.Group();
  group.name = 'galvanized-led-streetlamp';
  group.add(metal.mesh(materials.metal, 'lamp-galvanized-steel'), dark.mesh(materials.darkMetal, 'lamp-fasteners-gaskets'), lens.mesh(materials.lens, 'lamp-led-lens'));
  return group;
}

function fallbackLeaves() {
  const size = 128, pixels = new Uint8Array(size * size * 4);
  const random = seeded(718);
  const leaves = Array.from({ length: 15 }, (_, i) => {
    const t = 0.15 + i / 15 * 0.68;
    const side = i % 2 ? 1 : -1;
    return { x: 0.30 + t * 0.38 + side * (0.1 + random() * 0.07), y: 0.13 + t * 0.8, angle: side * (0.5 + random() * 0.35), length: 0.10 + random() * 0.055, width: 0.04 + random() * 0.022 };
  });
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / size, py = y / size, offset = (y * size + x) * 4;
    for (const leaf of leaves) {
      const dx = px - leaf.x, dy = py - leaf.y;
      const u = dx * Math.cos(leaf.angle) + dy * Math.sin(leaf.angle);
      const v = -dx * Math.sin(leaf.angle) + dy * Math.cos(leaf.angle);
      const edge = (u / leaf.width) ** 2 + (v / leaf.length) ** 2;
      if (edge < 1) {
        const shade = 1 - edge * 0.18 + Math.abs(u) * 0.6;
        pixels.set([70 * shade, 111 * shade, 47 * shade, 255], offset);
      }
    }
    if (py > 0.1 && py < 0.88 && Math.abs(px - (0.30 + (py - 0.13) / 0.8 * 0.38)) < 0.008) pixels.set([91, 90, 47, 255], offset);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function fallbackBark() {
  const width = 64, height = 128, pixels = new Uint8Array(width * height * 4), random = seeded(912);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const groove = Math.sin(x * 0.93 + Math.sin(y * 0.08) * 0.9) + Math.sin(x * 2.4 + y * 0.018) * 0.3;
    const shade = 0.8 + groove * 0.18 + random() * 0.1;
    pixels.set([113 * shade, 103 * shade, 84 * shade, 255], (y * width + x) * 4);
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function buildNatureAssets({ leafTexture, barkTexture } = {}) {
  const barkMap = barkTexture ? barkTexture.clone() : fallbackBark();
  barkMap.wrapS = barkMap.wrapT = THREE.RepeatWrapping;
  barkMap.needsUpdate = true;
  const materials = {
    bark: new THREE.MeshStandardMaterial({ map: barkMap, roughness: 0.94, vertexColors: true }),
    // The source leaf alpha averages 0.425: a 0.45 cutout erases its smallest
    // mip. Native MSAA coverage smooths moving edges without temporal dither.
    leaves: new THREE.MeshStandardMaterial({ map: leafTexture || fallbackLeaves(), roughness: 0.87, side: THREE.DoubleSide, alphaTest: 0.3, alphaToCoverage: true, forceSinglePass: true, vertexColors: true }),
    needles: new THREE.MeshStandardMaterial({ color: '#a3ac83', roughness: 0.96, side: THREE.DoubleSide, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ color: '#e0e5e5', metalness: 0.74, roughness: 0.49, vertexColors: true }),
    darkMetal: new THREE.MeshStandardMaterial({ metalness: 0.58, roughness: 0.6, vertexColors: true }),
    lens: new THREE.MeshStandardMaterial({ metalness: 0.05, roughness: 0.31, emissive: '#ffe5b0', emissiveIntensity: 0.7, vertexColors: true }),
  };
  const assets = {
    oak: oak(328, materials), oak2: oak(973, materials),
    poplar: poplar(801, materials), poplar2: poplar(244, materials),
    pine: pine(741, materials), pine2: pine(198, materials),
    shrubs: shrubs(440, materials), shrubs2: shrubs(638, materials),
    streetlamp: streetlamp(materials),
  };
  for (const asset of Object.values(assets)) {
    // Lift the lowest bark/root or foliage edge to ground without introducing
    // a root transform: instance renderers can use mesh world matrices directly.
    const bounds = new THREE.Box3().setFromObject(asset);
    asset.children.forEach(mesh => mesh.geometry.translate(0, -bounds.min.y, 0));
    asset.userData.dimensions = new THREE.Box3().setFromObject(asset).getSize(new THREE.Vector3()).toArray();
    asset.userData.triangles = asset.children.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    asset.userData.drawCalls = asset.children.length;
    asset.userData.originalProceduralAsset = true;
  }
  return assets;
}
