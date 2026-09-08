import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Original, metre-scale architecture. All entrances/fronts face local +Z.
// Geometry is baked into one mesh per material; no per-window scene objects.
function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function surface(kind, seed) {
  const random = seeded(seed);
  const canvas = document.createElement('canvas');
  const relief = document.createElement('canvas');
  const roughness = document.createElement('canvas');
  canvas.width = canvas.height = relief.width = relief.height = roughness.width = roughness.height = 512;
  const color = canvas.getContext('2d');
  const bump = relief.getContext('2d');
  const rough = roughness.getContext('2d');
  const fill = (context, shade, x, y, w, h) => { context.fillStyle = shade; context.fillRect(x, y, w, h); };
  fill(bump, '#999999', 0, 0, 512, 512);
  fill(rough, '#e5e5e5', 0, 0, 512, 512);

  if (kind === 'brick') {
    fill(color, '#948777', 0, 0, 512, 512);
    fill(bump, '#606060', 0, 0, 512, 512);
    for (let row = 0; row < 16; row++) {
      for (let column = -1; column < 9; column++) {
        const x = column * 64 + row % 2 * 32;
        const y = row * 32;
        const tint = Math.floor(random() * 21);
        fill(color, `rgb(${122 + tint},${89 + tint},${70 + tint})`, x + 2, y + 2, 60, 28);
        fill(bump, `rgb(${163 + tint},${163 + tint},${163 + tint})`, x + 2, y + 2, 60, 28);
        fill(rough, '#c9c9c9', x + 2, y + 2, 60, 28);
        fill(color, '#d7b89616', x + 3, y + 3, 57, 2);
        fill(color, '#31261d22', x + 4, y + 28, 56, 2);
      }
    }
  } else if (kind === 'roof') {
    fill(color, '#3d474b', 0, 0, 512, 512);
    fill(bump, '#666666', 0, 0, 512, 512);
    for (let row = 0; row < 8; row++) {
      for (let column = -1; column < 9; column++) {
        const x = column * 64 + row % 2 * 32;
        const y = row * 64;
        const tint = Math.floor(random() * 17);
        fill(color, `rgb(${61 + tint},${68 + tint},${70 + tint})`, x + 1, y + 1, 62, 60);
        fill(bump, '#aaaaaa', x + 1, y + 1, 62, 60);
        fill(color, '#c6c9bf16', x + 3, y + 2, 58, 3);
        fill(color, '#171e2566', x + 1, y + 59, 62, 3);
      }
    }
  } else {
    fill(color, kind === 'plaster' ? '#d4cbbb' : '#a9aaa3', 0, 0, 512, 512);
    if (kind === 'concrete') {
      for (let row = 0; row < 4; row++) {
        fill(color, '#48505223', 0, row * 128, 512, 2);
        fill(bump, '#777777', 0, row * 128, 512, 2);
        for (let col = 0; col < 4; col++) {
          fill(color, '#59606330', col * 128 + 14, row * 128 + 15, 3, 3);
        }
      }
    }
  }

  // Sub-pixel aggregate, worn brick edges and fine plaster pores. Repeating
  // seams stay aligned because course dimensions divide the texture size.
  for (let index = 0; index < 11500; index++) {
    const x = Math.floor(random() * 512);
    const y = Math.floor(random() * 512);
    const light = random() > 0.5;
    fill(color, light ? '#f5ebd714' : '#17211d12', x, y, 1 + random() * 2, 1 + random() * 2);
    fill(bump, light ? '#c8c8c83a' : '#5050502c', x, y, 1, 1);
    fill(rough, light ? '#ffffff1c' : '#99999921', x, y, 2, 2);
  }
  const texture = image => {
    const map = new THREE.CanvasTexture(image);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    return map;
  };
  const map = texture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return { map, bumpMap: texture(relief), roughnessMap: texture(roughness) };
}

