import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { damp } from '../utils/gameplay.js';
import { LANE_CHANGE_DURATION, LANE_WIDTH, WORLD_SPEED_SCALE } from '../utils/traffic.js';
import { VEHICLE_RENDER_LIMITS } from '../utils/vehicleDimensions.js';
import { sampleRoadFrame } from './road-path.js';
import { exactTrafficGeometry } from './exact-geometry.js';

function hasShear(matrix) {
  const x = new THREE.Vector3().setFromMatrixColumn(matrix, 0).normalize();
  const y = new THREE.Vector3().setFromMatrixColumn(matrix, 1).normalize();
  const z = new THREE.Vector3().setFromMatrixColumn(matrix, 2).normalize();
  return Math.max(Math.abs(x.dot(y)), Math.abs(x.dot(z)), Math.abs(y.dot(z))) > 1e-6;
}

// Reproduce VehicleModel's existing primitive position/scale overrides before
// extracting node matrices. Original attributes/materials/textures stay shared;
// derived indices improve cache order without changing any source triangle.
export function prepareTrafficModel(scene, type, rotation = 0) {
  const model = cloneSkeleton(scene);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const limits = VEHICLE_RENDER_LIMITS[type];
  const scale = Math.min(limits.width / size.x, limits.length / size.z);
  model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  model.scale.setScalar(scale);
  const root = new THREE.Group();
  root.rotation.y = rotation;
  root.add(model);
  root.updateMatrixWorld(true);
  const parts = [];
  let instanced = true;
  root.traverseVisible(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = [node.material].flat();
    // Ordinary per-ID meshes preserve transparency sorting, skinning/morphs
    // and mirrored winding if a future replacement model needs any of them.
    if (node.isSkinnedMesh || node.morphTargetInfluences?.length || node.matrixWorld.determinant() < 0 || hasShear(node.matrixWorld)
      || materials.some(material => material.transparent || material.isShaderMaterial || material.isRawShaderMaterial)) instanced = false;
    if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
    parts.push({ geometry: node.geometry, sourceGeometry: node.geometry, material: node.material, matrix: node.matrixWorld.clone(),
      renderOrder: node.renderOrder, layers: node.layers.mask, frustumCulled: node.frustumCulled,
      customDepthMaterial: node.customDepthMaterial, customDistanceMaterial: node.customDistanceMaterial });
  });
  let geometryPrepareMs = 0;
  const prepared = new Set();
  if (instanced) for (const part of parts) {
    const geometry = exactTrafficGeometry(part.sourceGeometry, part.material, part);
    part.geometry = geometry.color;
    part.shadowGeometry = geometry.shadow;
    if (!prepared.has(part.sourceGeometry)) {
      prepared.add(part.sourceGeometry);
      geometryPrepareMs += geometry.colorPrepareMs + geometry.shadowPrepareMs;
    }
  }
  const grouped = new Map();
  for (const part of parts) {
    const key = [part.geometry.uuid, ...[part.material].flat().map(material => material.uuid),
      part.renderOrder, part.layers, part.frustumCulled, part.customDepthMaterial?.uuid, part.customDistanceMaterial?.uuid].join(':');
    if (!grouped.has(key)) grouped.set(key, { ...part, matrices: [] });
    grouped.get(key).matrices.push(part.matrix);
  }
  return { type, root, parts, batches: [...grouped.values()], instanced, geometryPrepareMs };
}

export function cloneTrafficFallback(model) { return cloneSkeleton(model.root); }

// Bodies and ID-specific lamps consume this same road pose. Steering yaw is
// integrated once per frame, preventing body/lamp drift or doubled damping.
export function updateTrafficPoses(cache, state, delta) {
  const active = new Set();
  const road = {};
  for (const enemy of state.enemies) {
    active.add(enemy.id);
    let pose = cache.get(enemy.id);
    if (!pose) {
      pose = { matrix: new THREE.Matrix4(), turn: 0, x: 0, y: -0.025, z: 0, yaw: 0 };
      cache.set(enemy.id, pose);
    }
    sampleRoadFrame(state.totalDistance * 5, enemy.z, road);
    const progress = THREE.MathUtils.clamp(enemy.changeProgress ?? 0, 0, 1);
    const lateralSpeed = enemy.isChanging ? 6 * progress * (1 - progress) * (enemy.targetLane - enemy.lane) * LANE_WIDTH / LANE_CHANGE_DURATION : 0;
    const forwardSpeed = (enemy.actualSpeed ?? enemy.ownSpeed ?? 55) * WORLD_SPEED_SCALE;
    const targetTurn = THREE.MathUtils.clamp(-Math.atan2(lateralSpeed, Math.max(1, forwardSpeed)), -0.18, 0.18);
    if (state.gameState !== 'paused') pose.turn = damp(pose.turn, targetTurn, 10, Math.min(delta, 0.1));
    pose.x = road.x + enemy.x * Math.cos(road.yaw);
    pose.z = road.z - enemy.x * Math.sin(road.yaw);
    pose.yaw = road.yaw + pose.turn;
    pose.matrix.makeRotationY(pose.yaw).setPosition(pose.x, pose.y, pose.z);
  }
  for (const id of cache.keys()) if (!active.has(id)) cache.delete(id);
  return cache;
}

