import * as THREE from 'three';

export const ROAD_ROUTE_LENGTH = 1800;
export const TUNNEL_START = 650;
export const TUNNEL_LENGTH = 150;

const FREQUENCY = Math.PI * 2 / ROAD_ROUTE_LENGTH;
const ENTRY_BLEND = 15;
const REAR_RECYCLE_DISTANCE = 80;
const modulo = (value, period) => ((value % period) + period) % period;
const smoothstep = value => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// The two harmonics describe broad S bends with matching position, tangent,
// and curvature at the cycle seam. Render stations use totalDistance * 5;
// logical negative Z is ahead. Collision coordinates stay in the road frame.
const driver = { distance: NaN, phase: 0, x: 0, yaw: 0, cos: 1, sin: 0 };
function prepareDriver(distance) {
  if (!Number.isFinite(distance)) throw new RangeError('Road distance must be finite.');
  if (driver.distance === distance) return driver;
  const phase = modulo(distance, ROAD_ROUTE_LENGTH);
  const angle = phase * FREQUENCY;
  const slope = FREQUENCY * (72 * Math.cos(angle) + 36 * Math.cos(2 * angle));
  const yaw = Math.atan(slope);
  Object.assign(driver, { distance, phase, x: 72 * Math.sin(angle) + 18 * Math.sin(2 * angle), yaw, cos: Math.cos(yaw), sin: Math.sin(yaw) });
  return driver;
}

/** Driver-relative center/yaw at a logical road Z. Optional target is reused. */
export function sampleRoadFrame(distance, z, target = {}) {
  if (!Number.isFinite(z)) throw new RangeError('Road Z must be finite.');
  const base = prepareDriver(distance);
  const angle = (base.phase - z) * FREQUENCY;
  const offset = 72 * Math.sin(angle) + 18 * Math.sin(2 * angle) - base.x;
  const slope = FREQUENCY * (72 * Math.cos(angle) + 36 * Math.cos(2 * angle));
  target.x = base.cos * offset + base.sin * z;
  target.z = -base.sin * offset + base.cos * z;
  target.yaw = base.yaw - Math.atan(slope);
  return target;
}

const anchor = {};
const frameMatrix = new THREE.Matrix4();

/**
 * Write a WORLD matrix: path frame at z multiplied by the rigid local matrix.
 * localMatrix may contain local Z (e.g. a mesh's offset from its anchor); do
 * not also include that offset in z. Safe when targetMatrix === localMatrix.
 */
export function placeOnRoad(targetMatrix, localMatrix, z, distance) {
  const frame = sampleRoadFrame(distance, z, anchor);
  frameMatrix.makeRotationY(frame.yaw);
  frameMatrix.setPosition(frame.x, 0, frame.z);
  return targetMatrix.multiplyMatrices(frameMatrix, localMatrix);
}

/**
 * Bend a tessellated corridor from immutable original position/normal arrays.
 * Parent group must be unrotated at [0, 0, offsetZ]. Original local Z is sampled
 * at z + offsetZ, then offsetZ is subtracted from the output's local Z.
 * Use this for road/tunnel strips, not rigid models or a kilometre-wide terrain.
 * Attributes and original arrays retain their identity across all updates.
 */
