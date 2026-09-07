import * as THREE from 'three';

function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

function surface(kind, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const random = seeded(kind === 'grass' ? 912 : 423);
  const pixels = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = random() * 26 - 13;
    const broad = Math.sin(x * 0.024) * Math.cos(y * 0.03) * 8 + Math.sin((x + y) * 0.081) * 4;
    const base = kind === 'grass' ? [90, 99, 66] : [151, 148, 137];
    const offset = (y * size + x) * 4;
    for (let k = 0; k < 3; k++) pixels.data[offset + k] = base[k] + grain + broad;
    pixels.data[offset + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  if (kind === 'grass') {
    for (let i = 0; i < 22000; i++) {
      const x = random() * size, y = random() * size;
      ctx.strokeStyle = random() > 0.65 ? 'rgba(171,158,101,.3)' : 'rgba(38,54,30,.35)';
      ctx.lineWidth = 0.4 + random();
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + random() * 4 - 2, y - random() * 7); ctx.stroke();
    }
  } else {
    ctx.strokeStyle = 'rgba(54,53,46,.46)'; ctx.lineWidth = 3;
    for (let row = 0; row < 4; row++) {
      const y = row * 128;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
      for (let col = 0; col < 4; col++) {
        const x = col * 128 + (row % 2) * 64;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 128); ctx.stroke();
      }
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 8;
  return map;
}

export function createLandscape() {
  const grass = surface('grass'); grass.repeat.set(260, 260);
  const paving = surface('paving'); paving.repeat.set(1, 150);
  const contactCanvas = document.createElement('canvas'); contactCanvas.width = contactCanvas.height = 64;
  const contactContext = contactCanvas.getContext('2d');
  const gradient = contactContext.createRadialGradient(32, 32, 3, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(15,23,11,.42)'); gradient.addColorStop(0.4, 'rgba(15,23,11,.21)'); gradient.addColorStop(1, 'rgba(15,23,11,0)');
  contactContext.fillStyle = gradient; contactContext.fillRect(0, 0, 64, 64);
  const contact = new THREE.CanvasTexture(contactCanvas);
  const terrain = new THREE.PlaneGeometry(1900, 1100, 140, 75);
  terrain.rotateX(-Math.PI / 2);
  terrain.translate(0, -2, -950);
  const positions = terrain.attributes.position;
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i);
    const valley = THREE.MathUtils.smoothstep(Math.abs(x), 30, 230);
    const horizon = THREE.MathUtils.smoothstep(-z, 420, 900);
    const rolling = 33 + Math.sin(x * 0.006 + z * 0.007) * 20 + Math.cos(x * 0.013 - z * 0.011) * 13 + Math.sin(x * 0.031 + z * 0.019) * 4;
    positions.setY(i, -3 + valley * (25 + rolling) * horizon + horizon * 4);
    color.set('#68735a').lerp(new THREE.Color('#9da692'), horizon * 0.35);
    color.multiplyScalar(0.91 + Math.sin(x * 0.07 + z * 0.11) * 0.05);
    colors.push(color.r, color.g, color.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();

  // W-profile crash barrier: two folds catch the sun instead of a flat floating beam.
  const profile = [[0.02, 0.55], [0.10, 0.61], [0.02, 0.69], [-0.03, 0.75], [0.02, 0.81], [0.10, 0.89], [0.02, 0.95]];
  const railVertices = [], railIndices = [];
  for (const [x, y] of profile) railVertices.push(x, y, -550, x, y, 65);
  for (let i = 0; i < profile.length - 1; i++) { const a = i * 2; railIndices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const rail = new THREE.BufferGeometry();
  rail.setAttribute('position', new THREE.Float32BufferAttribute(railVertices, 3));
  rail.setIndex(railIndices); rail.computeVertexNormals();
  return { grass, paving, contact, terrain, rail };
}

export const WORLD_SPAN = 720;
export function createPlacements(low) {
  const plots = { oak: [], oak2: [], poplar: [], pine: [], shrubs: [], streetlamp: [], townhouse: [], villa: [], apartment: [], office: [], warehouse: [], fence: [], bench: [], utilityBox: [], grasses: [] };
  const random = seeded(6421);
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 18; i++) {
      const z = i * 40 + (side === 1 ? 16 : 0);
      const city = i % 9 >= 4;
      const type = city ? (i % 3 ? 'apartment' : 'office') : (i % 2 ? 'villa' : 'townhouse');
      const houseX = city ? 32 + random() * 7 : 23 + random() * 3;
      if (!low || i % 4 !== 3) plots[type].push({ x: side * houseX, z, rotation: side * -Math.PI / 2, scale: 0.92 + random() * 0.16 });
      if (!low && i % 3 === 0) plots[city ? 'office' : 'warehouse'].push({ x: side * (58 + random() * 13), z: z + 20, rotation: side * -Math.PI / 2, scale: 0.9 + random() * 0.3 });
      const treeType = city ? 'poplar' : i % 3 === 0 ? 'pine' : i % 2 ? 'oak2' : 'oak';
      plots[treeType].push({ x: side * (15.8 + random() * 2), z: z + 12, rotation: random() * Math.PI * 2, scale: 0.82 + random() * 0.28 });
      if (!low) plots[i % 2 ? 'pine' : 'oak'].push({ x: side * (46 + random() * 24), z: z + 30, rotation: random() * 6, scale: 1.1 + random() * 0.4 });
      if (!low || i % 2 === 0) plots.shrubs.push({ x: side * (13.7 + random()), z: z + 20, rotation: random() * 6, scale: 0.65 + random() * 0.5 });
      plots.streetlamp.push({ x: side * 10.85, z: i * 40, rotation: side < 0 ? Math.PI : 0, scale: 1 });
      if (i % 3 === 0) plots.bench.push({ x: side * 13.25, z: z + 3, rotation: side * -Math.PI / 2, scale: 1 });
      if (i % 5 === 0) plots.utilityBox.push({ x: side * 11, z: z + 18, rotation: side * -Math.PI / 2, scale: 1 });
      if (!city) for (let segment = 0; segment < 3; segment++) plots.fence.push({ x: side * 18.8, z: z + 22 + segment * 3, rotation: Math.PI / 2, scale: 1 });
      for (let tuft = 0; tuft < (low ? 3 : 7); tuft++) plots.grasses.push({ x: side * (14.4 + random() * 5), z: z + random() * 40, rotation: random() * 6, scale: 0.7 + random() * 0.7 });
    }
  }
  return plots;
}
