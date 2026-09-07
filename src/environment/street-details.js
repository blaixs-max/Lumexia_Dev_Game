import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const seeded = seed => {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
};

class Detail {
  constructor(name, palette, seed) {
    this.name = name;
    this.palette = palette;
    this.parts = new Map();
    this.random = seeded(seed);
  }

  box(material, width, height, depth, x, y, z, rotation = [0, 0, 0]) {
    const source = new THREE.BoxGeometry(width, height, depth);
    const geometry = source.toNonIndexed();
    source.dispose();
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    const colors = [];
    const normal = geometry.attributes.normal;
    for (let face = 0; face < 6; face++) {
      // Slightly faded top faces and varied slats, without a repeating texture
      // or extra draw call. A face keeps one tint, avoiding triangle seams.
      const shade = 0.86 + this.random() * 0.13 + Math.max(0, normal.getY(face * 6)) * 0.035;
      for (let vertex = 0; vertex < 6; vertex++) colors.push(shade, shade, shade);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.add(material, geometry);
  }

  add(material, geometry) {
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geometry);
  }

  finish() {
    const group = new THREE.Group();
    group.name = this.name;
    let triangles = 0;
    for (const [material, parts] of this.parts) {
      const geometry = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      triangles += (geometry.index?.count || geometry.attributes.position.count) / 3;
      const mesh = new THREE.Mesh(geometry, this.palette[material]);
      mesh.name = `${this.name}/${material}`;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    const dimensions = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3());
    group.userData = { front: '+Z', units: 'metres', triangles, drawCalls: group.children.length,
      dimensions: { width: dimensions.x, height: dimensions.y, depth: dimensions.z } };
    return group;
  }
}

function fence(palette) {
  const detail = new Detail('Residential fence / 3m steel bay', palette, 671);
  for (const side of [-1, 1]) {
    detail.box('concrete', 0.14, 0.05, 0.14, side * 1.43, 0.025, 0);
    detail.box('metal', 0.085, 0.855, 0.085, side * 1.43, 0.46, 0);
    detail.box('metal', 0.1, 0.024, 0.1, side * 1.43, 0.888, 0);
  }
  for (const y of [0.22, 0.715]) detail.box('metal', 2.79, 0.045, 0.043, 0, y, 0.014);
  for (let index = 0; index < 15; index++) {
    detail.box('metal', 0.027, 0.65, 0.027, -1.3 + index * 2.6 / 14, 0.46, -0.006);
  }
  // End joining tabs make adjacent 3m instances read as a continuous fence.
  for (const side of [-1, 1]) for (const y of [0.22, 0.715]) detail.box('metal', 0.07, 0.035, 0.018, side * 1.465, y, -0.023);
  return detail.finish();
}

function bench(palette) {
  const detail = new Detail('Park bench / timber slats and steel frame', palette, 489);
  for (let index = 0; index < 6; index++) detail.box('wood', 1.8, 0.036, 0.069, 0, 0.465, -0.195 + index * 0.078);
  for (let index = 0; index < 4; index++) {
    const y = 0.625 + index * 0.087;
    detail.box('wood', 1.8, 0.07, 0.035, 0, y, -0.256 - (y - 0.6) * 0.16, [-0.16, 0, 0]);
  }
  for (const side of [-1, 1]) {
    const x = side * 0.66;
    detail.box('metal', 0.145, 0.034, 0.52, x, 0.017, 0);
    for (const z of [-0.19, 0.19]) detail.box('metal', 0.043, 0.4, 0.045, x, 0.23, z, [z * -0.13, 0, 0]);
    detail.box('metal', 0.052, 0.055, 0.5, x, 0.415, 0);
    detail.box('metal', 0.042, 0.51, 0.047, x, 0.65, -0.27, [-0.16, 0, 0]);
    detail.box('metal', 0.035, 0.28, 0.035, side * 0.87, 0.6, 0.17);
    detail.box('wood', 0.065, 0.038, 0.5, side * 0.865, 0.748, -0.025);
    for (const z of [-0.14, 0.14]) detail.box('metal', 0.013, 0.003, 0.013, x, 0.485, z);
  }
  return detail.finish();
}