export function createTrafficBodyBatches(models, maxCars = 12, shadowViews = 3) {
  const root = new THREE.Group();
  root.name = 'traffic-instanced-bodies';
  root.userData.exactGeometryPreparationMs = Object.values(models).reduce((sum, model) => sum + model.geometryPrepareMs, 0);
  const views = Array.from({ length: shadowViews + 1 }, (_, index) => ({ index, camera: null, entries: [] }));
  for (const view of views) for (const model of Object.values(models)) {
    if (!model.instanced) continue;
    for (const batch of model.batches) {
      const geometry = view.index === 0 ? batch.geometry : batch.shadowGeometry || batch.geometry;
      const mesh = new THREE.InstancedMesh(geometry, batch.material, maxCars * batch.matrices.length);
      const entry = { mesh, batch, type: model.type, count: 0, ids: [] };
      mesh.name = `traffic-body-${model.type}-${view.index}-${view.entries.length}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.castShadow = view.index !== 0;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false; // Exact per-instance culling is performed below.
      mesh.matrixAutoUpdate = false;
      mesh.renderOrder = batch.renderOrder;
      mesh.layers.mask = batch.layers;
      mesh.customDepthMaterial = batch.customDepthMaterial;
      mesh.customDistanceMaterial = batch.customDistanceMaterial;
      mesh.visible = false;
      mesh.count = 0;
      // Three's public hooks run before each draw. Separate fixed buffers
      // avoid changing GPU attributes between shadow passes in one frame.
      mesh.onBeforeRender = (_renderer, _scene, camera) => { mesh.count = view.index === 0 && view.camera === camera ? entry.count : 0; };
      mesh.onBeforeShadow = (_renderer, _object, _camera, shadowCamera) => { mesh.count = view.index !== 0 && view.camera === shadowCamera ? entry.count : 0; };
      mesh.userData.instanceEntityIds = entry.ids;
      root.add(mesh);
      view.entries.push(entry);
    }
  }
  return { root, views, types: new Set(Object.keys(models)), dispose() { root.traverse(node => { if (node.isInstancedMesh) node.dispose(); }); } };
}

const projectionView = new THREE.Matrix4();
const frustum = new THREE.Frustum();
const world = new THREE.Matrix4();
const sphere = new THREE.Sphere();

export function updateTrafficBodyBatches(resource, enemies, poses, cameras) {
  for (const view of resource.views) {
    const camera = cameras[view.index];
    view.camera = camera || null;
    if (camera) {
      projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projectionView, camera.coordinateSystem, camera.reversedDepth);
    }
    for (const entry of view.entries) {
      let count = 0;
      entry.ids.length = 0;
      // WebGLShadowMap tests object layers against the main render camera,
      // just like the visible pass, even when using a cascade's frustum.
      if (camera && cameras[0].layers.test({ mask: entry.batch.layers })) for (const enemy of enemies) {
        const type = resource.types.has(enemy.type) ? enemy.type : 'sedan';
        if (type !== entry.type) continue;
        const pose = poses.get(enemy.id);
        if (!pose) continue;
        for (const local of entry.batch.matrices) {
          world.multiplyMatrices(pose.matrix, local);
          sphere.copy(entry.batch.geometry.boundingSphere).applyMatrix4(world);
          // This is the old Mesh/Frustum.intersectsObject sphere test, using
          // each original source primitive rather than a broad batch bound.
          if (entry.batch.frustumCulled && !frustum.intersectsSphere(sphere)) continue;
          entry.mesh.setMatrixAt(count++, world);
          entry.ids.push(enemy.id);
        }
      }
      entry.count = count;
      entry.mesh.count = count;
      entry.mesh.visible = count > 0;
      entry.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}

export function createTrafficWarmup(models) {
  const root = new THREE.Group();
  for (const model of Object.values(models)) {
    if (!model.instanced) { root.add(cloneTrafficFallback(model)); continue; }
    for (const batch of model.batches) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.material, 1);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
  }
  return root;
}
