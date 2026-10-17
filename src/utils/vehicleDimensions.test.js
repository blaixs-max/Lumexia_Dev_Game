import { readFileSync } from 'node:fs';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CARS } from './garage';
import { getPlayerDimensions, TRAFFIC_MODELS, VEHICLE_DIMENSIONS, VEHICLE_RENDER_LIMITS } from './vehicleDimensions';

// GLTFLoader constructs geometry bounds from POSITION accessor metadata even
// for compressed models. Read the real assets and apply their scene transforms
// so a future model replacement cannot silently leave stale collision bounds.
function modelBounds(path) {
  const bytes = readFileSync(new URL(`../../public${path}`, import.meta.url));
  const gltf = JSON.parse(path.endsWith('.glb')
    ? bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim()
    : bytes.toString('utf8'));
  const result = new Box3();
  const factors = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

  function visit(index, parent) {
    const node = gltf.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation || [0, 0, 0]),
      new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
      new Vector3().fromArray(node.scale || [1, 1, 1]),
    );
    const world = parent.clone().multiply(local);
    for (const primitive of gltf.meshes?.[node.mesh]?.primitives || []) {
      const accessor = gltf.accessors[primitive.attributes.POSITION];
      expect(accessor.min, `${path}: missing POSITION minimum`).toHaveLength(3);
      expect(accessor.max, `${path}: missing POSITION maximum`).toHaveLength(3);
      const normalize = value => accessor.normalized ? Math.max(-1, value / factors[accessor.componentType]) : value;
      result.union(new Box3(new Vector3(...accessor.min.map(normalize)), new Vector3(...accessor.max.map(normalize))).applyMatrix4(world));
    }
    for (const child of node.children || []) visit(child, world);
  }
  for (const root of gltf.scenes[gltf.scene || 0].nodes) visit(root, new Matrix4());
  expect(result.isEmpty(), `${path}: model must have a measurable footprint`).toBe(false);
  return result.getSize(new Vector3());
}

const models = [
  ...CARS.map(car => ({ name: `player/${car.id}`, path: car.model, limits: VEHICLE_RENDER_LIMITS.player, footprint: getPlayerDimensions(car.id) })),
  ...Object.entries(TRAFFIC_MODELS).map(([type, model]) => ({ name: `traffic/${type}`, path: model.path, limits: VEHICLE_RENDER_LIMITS[type], footprint: VEHICLE_DIMENSIONS[type] })),
];

describe('collision footprints match the actual fitted vehicle assets', () => {
  it.each(models)('$name', ({ path, limits, footprint }) => {
    const source = modelBounds(path);
    const scale = Math.min(limits.width / source.x, limits.length / source.z);
    expect(Number.isFinite(scale) && scale > 0).toBe(true);
    expect(footprint.width).toBeCloseTo(source.x * scale, 5);
    expect(footprint.length).toBeCloseTo(source.z * scale, 5);
  });
});