function materials() {
  const textured = (name, kind, seed, options, scale = 2) => {
    const material = new THREE.MeshStandardMaterial({ ...surface(kind, seed), roughness: 0.93, bumpScale: 0.022, ...options });
    material.name = name;
    material.userData.uvMetres = scale;
    return material;
  };
  const plain = (name, options) => {
    const material = new THREE.MeshStandardMaterial(options);
    material.name = name;
    return material;
  };
  return {
    brick: textured('weathered-clay-brick', 'brick', 418, { color: '#d5bfae', bumpScale: 0.027 }),
    plaster: textured('warm-mineral-plaster', 'plaster', 156, { color: '#ddd8ca', bumpScale: 0.013 }),
    concrete: textured('board-formed-concrete', 'concrete', 837, { color: '#bcc0b8', bumpScale: 0.015 }, 4),
    roof: textured('overlapping-slate', 'roof', 257, { color: '#c5cece', roughness: 0.87, bumpScale: 0.035 }),
    trim: plain('limestone-sills-and-coping', { color: '#b8b9af', roughness: 0.83 }),
    metal: plain('powder-coated-charcoal', { color: '#303a3d', metalness: 0.48, roughness: 0.51 }),
    timber: plain('oiled-walnut-timber', { color: '#695544', roughness: 0.76 }),
    darkGlass: plain('deep-reflective-glass', { color: '#26363c', metalness: 0.44, roughness: 0.2, envMapIntensity: 1.2 }),
    coolGlass: plain('muted-sky-glass', { color: '#536b71', metalness: 0.56, roughness: 0.18, envMapIntensity: 1.35 }),
    warmGlass: plain('curtained-window-glass', { color: '#7f7865', metalness: 0.25, roughness: 0.36, emissive: '#ffd092', emissiveIntensity: 0.85 }),
    curtain: plain('linen-curtain', { color: '#a39e8d', roughness: 0.93 }),
  };
}

class Building {
  constructor(palette, name) {
    this.palette = palette;
    this.name = name;
    this.batches = new Map();
  }

  add(name, input, position, rotation = [0, 0, 0], parent) {
    const geometry = input.index ? input.toNonIndexed() : input;
    if (geometry !== input) input.dispose();
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(1, 1, 1),
    );
    if (parent) matrix.premultiply(parent);
    geometry.applyMatrix4(matrix);
    const material = this.palette[name];
    if (material.map) {
      // World-projected UVs preserve brick dimensions on a 30m wall and on a
      // 20cm chimney alike. Scaling boxes must not stretch an entire brick tile.
      const vertices = geometry.attributes.position;
      const normals = geometry.attributes.normal;
      const uv = geometry.attributes.uv;
      const scale = material.userData.uvMetres || 2;
      for (let index = 0; index < vertices.count; index++) {
        const x = vertices.getX(index), y = vertices.getY(index), z = vertices.getZ(index);
        const nx = Math.abs(normals.getX(index)), ny = Math.abs(normals.getY(index)), nz = Math.abs(normals.getZ(index));
        if (ny > nx && ny > nz) uv.setXY(index, x / scale, z / scale);
        else if (nx > nz) uv.setXY(index, z / scale, y / scale);
        else uv.setXY(index, x / scale, y / scale);
      }
    }
    if (!this.batches.has(name)) this.batches.set(name, []);
    this.batches.get(name).push(geometry);
  }

  box(name, width, height, depth, x, y, z, rotation, parent) {
    this.add(name, new THREE.BoxGeometry(width, height, depth), [x, y, z], rotation, parent);
  }

  plane(name, width, height, x, y, z, parent) {
    this.add(name, new THREE.PlaneGeometry(width, height), [x, y, z], undefined, parent);
  }

  pipe(radius, length, x, y, z, rotation = [0, 0, 0]) {
    this.add('metal', new THREE.CylinderGeometry(radius, radius, length, 6), [x, y, z], rotation);
  }

  finish() {
    const group = new THREE.Group();
    group.name = this.name;
    let triangles = 0;
    for (const [name, parts] of this.batches) {
      const merged = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      // Complete attribute tuples keep brick UV seams and sharp trim normals
      // while sharing duplicate corners within each material batch.
      const indexed = mergeVertices(merged, 1e-5);
      const stride = Object.values(merged.attributes).reduce((sum, attribute) => sum + attribute.itemSize * attribute.array.BYTES_PER_ELEMENT, 0);
      const savedBytes = (merged.attributes.position.count - indexed.attributes.position.count) * stride;
      const useIndex = savedBytes > indexed.index.array.byteLength;
      const geometry = useIndex ? indexed : merged;
      (useIndex ? merged : indexed).dispose();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
      const mesh = new THREE.Mesh(geometry, this.palette[name]);
      mesh.name = `${this.name}/${name}`;
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    }
    const bounds = new THREE.Box3().setFromObject(group);
    const size = bounds.getSize(new THREE.Vector3());
    group.userData = { front: '+Z', units: 'metres', dimensions: { width: size.x, height: size.y, depth: size.z }, triangles, drawCalls: group.children.length };
    return group;
  }
}