export function deformRoadGeometry(geometry, originalPositions, originalNormals, distance, offsetZ = 0) {
  if (!Number.isFinite(offsetZ)) throw new RangeError('Road geometry offset must be finite.');
  const base = prepareDriver(distance);
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const sourcePositions = originalPositions?.array || originalPositions;
  const sourceNormals = originalNormals?.array || originalNormals;
  if (!position || position.itemSize !== 3 || sourcePositions?.length !== position.array.length || sourcePositions === position.array) {
    throw new TypeError('Road geometry requires a separate original XYZ position array.');
  }
  if (normal && (!sourceNormals || sourceNormals.length !== normal.array.length || normal.itemSize !== 3 || sourceNormals === normal.array)) {
    throw new TypeError('Road geometry requires a separate original XYZ normal array.');
  }
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < sourcePositions.length; i += 3) {
    const x = sourcePositions[i], y = sourcePositions[i + 1], z = sourcePositions[i + 2] + offsetZ;
    const angle = (base.phase - z) * FREQUENCY;
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const sin2 = Math.sin(2 * angle), cos2 = Math.cos(2 * angle);
    const offset = 72 * sin + 18 * sin2 - base.x;
    const slope = FREQUENCY * (72 * cos + 36 * cos2);
    const yaw = base.yaw - Math.atan(slope);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const px = base.cos * offset + base.sin * z + c * x;
    const pz = -base.sin * offset + base.cos * z - s * x - offsetZ;
    position.array[i] = px; position.array[i + 1] = y; position.array[i + 2] = pz;
    minX = Math.min(minX, px); minY = Math.min(minY, y); minZ = Math.min(minZ, pz);
    maxX = Math.max(maxX, px); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, pz);
    if (normal) {
      // Inverse-transpose Jacobian: tangent scale includes the different
      // lengths of inner and outer lanes. Flat road normals remain world-up.
      const secondDerivative = -FREQUENCY * FREQUENCY * (72 * sin + 72 * sin2);
      const yawDerivative = secondDerivative / (1 + slope * slope);
      const tangentScale = Math.sqrt(1 + slope * slope) - x * yawDerivative;
      const safeScale = Math.abs(tangentScale) < 1e-6 ? (tangentScale < 0 ? -1e-6 : 1e-6) : tangentScale;
      const nx = sourceNormals[i], ny = sourceNormals[i + 1], nz = sourceNormals[i + 2] / safeScale;
      const length = Math.hypot(nx, ny, nz) || 1;
      normal.array[i] = (c * nx + s * nz) / length;
      normal.array[i + 1] = ny / length;
      normal.array[i + 2] = (-s * nx + c * nz) / length;
    }
  }
  position.needsUpdate = true;
  if (normal) normal.needsUpdate = true;
  geometry.boundingBox ||= new THREE.Box3();
  geometry.boundingSphere ||= new THREE.Sphere();
  if (position.count) {
    geometry.boundingBox.min.set(minX, minY, minZ);
    geometry.boundingBox.max.set(maxX, maxY, maxZ);
    // A box-derived sphere is conservative and needs no second vertex scan.
    geometry.boundingBox.getBoundingSphere(geometry.boundingSphere);
  } else {
    geometry.boundingBox.makeEmpty();
    geometry.boundingSphere.center.set(0, 0, 0); geometry.boundingSphere.radius = 0;
  }
  return geometry;
}

/** Smooth interior amount at a road station, including 15m entry/exit fades. */
export function sampleTunnelAmount(distance, z = 0) {
  if (!Number.isFinite(distance) || !Number.isFinite(z)) throw new RangeError('Tunnel station must be finite.');
  const station = modulo(distance - z - TUNNEL_START, ROAD_ROUTE_LENGTH);
  if (station >= TUNNEL_LENGTH) return 0;
  return smoothstep(station / ENTRY_BLEND) * smoothstep((TUNNEL_LENGTH - station) / ENTRY_BLEND);
}

/** Front stays continuous until the rear is 80m behind, then recycles ahead. */
export function tunnelStartZ(distance) {
  if (!Number.isFinite(distance)) throw new RangeError('Tunnel distance must be finite.');
  const rear = TUNNEL_LENGTH + REAR_RECYCLE_DISTANCE;
  return modulo(distance - TUNNEL_START - rear, ROAD_ROUTE_LENGTH) + rear - ROAD_ROUTE_LENGTH;
}

/** Inclusive full-stretch mask; margin expands both portals in road metres. */
export function roadPositionInsideTunnel(distance, z, margin = 0) {
  if (!Number.isFinite(distance) || !Number.isFinite(z) || !Number.isFinite(margin)) throw new RangeError('Tunnel mask arguments must be finite.');
  const padding = Math.max(0, margin);
  if (TUNNEL_LENGTH + 2 * padding >= ROAD_ROUTE_LENGTH) return true;
  const station = modulo(distance - z - TUNNEL_START + padding, ROAD_ROUTE_LENGTH);
  return station <= TUNNEL_LENGTH + 2 * padding;
}
