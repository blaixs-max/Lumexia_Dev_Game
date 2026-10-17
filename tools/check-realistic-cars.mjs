// Offline geometry/resource validation: node tools/check-realistic-cars.mjs [--details]
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const directory = new URL('../public/models/realistic/', import.meta.url);
const types = { 5120: ['getInt8', 1, 127], 5121: ['getUint8', 1, 255], 5122: ['getInt16', 2, 32767], 5123: ['getUint16', 2, 65535], 5125: ['getUint32', 4, 4294967295], 5126: ['getFloat32', 4, 1] };
const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
await MeshoptDecoder.ready;

export async function inspectCar(file) {
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  assert.equal(file.readUInt32LE(16), 0x4e4f534a);
  const length = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + length));
  assert.equal(file.readUInt32LE(24 + length), 0x004e4942);
  const binary = file.subarray(28 + length);
  assert.ok(binary.length >= gltf.buffers[0].byteLength);
  assert.ok(gltf.buffers.every(buffer => !buffer.uri), 'No remote buffers are permitted.');
  const decoded = gltf.bufferViews.map(view => {
    const extension = view.extensions?.EXT_meshopt_compression;
    if (extension) {
      assert.equal(extension.buffer, 0);
      assert.ok(extension.byteOffset + extension.byteLength <= binary.length);
      const output = new Uint8Array(extension.count * extension.byteStride);
      MeshoptDecoder.decodeGltfBuffer(output, extension.count, extension.byteStride,
        binary.subarray(extension.byteOffset, extension.byteOffset + extension.byteLength), extension.mode, extension.filter);
      assert.equal(output.byteLength, view.byteLength);
      return output;
    }
    assert.equal(view.buffer, 0);
    const start = view.byteOffset || 0;
    assert.ok(start + view.byteLength <= binary.length);
    return binary.subarray(start, start + view.byteLength);
  });
  const textures = (gltf.images || []).map(image => {
    assert.ok(!image.uri, 'The race must load without external image requests.');
    assert.ok(['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType));
    const bytes = decoded[image.bufferView];
    assert.ok(bytes.length > 16);
    if (image.mimeType === 'image/png') {
      assert.equal(Buffer.from(bytes).readUInt32BE(0), 0x89504e47);
      return { type: image.mimeType, width: Buffer.from(bytes).readUInt32BE(16), height: Buffer.from(bytes).readUInt32BE(20), bytes: bytes.length };
    }
    if (image.mimeType === 'image/webp') {
      assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), 'RIFF');
      assert.equal(Buffer.from(bytes).subarray(8, 12).toString(), 'WEBP');
    } else assert.equal(Buffer.from(bytes).readUInt16BE(0), 0xffd8);
    return { type: image.mimeType, bytes: bytes.length };
  });
  const cache = new Map();
  const accessor = index => {
    if (cache.has(index)) return cache.get(index);
    const definition = gltf.accessors[index], bufferView = gltf.bufferViews[definition.bufferView];
    const bytes = decoded[definition.bufferView];
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const [getter, componentBytes, maximum] = types[definition.componentType];
    const width = widths[definition.type], stride = bufferView.byteStride || width * componentBytes;
    const start = definition.byteOffset || 0;
    assert.ok(width && !definition.sparse);
    assert.ok(start + (definition.count - 1) * stride + width * componentBytes <= bytes.byteLength);
    const result = { count: definition.count, values: Array.from({ length: definition.count }, (_, i) => Array.from({ length: width }, (_, axis) => {
      let value = view[getter](start + i * stride + axis * componentBytes, true);
      assert.ok(Number.isFinite(value), 'Non-finite vertex attribute.');
      if (definition.normalized) value = Math.max(-1, value / maximum);
      return value;
    })) };
    cache.set(index, result);
    return result;
  };
  const bounds = new Box3(), meshes = [], nodes = [];
  let triangles = 0, draws = 0, vertices = 0, normalCount = 0;
  const walk = (index, parent = new Matrix4()) => {
    const node = gltf.nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3(...(node.translation || [0, 0, 0])), new Quaternion(...(node.rotation || [0, 0, 0, 1])), new Vector3(...(node.scale || [1, 1, 1])));
    const world = parent.clone().multiply(local);
    nodes.push({ name: node.name, position: new Vector3().setFromMatrixPosition(world).toArray() });
    const meshBounds = new Box3(), quadrants = new Map();
    for (const primitive of gltf.meshes[node.mesh]?.primitives || []) {
      assert.ok(primitive.mode === undefined || primitive.mode === 4);
      const positions = accessor(primitive.attributes.POSITION);
      assert.ok(primitive.attributes.NORMAL !== undefined, 'Shaded car parts need vertex normals.');
      for (const attribute of Object.values(primitive.attributes)) accessor(attribute);
      for (const normal of accessor(primitive.attributes.NORMAL).values) {
        const magnitude = Math.hypot(...normal);
        assert.ok(magnitude > 0.95 && magnitude < 1.05, 'Invalid vertex normal.');
        normalCount++;
      }
      const indices = primitive.indices === undefined ? null : accessor(primitive.indices);
      for (const [value] of indices?.values || []) assert.ok(Number.isInteger(value) && value >= 0 && value < positions.count);
      assert.equal((indices?.count || positions.count) % 3, 0);
      triangles += (indices?.count || positions.count) / 3;
      vertices += positions.count;
      draws++;
      for (const vertex of positions.values) {
        const position = new Vector3(...vertex).applyMatrix4(world);
        meshBounds.expandByPoint(position);
        const key = `${position.x < 0 ? '-' : '+'}X${position.z < 0 ? '-' : '+'}Z`;
        if (!quadrants.has(key)) quadrants.set(key, new Box3());
        quadrants.get(key).expandByPoint(position);
      }
    }
    if (!meshBounds.isEmpty()) {
      bounds.union(meshBounds);
      meshes.push({ name: node.name, material: gltf.materials?.[gltf.meshes[node.mesh].primitives[0].material]?.name,
        min: meshBounds.min.toArray(), max: meshBounds.max.toArray(), center: meshBounds.getCenter(new Vector3()).toArray(),
        quadrants: Array.from(quadrants, ([key, box]) => ({ key, min: box.min.toArray(), max: box.max.toArray(), center: box.getCenter(new Vector3()).toArray() })) });
    }
    for (const child of node.children || []) walk(child, world);
  };
  for (const node of gltf.scenes[gltf.scene || 0].nodes) walk(node);
  const size = bounds.getSize(new Vector3());
  assert.ok(size.x > 0 && size.y > 0 && size.z > size.x, 'Expected upright car with longitudinal Z axis.');
  assert.ok(triangles > 20000 && triangles < 150000 && draws <= 80, 'Detailed vehicle geometry budget exceeded.');
  const scale = Math.min(1.8 / size.x, 5.5 / size.z);
  const round = array => array.map(value => +value.toFixed(6));
  return { bytes: file.length, triangles, vertices, normals: normalCount, materialPrimitives: draws, textureCount: textures.length,
    sourceBounds: { min: round(bounds.min.toArray()), max: round(bounds.max.toArray()), size: round(size.toArray()) },
    raceScale: +scale.toFixed(8), raceSize: round(size.multiplyScalar(scale).toArray()),
    textures, meshes, nodes, requiredExtensions: gltf.extensionsRequired || [] };
}

// Importing this module from the reproducible importer only defines the inspector.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const manifest = JSON.parse(await readFile(new URL('source-record.json', directory), 'utf8'));
  const reports = [];
  for (const record of manifest.models) {
    const file = await readFile(new URL(record.file, directory));
    assert.equal(createHash('sha256').update(file).digest('hex'), record.sha256);
    const report = await inspectCar(file);
    if (!process.argv.includes('--details')) {
      delete report.meshes;
      delete report.nodes;
      delete report.textures;
    }
    reports.push({ id: record.id, title: record.title, ...report });
  }
  console.log(JSON.stringify(reports, null, 2));
}