function facade(width, depth, side = 'front') {
  const direction = { front: [0, 0, depth / 2, 0], back: [0, 0, -depth / 2, Math.PI], left: [-width / 2, 0, 0, -Math.PI / 2], right: [width / 2, 0, 0, Math.PI / 2] }[side];
  return new THREE.Matrix4().makeRotationY(direction[3]).setPosition(direction[0], direction[1], direction[2]);
}

function windowUnit(building, frame, x, y, width, height, variation, divisions = true) {
  const glass = variation % 9 === 0 ? 'warmGlass' : variation % 3 === 0 ? 'coolGlass' : 'darkGlass';
  // The reveal surrounds the opening instead of sitting behind the entire
  // pane. Curtains partition the glass, so no thin opaque planes compete.
  for (const side of [-1, 1]) {
    building.plane('metal', 0.1, height, x + side * (width / 2 + 0.05), y, 0.06, frame);
    building.plane('metal', width + 0.2, 0.1, x, y + side * (height / 2 + 0.05), 0.06, frame);
  }
  if (variation % 7 === 0) {
    building.plane('curtain', width * 0.22, height * 0.93, x - width * 0.36, y, 0.08, frame);
    building.plane(glass, width * 0.03, height, x - width * 0.485, y, 0.08, frame);
    building.plane(glass, width * 0.75, height, x + width * 0.125, y, 0.08, frame);
    for (const side of [-1, 1]) building.plane(glass, width * 0.22, height * 0.035, x - width * 0.36, y + side * height * 0.4825, 0.08, frame);
  } else building.plane(glass, width, height, x, y, 0.08, frame);
  for (const side of [-1, 1]) {
    building.box('trim', 0.095, height + 0.2, 0.18, x + side * (width / 2 + 0.055), y, 0.12, undefined, frame);
    building.box('metal', width + 0.04, 0.055, 0.12, x, y + side * (height / 2 - 0.015), 0.14, undefined, frame);
  }
  building.box('trim', width + 0.35, 0.1, 0.29, x, y - height / 2 - 0.1, 0.11, undefined, frame);
  if (divisions) building.box('metal', 0.045, height, 0.12, x, y, 0.14, undefined, frame);
}

function entrance(building, frame, x, width = 1.15, height = 2.25) {
  building.box('trim', width + 0.26, height + 0.18, 0.2, x, height / 2 + 0.2, 0.03, undefined, frame);
  const paneWidth = width * 0.45, stileWidth = (width - paneWidth) / 2;
  for (const side of [-1, 1]) building.box('timber', stileWidth, height, 0.09, x + side * (paneWidth + stileWidth) / 2, height / 2 + 0.2, 0.16, undefined, frame);
  const lowerHeight = height * 0.41 - 0.2, upperHeight = height * 0.05 + 0.2;
  building.box('timber', paneWidth, lowerHeight, 0.09, x, 0.2 + lowerHeight / 2, 0.16, undefined, frame);
  building.box('timber', paneWidth, upperHeight, 0.09, x, height * 0.95 + upperHeight / 2, 0.16, undefined, frame);
  // A real inset opening replaces glass overlaid 4 mm above a solid door.
  building.plane('darkGlass', paneWidth, height * 0.54, x, height * 0.68, 0.18, frame);
  building.box('metal', 0.035, 0.29, 0.08, x + width * 0.34, height * 0.54, 0.24, undefined, frame);
  building.box('trim', width + 0.65, 0.18, 0.65, x, 0.09, 0.3, undefined, frame);
}

