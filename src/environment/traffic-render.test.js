import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TRAFFIC_MODELS, VEHICLE_RENDER_LIMITS } from '../utils/vehicleDimensions.js';
import { sampleRoadFrame } from './road-path.js';
import { cloneTrafficFallback, createTrafficBodyBatches, prepareTrafficModel, updateTrafficBodyBatches, updateTrafficPoses } from './traffic-render.js';

const expectMatrix = (actual, expected) => actual.elements.forEach((value, index) => expect(value).toBeCloseTo(expected.elements[index], 8));
const car = (id, type = 'sedan', z = -40, extras = {}) => ({ id, type, x: 0, z, ownSpeed: 55, actualSpeed: 55, lane: 0, targetLane: 0, isChanging: false, ...extras });
function camera() {
  const result = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 750);
  result.position.set(0, 5.2, 11.5); result.lookAt(0, 0.7, -36); result.updateMatrixWorld(); return result;
}

// Independent source graph built from the assets' authoritative hierarchy,
// accessor bounds and primitive/index counts; no browser textures required.
function sourceScene(path) {
  const bytes = readFileSync(new URL(`../../public${path}`, import.meta.url));
  const gltf = JSON.parse(path.endsWith('.glb') ? bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim() : bytes.toString('utf8'));
  const geometryCache = new Map(), materials = (gltf.materials || []).map(material => new THREE.MeshStandardMaterial({
    transparent: material.alphaMode === 'BLEND', side: material.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
  }));
  const factors = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };
  function geometry(primitive) {
    const key = JSON.stringify({ attributes: primitive.attributes, indices: primitive.indices, mode: primitive.mode });
    if (geometryCache.has(key)) return geometryCache.get(key);
    const accessor = gltf.accessors[primitive.attributes.POSITION];
    const normalize = value => accessor.normalized ? Math.max(-1, value / factors[accessor.componentType]) : value;
    const result = new THREE.BufferGeometry();
    const min = accessor.min.map(normalize), max = accessor.max.map(normalize);
    result.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(accessor.count * 3), 3));
    if (primitive.indices !== undefined) result.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(gltf.accessors[primitive.indices].count), 1));
    result.boundingBox = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    result.boundingSphere = result.boundingBox.getBoundingSphere(new THREE.Sphere());
    geometryCache.set(key, result); return result;
  }
  function node(index) {
    const item = gltf.nodes[index], result = new THREE.Group();
    if (item.matrix) { result.matrix.fromArray(item.matrix); result.matrix.decompose(result.position, result.quaternion, result.scale); }
    else {
      result.position.fromArray(item.translation || [0, 0, 0]); result.quaternion.fromArray(item.rotation || [0, 0, 0, 1]); result.scale.fromArray(item.scale || [1, 1, 1]);
    }
    if (item.mesh !== undefined) for (const primitive of gltf.meshes[item.mesh].primitives) result.add(new THREE.Mesh(geometry(primitive), materials[primitive.material]));
    for (const child of item.children || []) result.add(node(child));
    return result;
  }
  const result = new THREE.Group();
  for (const root of gltf.scenes[gltf.scene || 0].nodes) result.add(node(root));
  return result;
}
function legacyModel(scene, type, rotation) {
  const model = scene.clone(true), box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const limits = VEHICLE_RENDER_LIMITS[type], scale = Math.min(limits.width / size.x, limits.length / size.z);
  model.scale.setScalar(scale); model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  const root = new THREE.Group(); root.rotation.y = rotation; root.add(model); root.updateMatrixWorld(true); return root;
}
function visibleParts(model, pose, view, mainCamera = view) {
  const pv = new THREE.Matrix4().multiplyMatrices(view.projectionMatrix, view.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(pv, view.coordinateSystem, view.reversedDepth);
  const visible = [];
  model.root.traverseVisible(node => {
    if (!node.isMesh || !mainCamera.layers.test(node.layers)) return;
    const object = new THREE.Mesh(node.geometry, node.material); object.matrixWorld.multiplyMatrices(pose.matrix, node.matrixWorld);
    if (!node.frustumCulled || frustum.intersectsObject(object)) visible.push(object);
  });
  return visible;
}
function drawStats(geometry, material, instances = 1) {
  const end = Math.min(geometry.index?.count ?? geometry.attributes.position.count, geometry.drawRange.start + geometry.drawRange.count);
  const ranges = Array.isArray(material) ? geometry.groups.filter(group => material[group.materialIndex]?.visible)
    : material.visible ? [{ start: 0, count: Infinity }] : [];
  return ranges.reduce((result, range) => {
    const count = Math.max(0, Math.min(end, range.start + range.count) - Math.max(geometry.drawRange.start, range.start));
    if (count && instances) { result.calls++; result.triangles += count * instances / 3; }
    return result;
  }, { calls: 0, triangles: 0 });
}
const triangleCount = geometry => Math.min(geometry.index?.count ?? geometry.attributes.position.count, geometry.drawRange.count) / 3;

describe('NPC instancing preserves source geometry and poses', () => {
  it.each(Object.entries(TRAFFIC_MODELS))('matches the existing %s hierarchy/fit exactly', (type, asset) => {
    const scene = sourceScene(asset.path), prepared = prepareTrafficModel(scene, type, asset.rotation);
    const legacy = legacyModel(scene, type, asset.rotation), expected = [];
    legacy.traverseVisible(node => { if (node.isMesh) expected.push(node); });
    expect(prepared.instanced).toBe(true);
    expect(prepared.parts).toHaveLength(expected.length);
    prepared.parts.forEach((part, index) => {
      expect(part.sourceGeometry).toBe(expected[index].geometry);
      expect(part.geometry.attributes.position).toBe(expected[index].geometry.attributes.position); expect(part.material).toBe(expected[index].material);
      expectMatrix(part.matrix, expected[index].matrixWorld);
      const normal = new THREE.Vector3(0.3, 0.7, -0.2).normalize();
      const expectedNormal = normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(part.matrix));
      const columns = [0, 1, 2].map(axis => new THREE.Vector3().setFromMatrixColumn(part.matrix, axis));
      const instancedNormal = new THREE.Vector3().addScaledVector(columns[0], normal.x / columns[0].lengthSq())
        .addScaledVector(columns[1], normal.y / columns[1].lengthSq()).addScaledVector(columns[2], normal.z / columns[2].lengthSq()).normalize();
      expect(instancedNormal.distanceTo(expectedNormal)).toBeLessThan(1e-6);
    });
  });

  it('keeps curve/lane-change body poses identical to the ID-specific light group pose', () => {
    const poses = new Map(), enemy = car('turning', 'sedan', -95, { x: 1.8, isChanging: true, changeProgress: 0.4, targetLane: 1 });
    const state = { totalDistance: 70, gameState: 'playing', enemies: [enemy] };
    updateTrafficPoses(poses, state, 1 / 60);
    const road = sampleRoadFrame(350, enemy.z), lateral = 6 * 0.4 * 0.6 * 4.5 / 1.35;
    const target = THREE.MathUtils.clamp(-Math.atan2(lateral, 55 * 0.5), -0.18, 0.18);
    const yaw = road.yaw + target * (1 - Math.exp(-10 / 60));
    const group = new THREE.Group(); group.position.set(road.x + enemy.x * Math.cos(road.yaw), -0.025, road.z - enemy.x * Math.sin(road.yaw)); group.rotation.y = yaw; group.updateMatrixWorld(true);
    expectMatrix(poses.get(enemy.id).matrix, group.matrixWorld);
    const turn = poses.get(enemy.id).turn; updateTrafficPoses(poses, { ...state, gameState: 'paused' }, 1);
    expect(poses.get(enemy.id).turn).toBe(turn);
    updateTrafficPoses(poses, { ...state, enemies: [] }, 1 / 60); expect(poses.size).toBe(0);
  });

  it('matches primitive frustum culling for the main camera and every shadow camera', () => {
    const asset = TRAFFIC_MODELS.sedan, model = prepareTrafficModel(sourceScene(asset.path), 'sedan', asset.rotation);
    const resource = createTrafficBodyBatches({ sedan: model });
    const enemies = [car('near'), car('far', 'sedan', -310), car('off-road', 'sedan', -80, { x: 250 })];
    const poses = updateTrafficPoses(new Map(), { enemies, totalDistance: 70, gameState: 'playing' }, 1 / 60);
    const views = [camera(), camera(), camera(), camera()]; views[1].far = 40; views[2].near = 40; views[2].far = 130; views[3].near = 130;
    views.forEach(view => view.updateProjectionMatrix());
    updateTrafficBodyBatches(resource, enemies, poses, views);
    for (const view of resource.views) {
      const expected = enemies.flatMap(enemy => visibleParts(model, poses.get(enemy.id), views[view.index], views[0]));
      expect(view.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(expected.length);
      const actualTriangles = view.entries.reduce((sum, entry) => sum + entry.count * triangleCount(entry.batch.geometry), 0);
      expect(actualTriangles).toBeCloseTo(expected.reduce((sum, object) => sum + triangleCount(object.geometry), 0));
    }
    views[0].layers.set(4); updateTrafficBodyBatches(resource, enemies, poses, views);
    expect(resource.views.every(view => view.entries.every(entry => entry.count === 0))).toBe(true);
    resource.dispose();
  });

  it('uses public draw hooks to exclude shadow-only buffers from other passes', () => {
    const model = prepareTrafficModel(sourceScene(TRAFFIC_MODELS.suv.path), 'suv', Math.PI);
    const resource = createTrafficBodyBatches({ suv: model });
    const main = camera(), shadow = camera(), other = camera();
    const enemies = [car('one', 'suv')], poses = updateTrafficPoses(new Map(), { enemies, totalDistance: 0 }, 1 / 60);
    updateTrafficBodyBatches(resource, enemies, poses, [main, shadow]);
    const mainEntry = resource.views[0].entries[0], shadowEntry = resource.views[1].entries[0];
    mainEntry.mesh.onBeforeRender(null, null, main); expect(mainEntry.mesh.count).toBe(mainEntry.count);
    shadowEntry.mesh.onBeforeShadow(null, null, main, shadow); expect(shadowEntry.mesh.count).toBe(shadowEntry.count);
    shadowEntry.mesh.onBeforeShadow(null, null, main, other); expect(shadowEntry.mesh.count).toBe(0);
    shadowEntry.mesh.onBeforeRender(null, null, main); expect(shadowEntry.mesh.count).toBe(0);
    resource.dispose();
  });

  it('reduces dense12 body draws while preserving every original triangle', () => {
    const models = Object.fromEntries(Object.entries(TRAFFIC_MODELS).map(([type, asset]) => [type, prepareTrafficModel(sourceScene(asset.path), type, asset.rotation)]));
    const enemies = Array.from({ length: 12 }, (_, index) => car(`dense-${index}`, Object.keys(models)[index % 4], -40 - Math.floor(index / 4) * 18, { x: [-4.5, 0, 4.5][index % 3] }));
    const poses = updateTrafficPoses(new Map(), { enemies, totalDistance: 0 }, 1 / 60), main = camera();
    const resource = createTrafficBodyBatches(models), views = [main, camera(), camera(), camera()];
    updateTrafficBodyBatches(resource, enemies, poses, views);
    for (const view of resource.views) {
      const expected = enemies.flatMap(enemy => visibleParts(models[enemy.type], poses.get(enemy.id), views[view.index], main));
      const entries = view.entries.filter(entry => entry.count > 0);
      const old = expected.reduce((sum, object) => { const value = drawStats(object.geometry, object.material); return { calls: sum.calls + value.calls, triangles: sum.triangles + value.triangles }; }, { calls: 0, triangles: 0 });
      const batched = entries.reduce((sum, entry) => { const value = drawStats(entry.batch.geometry, entry.batch.material, entry.count); return { calls: sum.calls + value.calls, triangles: sum.triangles + value.triangles }; }, { calls: 0, triangles: 0 });
      expect(batched.calls).toBeLessThan(old.calls / 2);
      expect(batched.triangles).toBeCloseTo(old.triangles);
    }
    resource.dispose();
  });

  it('preserves multi-material groups and a partial geometry draw range', () => {
    const source = new THREE.Group(), geometry = new THREE.BoxGeometry(1, 1, 3);
    geometry.clearGroups(); geometry.addGroup(0, 6, 0); geometry.addGroup(6, 6, 1); geometry.addGroup(12, 6, 1); geometry.setDrawRange(3, 12);
    const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
    source.add(new THREE.Mesh(geometry, materials));
    const model = prepareTrafficModel(source, 'sedan'), resource = createTrafficBodyBatches({ sedan: model });
    const enemies = [car('first'), car('second', 'sedan', -50)], main = camera();
    const poses = updateTrafficPoses(new Map(), { enemies, totalDistance: 0 }, 1 / 60);
    updateTrafficBodyBatches(resource, enemies, poses, [main]);
    const entry = resource.views[0].entries[0];
    expect(entry.batch.sourceGeometry).toBe(geometry);
    expect(entry.mesh.geometry.attributes.position).toBe(geometry.attributes.position); entry.mesh.material.forEach((material, index) => expect(material).toBe(materials[index]));
    const old = drawStats(geometry, materials, 2), batched = drawStats(entry.mesh.geometry, entry.mesh.material, entry.count);
    expect(batched.triangles).toBe(old.triangles); expect(batched.calls).toBe(3);
    resource.dispose();
  });

  it.each(['transparent', 'mirrored', 'sheared'])('retains ordinary geometry/material rendering for %s future sources', mode => {
    const source = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 3), new THREE.MeshStandardMaterial({ transparent: mode === 'transparent' }));
    source.add(mesh);
    if (mode === 'mirrored') mesh.scale.x = -1;
    if (mode === 'sheared') { const parent = new THREE.Group(); parent.scale.set(2, 1, 1); mesh.rotation.y = 0.5; source.remove(mesh); parent.add(mesh); source.add(parent); }
    const prepared = prepareTrafficModel(source, 'sedan');
    expect(prepared.instanced).toBe(false); expect(cloneTrafficFallback(prepared).children).toHaveLength(1);
    const resource = createTrafficBodyBatches({ sedan: prepared }); expect(resource.root.children).toHaveLength(0); resource.dispose();
  });
});
