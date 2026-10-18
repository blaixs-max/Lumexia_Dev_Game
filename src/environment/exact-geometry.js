import * as THREE from 'three';
import { MeshoptEncoder } from 'meshoptimizer/meshopt_encoder.module.js';

// The encoder is already an installed dependency. Its small cache optimizer
// runs once while the lazy race chunk loads, before any geometry is prepared.
let encoderReady = false;
try { await MeshoptEncoder.ready; encoderReady = Boolean(MeshoptEncoder.supported); }
catch { /* This optional optimization must never prevent loading a race. */ }
const cache = new WeakMap();
const now = () => globalThis.performance?.now() ?? Date.now();

function indexSegments(source) {
  const count = source.index?.count;
  if (!count || count % 3 || source.index.itemSize !== 1 || source.index.isInterleavedBufferAttribute
    || !encoderReady || source.isInstancedBufferGeometry || Object.values(source.morphAttributes).some(values => values.length)) return null;
  const boundaries = new Set([0, count]);
  for (const value of [source.drawRange.start, source.drawRange.start + source.drawRange.count,
    ...source.groups.flatMap(group => [group.start, group.start + group.count])]) {
    if (!Number.isFinite(value)) continue;
    const edge = Math.max(0, Math.min(count, value));
    if (edge % 3) return null;
    boundaries.add(edge);
  }
  return [...boundaries].sort((a, b) => a - b);
}

function reorderedIndices(indices, segments) {
  const output = Uint32Array.from(indices);
  for (let part = 1; part < segments.length; part++) {
    const segment = output.subarray(segments[part - 1], segments[part]);
    if (!segment.length) continue;
    let maximum = 0;
    for (const index of segment) maximum = Math.max(maximum, index);
    const valence = new Uint16Array(maximum + 1);
    let pathological = false;
    for (const index of segment) if (++valence[index] > 256) { pathological = true; break; }
    // Extremely high-valence fans/degenerate input can make cache ordering
    // quadratic. Keep their original order; exactness never depends on this
    // optional optimization completing for every primitive.
    if (pathological) continue;
    // reorderMesh also remaps vertex labels. Undo that bijection so main
    // rendering continues to read the exact original attribute objects.
    const [oldToNew] = MeshoptEncoder.reorderMesh(segment, true, false);
    const inverse = new Uint32Array(oldToNew.length);
    for (let old = 0; old < oldToNew.length; old++) if (oldToNew[old] !== 0xffffffff) inverse[oldToNew[old]] = old;
    for (let index = 0; index < segment.length; index++) segment[index] = inverse[segment[index]];
  }
  return output;
}

function geometryShell(source) {
  const result = new THREE.BufferGeometry();
  result.name = source.name;
  result.groups = source.groups.map(group => ({ ...group }));
  result.drawRange = { ...source.drawRange };
  result.boundingBox = source.boundingBox?.clone() ?? null;
  result.boundingSphere = source.boundingSphere?.clone() ?? null;
  return result;
}

// Disposing a derived index must not delete shared original attribute VBOs.
// The temporary map is restored synchronously for safe renderer reuploads.
function disposeDerived(geometry, sharedAttributes = false) {
  const original = geometry.attributes;
  if (sharedAttributes) geometry.attributes = {};
  geometry.dispose();
  geometry.attributes = original;
}

function recordFor(source) {
  if (cache.has(source)) return cache.get(source);
  const segments = indexSegments(source);
  const record = { color: source, shadow: null, segments, colorPrepareMs: 0, shadowPrepareMs: 0 };
  if (!segments) return record;
  const start = now(), color = geometryShell(source);
  for (const [name, attribute] of Object.entries(source.attributes)) color.setAttribute(name, attribute);
  color.setIndex(new THREE.BufferAttribute(new source.index.array.constructor(reorderedIndices(source.index.array, segments)), 1));
  record.color = color;
  record.colorPrepareMs = now() - start;
  const dispose = () => disposeExactGeometry(source);
  record.onDispose = dispose;
  source.addEventListener('dispose', dispose);
  cache.set(source, record);
  return record;
}