function pitchedRoof(building, width, depth, eaves, rise) {
  const half = width / 2 + 0.42;
  const angle = Math.atan2(rise, half);
  const slope = Math.hypot(half, rise);
  for (const sign of [-1, 1]) {
    building.box('roof', slope, 0.14, depth + 0.85, sign * half / 2, eaves + rise / 2, 0, [0, 0, -sign * angle]);
    building.box('trim', 0.15, 0.19, depth + 0.85, sign * half, eaves - 0.05, 0);
    building.pipe(0.065, depth + 0.85, sign * half, eaves - 0.15, 0, [Math.PI / 2, 0, 0]);
    building.pipe(0.055, eaves - 0.25, sign * (width / 2 + 0.12), eaves / 2 - 0.04, depth / 2 - 0.15);
  }
  for (const sign of [-1, 1]) {
    const shape = new THREE.BufferGeometry();
    const vertices = sign > 0 ? [-width / 2, eaves, 0, width / 2, eaves, 0, 0, eaves + rise - 0.1, 0] : [width / 2, eaves, 0, -width / 2, eaves, 0, 0, eaves + rise - 0.1, 0];
    shape.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    shape.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
    shape.computeVertexNormals();
    building.add('plaster', shape, [0, 0, sign * depth / 2]);
  }
  building.box('roof', 0.22, 0.2, depth + 0.9, 0, eaves + rise + 0.035, 0);
}

function flatRoof(building, width, depth, height) {
  building.box('roof', width, 0.12, depth, 0, height + 0.02, 0);
  for (const side of [-1, 1]) {
    building.box('concrete', width + 0.14, 0.48, 0.18, 0, height + 0.22, side * depth / 2);
    building.box('trim', width + 0.32, 0.095, 0.3, 0, height + 0.48, side * depth / 2);
    building.box('concrete', 0.18, 0.48, depth, side * width / 2, height + 0.22, 0);
    building.box('trim', 0.3, 0.095, depth + 0.2, side * width / 2, height + 0.48, 0);
  }
}

function hvac(building, x, y, z, scale = 1) {
  building.box('metal', 1.65 * scale, 0.14, 1.15 * scale, x, y + 0.08, z);
  building.box('trim', 1.4 * scale, 0.9 * scale, scale, x, y + 0.45 * scale, z);
  building.box('metal', 1.15 * scale, 0.055, 0.75 * scale, x, y + 0.91 * scale, z);
  for (let index = 0; index < 6; index++) building.box('metal', 1.1 * scale, 0.035, 0.035, x, y + (0.18 + index * 0.105) * scale, z + 0.51 * scale);
}

function townhouse(palette) {
  const b = new Building(palette, 'Townhouse / plaster and clay');
  const width = 9.6, depth = 8.2, height = 6.6;
  b.box('concrete', width + 0.45, 0.22, depth + 0.45, 0, 0.11, 0);
  b.box('plaster', width, height - 0.2, depth, 0, (height + 0.2) / 2, 0);
  b.box('brick', width + 0.06, 0.86, depth + 0.06, 0, 0.63, 0);
  b.box('trim', width + 0.13, 0.12, depth + 0.13, 0, 3.37, 0);
  b.box('trim', width + 0.25, 0.14, depth + 0.25, 0, height - 0.1, 0);
  const front = facade(width, depth);
  entrance(b, front, 0);
  for (const x of [-3.05, 3.05]) windowUnit(b, front, x, 1.95, 1.45, 1.68, 2 + x * 20);
  for (let index = 0; index < 3; index++) windowUnit(b, front, (index - 1) * 3.05, 4.93, 1.45, 1.64, index * 5);
  for (const side of ['left', 'right', 'back']) {
    const face = facade(width, depth, side);
    for (const y of [1.94, 4.93]) for (const x of [-2.3, 2.3]) windowUnit(b, face, x, y, 1.25, 1.6, Math.round(y * 7 + x * 10));
  }
  // Door canopy, braced timber brackets and modest entry steps.
  b.box('metal', 2.05, 0.1, 1.0, 0, 2.88, depth / 2 + 0.43, [0.08, 0, 0]);
  for (const side of [-1, 1]) b.box('timber', 0.075, 0.62, 0.075, side * 0.78, 2.53, depth / 2 + 0.3, [-0.7, 0, 0]);
  pitchedRoof(b, width, depth, height, 2.02);
  b.box('brick', 0.78, 2.05, 0.84, 2.25, 8.15, -1.8);
  b.box('trim', 0.97, 0.12, 1.03, 2.25, 9.19, -1.8);
  b.box('metal', 0.4, 0.17, 0.48, 2.25, 9.32, -1.8);
  return b.finish();
}