function utilityBox(palette) {
  const detail = new Detail('Street electrical cabinet / galvanized steel', palette, 712);
  detail.box('concrete', 0.88, 0.115, 0.6, 0, 0.0575, 0);
  detail.box('galvanized', 0.78, 0.91, 0.44, 0, 0.57, 0);
  detail.box('metal', 0.72, 0.85, 0.018, 0, 0.575, 0.23);
  detail.box('galvanized', 0.69, 0.819, 0.016, 0, 0.575, 0.243);
  detail.box('galvanized', 0.84, 0.052, 0.5, 0, 1.046, -0.012, [-0.04, 0, 0]);
  detail.box('metal', 0.74, 0.022, 0.025, 0, 0.137, 0.258);
  for (let row = 0; row < 7; row++) detail.box('metal', 0.36, 0.009, 0.006, -0.08, 0.265 + row * 0.029, 0.255);
  for (const y of [0.27, 0.59, 0.9]) detail.box('metal', 0.024, 0.057, 0.032, -0.348, y, 0.234);
  detail.box('metal', 0.017, 0.105, 0.027, 0.253, 0.598, 0.266);
  detail.box('galvanized', 0.042, 0.135, 0.014, 0.253, 0.6, 0.257);
  // Small inset identification plate; no labels/logos or fluorescent markings.
  detail.box('metal', 0.16, 0.078, 0.004, -0.08, 0.829, 0.255);
  for (const x of [-0.275, 0.275]) for (const y of [0.21, 0.941]) detail.box('metal', 0.009, 0.009, 0.006, x, y, 0.257);
  return detail.finish();
}

function grasses(palette) {
  const detail = new Detail('Dry verge grass / curved olive blades', palette, 918);
  const random = seeded(1769);
  const positions = [], colors = [], uv = [], indices = [];
  const baseColor = new THREE.Color('#4f5939');
  const tipColor = new THREE.Color('#8d8761');
  const color = new THREE.Color();
  for (let blade = 0; blade < 30; blade++) {
    const angle = random() * Math.PI * 2;
    const radius = Math.sqrt(random()) * 0.2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const height = 0.25 + random() * 0.12;
    const bend = 0.05 + random() * 0.12;
    const facing = angle + (random() - 0.5) * 1.5;
    const width = 0.012 + random() * 0.011;
    const fade = 0.78 + random() * 0.28;
    const offset = positions.length / 3;
    for (let segment = 0; segment <= 3; segment++) {
      const t = segment / 3;
      const curve = t * t * bend;
      const halfWidth = width * Math.pow(1 - t, 0.7) * 0.5;
      const twist = facing + t * 0.28;
      const cx = x + Math.sin(facing) * curve;
      const cz = z + Math.cos(facing) * curve;
      const y = height * t - t * t * bend * 0.12;
      color.copy(baseColor).lerp(tipColor, t * 0.7).multiplyScalar(fade);
      for (const side of [-1, 1]) {
        positions.push(cx + Math.cos(twist) * halfWidth * side, y, cz - Math.sin(twist) * halfWidth * side);
        colors.push(color.r, color.g, color.b);
        uv.push((side + 1) / 2, t);
      }
      if (segment < 3) {
        const current = offset + segment * 2;
        indices.push(current, current + 2, current + 1);
        // At the pointed tip both vertices coincide; avoid a degenerate face.
        if (segment < 2) indices.push(current + 1, current + 2, current + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  detail.add('grass', geometry);
  const group = detail.finish();
  group.children[0].castShadow = false;
  return group;
}

/** Original detail prototypes. Front +Z, width along X, base at ground y=0. */
export function buildStreetDetailsAssets() {
  const material = (name, parameters) => {
    const result = new THREE.MeshStandardMaterial({ vertexColors: true, ...parameters });
    result.name = name;
    return result;
  };
  const palette = {
    metal: material('weathered-painted-steel', { color: '#3c4747', metalness: 0.5, roughness: 0.65 }),
    wood: material('faded-oiled-hardwood', { color: '#88705a', roughness: 0.86 }),
    concrete: material('street-detail-concrete', { color: '#999e92', roughness: 0.96 }),
    galvanized: material('dull-galvanized-sheet', { color: '#a1aaa3', metalness: 0.58, roughness: 0.59 }),
    grass: material('dry-olive-verge-grass', { color: '#ffffff', side: THREE.DoubleSide, roughness: 1 }),
  };
  const assets = { fence: fence(palette), bench: bench(palette), utilityBox: utilityBox(palette), grasses: grasses(palette) };
  let disposed = false;
  Object.defineProperty(assets, 'dispose', { value: () => {
    if (disposed) return;
    disposed = true;
    for (const group of Object.values(assets)) group.traverse(mesh => { if (mesh.isMesh) mesh.geometry.dispose(); });
    Object.values(palette).forEach(entry => entry.dispose());
  } });
  return assets;
}