export function canUsePositionOnlyShadow(source, material, options = {}) {
  const position = source.getAttribute('position');
  const array = position?.isInterleavedBufferAttribute ? position.data.array : position?.array;
  if (!position || position.itemSize !== 3 || position.isFloat16BufferAttribute || position.gpuType !== undefined && position.gpuType !== THREE.FloatType
    || ![1, 2, 4].includes(array?.BYTES_PER_ELEMENT) || !indexSegments(source) || options.skinned || options.morphed
    || options.customDepthMaterial || options.customDistanceMaterial || source.hasAttribute('skinIndex') || source.hasAttribute('skinWeight')) return false;
  return [material].flat().every(value => value?.isMeshStandardMaterial && !value.transparent && value.opacity === 1
    && !value.alphaTest && !value.alphaHash && !value.alphaToCoverage && !value.alphaMap && !value.map && !value.displacementMap
    && !(value.vertexColors && source.getAttribute('color')?.itemSize === 4)
    && value.onBeforeCompile === THREE.Material.prototype.onBeforeCompile);
}

function positionGeometry(source, segments) {
  const attribute = source.getAttribute('position'), array = attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array;
  const componentBytes = array.BYTES_PER_ELEMENT, stride = (attribute.isInterleavedBufferAttribute ? attribute.data.stride : attribute.itemSize) * componentBytes;
  const offset = (attribute.isInterleavedBufferAttribute ? attribute.offset : 0) * componentBytes;
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const getter = componentBytes === 4 ? 'getUint32' : componentBytes === 2 ? 'getUint16' : 'getUint8';
  const remap = new Uint32Array(attribute.count), firstVertices = [], unique = new Map();
  for (let vertex = 0; vertex < attribute.count; vertex++) {
    const start = offset + vertex * stride;
    // Keys use raw component bits: +0/-0 and every stored precision bit stay
    // distinct. No rounding, quantization or approximate spatial welding.
    const key = `${view[getter](start, true)},${view[getter](start + componentBytes, true)},${view[getter](start + componentBytes * 2, true)}`;
    let target = unique.get(key);
    if (target === undefined) { target = unique.size; unique.set(key, target); firstVertices.push(vertex); }
    remap[vertex] = target;
  }
  const positions = new array.constructor(unique.size * 3), outputBytes = new Uint8Array(positions.buffer);
  for (let target = 0; target < firstVertices.length; target++) {
    const start = offset + firstVertices[target] * stride;
    outputBytes.set(bytes.subarray(start, start + componentBytes * 3), target * componentBytes * 3);
  }
  const indices = Uint32Array.from(source.index.array, index => remap[index]);
  const result = geometryShell(source), IndexArray = unique.size <= 65536 ? Uint16Array : Uint32Array;
  result.setAttribute('position', new THREE.BufferAttribute(positions, 3, attribute.normalized));
  result.setIndex(new THREE.BufferAttribute(new IndexArray(reorderedIndices(indices, segments)), 1));
  return result;
}

// Derived geometries have the source's cache lifetime. Original disposal
// releases only owned indices/position buffers; player/garage sources survive
// independent explicit cleanup of this optimization cache.
export function exactTrafficGeometry(source, material, options = {}) {
  const record = recordFor(source);
  if (record.segments && canUsePositionOnlyShadow(source, material, options) && !record.shadow) {
    const start = now(); record.shadow = positionGeometry(source, record.segments); record.shadowPrepareMs = now() - start;
  }
  return { color: record.color, shadow: canUsePositionOnlyShadow(source, material, options) ? record.shadow ?? record.color : record.color,
    colorPrepareMs: record.colorPrepareMs, shadowPrepareMs: record.shadowPrepareMs };
}

export function disposeExactGeometry(source) {
  const record = cache.get(source);
  if (!record) return;
  cache.delete(source);
  source.removeEventListener('dispose', record.onDispose);
  if (record.color !== source) disposeDerived(record.color, true);
  if (record.shadow) disposeDerived(record.shadow);
}