function villa(palette) {
  const b = new Building(palette, 'Modern villa / limestone and timber');
  b.box('concrete', 13.5, 0.25, 10.1, 0, 0.125, 0);
  b.box('plaster', 12.8, 3.1, 8.8, 0, 1.8, 0);
  b.box('concrete', 13.15, 0.25, 9.1, 0, 3.36, 0);
  b.box('plaster', 8.3, 2.95, 7.1, -1.75, 4.96, -0.72);
  flatRoof(b, 8.3, 7.1, 6.47);
  // Upper roof is offset with the upper volume; batch its geometry directly.
  const roofBatches = b.batches;
  for (const [name, pieces] of roofBatches) {
    // The eight coping strips and membrane were the latest items of these
    // materials. The residential volume below already has its correct offset.
    const count = name === 'roof' ? 1 : name === 'concrete' || name === 'trim' ? 4 : 0;
    for (const geometry of count ? pieces.slice(-count) : []) geometry.translate(-1.75, 0, -0.72);
  }
  const ground = facade(12.8, 8.8);
  entrance(b, ground, -4.7, 1.1);
  for (let index = 0; index < 3; index++) windowUnit(b, ground, -1.7 + index * 2.7, 1.83, 2.42, 2.35, index + 3);
  const upper = new THREE.Matrix4().setPosition(-1.75, 0, 2.83);
  for (let index = 0; index < 3; index++) windowUnit(b, upper, (index - 1) * 2.5, 5.05, 2.05, 1.96, index * 2);
  for (const side of ['left', 'right', 'back']) {
    const face = facade(12.8, 8.8, side);
    for (const x of [-2.7, 2.7]) windowUnit(b, face, x, 1.9, 2.4, 2.03, Math.abs(Math.round(x * 5)));
  }
  // Setback roof terrace with slender steel posts and a timber pergola.
  b.box('roof', 3.9, 0.1, 8.9, 4.43, 3.54, 0);
  for (let index = 0; index < 8; index++) {
    b.box('metal', 0.045, 1.03, 0.045, 6.13, 4.05, -3.8 + index * 1.09);
    b.box('timber', 2.5, 0.11, 0.12, 4.8, 5.57, -3.5 + index * 1.02);
  }
  b.box('metal', 0.05, 0.055, 8.0, 6.13, 4.57, 0);
  for (const z of [-3.55, 3.55]) for (const x of [3.55, 6.03]) b.box('timber', 0.12, 2.06, 0.12, x, 4.55, z);
  hvac(b, -2.4, 6.5, -1.7, 0.75);
  return b.finish();
}

function balcony(b, frame, x, y, width = 2.65) {
  b.box('concrete', width + 0.18, 0.17, 1.28, x, y, 0.63, undefined, frame);
  b.box('metal', width, 0.055, 0.055, x, y + 1.04, 1.22, undefined, frame);
  b.box('metal', width, 0.038, 0.038, x, y + 0.32, 1.22, undefined, frame);
  for (const side of [-1, 1]) {
    b.box('metal', 0.05, 0.055, 1.2, x + side * width / 2, y + 1.04, 0.63, undefined, frame);
    b.box('metal', 0.043, 1.06, 0.043, x + side * width / 2, y + 0.55, 1.22, undefined, frame);
  }
  for (let index = 1; index < 5; index++) b.box('metal', 0.026, 0.86, 0.026, x - width / 2 + width * index / 5, y + 0.58, 1.22, undefined, frame);
}

function apartment(palette) {
  const b = new Building(palette, 'Six-storey brick apartment');
  const width = 15.5, depth = 12, height = 19.25;
  b.box('concrete', width + 0.6, 0.3, depth + 0.6, 0, 0.15, 0);
  b.box('brick', width, height - 0.3, depth, 0, (height + 0.3) / 2, 0);
  b.box('concrete', width + 0.08, 2.8, depth + 0.08, 0, 1.7, 0);
  // Keep the stairwell cladding clear of the adjacent window reveals.
  b.box('plaster', 2.2, height - 0.3, depth + 0.18, 0, (height + 0.3) / 2, 0);
  for (let floor = 1; floor <= 6; floor++) b.box('trim', width + 0.2, 0.11, depth + 0.2, 0, floor * 3.1 + 0.45, 0);
  const front = facade(width, depth + 0.18);
  entrance(b, front, 0, 1.65, 2.5);
  for (let floor = 0; floor < 6; floor++) {
    const y = 1.83 + floor * 3.1;
    for (const side of ['front', 'back']) {
      // Windows start at their actual wall surface: the ground-floor wrap
      // projects 4 cm and the stairwell cladding projects 9 cm from the brick.
      const frame = facade(width, depth + (floor === 0 ? 0.08 : 0), side);
      for (let column = 0; column < 4; column++) {
        const x = [-5.65, -2.15, 2.15, 5.65][column];
        windowUnit(b, frame, x, y, 1.83, 1.85, floor * 7 + column * 3);
        if (side === 'front' && floor > 0) balcony(b, frame, x, y - 1.04);
      }
      if (floor > 0) windowUnit(b, facade(width, depth + 0.18, side), 0, y, 0.78, 1.5, floor + 2, false);
    }
    for (const side of ['left', 'right']) for (const x of [-3.5, 0, 3.5]) windowUnit(b, facade(width + (floor === 0 ? 0.08 : 0), depth, side), x, y, 1.56, 1.82, floor * 5 + Math.round(x * 2));
  }
  flatRoof(b, width, depth, height);
  b.box('concrete', 3.8, 2.25, 4.0, -2.7, height + 1.12, -1.8);
  b.box('roof', 4.05, 0.12, 4.25, -2.7, height + 2.29, -1.8);
  hvac(b, 3.8, height + 0.15, -2.8, 1.4);
  hvac(b, 3.8, height + 0.15, 0.2, 1.1);
  return b.finish();
}

function office(palette) {
  const b = new Building(palette, 'Ten-storey curtain-wall office');
  const width = 19.2, depth = 14.4, height = 33.7;
  b.box('concrete', width + 1.1, 0.35, depth + 1.1, 0, 0.175, 0);
  b.box('concrete', width - 0.3, height - 0.35, depth - 0.3, 0, (height + 0.35) / 2, 0);
  for (const side of ['front', 'back', 'left', 'right']) {
    const frame = facade(width, depth, side);
    const span = side === 'front' || side === 'back' ? width : depth;
    const bays = Math.round(span / 2.4);
    for (let column = 0; column < bays; column++) {
      const x = -span / 2 + (column + 0.5) * span / bays;
      for (let floor = 0; floor < 10; floor++) {
        const y = 1.83 + floor * 3.3;
        const variation = (floor * 13 + column * 7 + side.length) % 17;
        const glass = variation === 0 ? 'warmGlass' : variation < 6 ? 'darkGlass' : 'coolGlass';
        b.plane(glass, span / bays - 0.13, 2.64, x, y, 0.06, frame);
        b.box('metal', span / bays - 0.08, 0.043, 0.12, x, y + 0.58, 0.095, undefined, frame);
      }
    }
    for (let column = 0; column <= bays; column++) b.box('metal', 0.11, height - 0.4, 0.2, -span / 2 + column * span / bays, height / 2, 0.07, undefined, frame);
    for (let floor = 0; floor <= 10; floor++) {
      b.box('metal', span, 0.48, 0.16, 0, 0.34 + floor * 3.3, 0.055, undefined, frame);
      b.box('trim', span + 0.1, 0.06, 0.25, 0, 0.59 + floor * 3.3, 0.07, undefined, frame);
    }
  }
  const front = facade(width, depth);
  entrance(b, front, -0.75, 1.4, 2.6);
  entrance(b, front, 0.75, 1.4, 2.6);
  b.box('metal', 6.8, 0.16, 2.4, 0, 3.42, depth / 2 + 1.03);
  for (const side of [-1, 1]) b.box('metal', 0.1, 3.18, 0.1, side * 3.03, 1.8, depth / 2 + 2.03);
  flatRoof(b, width, depth, height);
  b.box('concrete', 5.8, 2.3, 4.5, 0, height + 1.2, -2.1);
  b.box('metal', 6.0, 0.14, 4.7, 0, height + 2.4, -2.1);
  for (const x of [-5.8, 5.8]) for (const z of [-3.4, 1.4]) hvac(b, x, height + 0.12, z, 1.3);
  return b.finish();
}

function warehouse(palette) {
  const b = new Building(palette, 'Brick workshop and loading bays');
  const width = 20.2, depth = 12.8, height = 5.6;
  b.box('concrete', width + 0.75, 0.32, depth + 0.75, 0, 0.16, 0);
  b.box('brick', width, height - 0.3, depth, 0, (height + 0.3) / 2, 0);
  b.box('concrete', width + 0.12, 0.7, depth + 0.12, 0, 0.65, 0);
  const front = facade(width, depth);
  for (const x of [-5.45, 0]) {
    b.box('concrete', 4.35, 4.1, 0.22, x, 2.35, depth / 2 + 0.02);
    b.box('metal', 3.95, 3.82, 0.09, x, 2.28, depth / 2 + 0.17);
    for (let row = 0; row < 19; row++) b.box('trim', 3.85, 0.024, 0.035, x, 0.49 + row * 0.195, depth / 2 + 0.23);
    b.box('concrete', 4.55, 0.15, 1.0, x, 0.24, depth / 2 + 0.5);
  }
  entrance(b, front, 6.2, 1.15, 2.3);
  windowUnit(b, front, 6.25, 4.13, 2.2, 1.16, 6);
  for (const side of ['left', 'right', 'back']) {
    const frame = facade(width, depth, side);
    const columns = side === 'back' ? 5 : 3;
    for (let index = 0; index < columns; index++) windowUnit(b, frame, (index - (columns - 1) / 2) * 3.55, 3.94, 2.25, 1.38, index * 4 + 2);
  }
  pitchedRoof(b, width, depth, height, 1.5);
  for (const x of [-5.4, 4.0]) {
    b.box('metal', 0.75, 1.3, 0.75, x, 7.1, -2.6);
    b.box('metal', 1.08, 0.12, 1.08, x, 7.8, -2.6);
  }
  for (const x of [-8.0, -2.7, 2.55, 8.5]) b.pipe(0.075, 0.98, x, 0.62, depth / 2 + 1.15);
  return b.finish();
}

/**
 * Browser-only synchronous factory. Textures/materials are shared by all five
 * prototypes. Clone Groups or instance their material meshes. Call the returned
 * non-enumerable dispose() once after every instance has unmounted.
 */
export function buildArchitectureAssets() {
  const palette = materials();
  const assets = { townhouse: townhouse(palette), villa: villa(palette), apartment: apartment(palette), office: office(palette), warehouse: warehouse(palette) };
  let disposed = false;
  Object.defineProperty(assets, 'dispose', { value: () => {
    if (disposed) return;
    disposed = true;
    for (const group of Object.values(assets)) group.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    for (const material of Object.values(palette)) {
      material.map?.dispose(); material.bumpMap?.dispose(); material.roughnessMap?.dispose(); material.dispose();
    }
  } });
  return assets;
}
