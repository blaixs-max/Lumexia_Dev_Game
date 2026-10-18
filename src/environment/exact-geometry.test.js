import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { canUsePositionOnlyShadow, disposeExactGeometry, exactTrafficGeometry } from './exact-geometry.js';

function seamedGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0, 0, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 21 }, (_, index) => index < 9 ? 1 : -1), 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: 14 }, (_, index) => index / 13), 2));
  geometry.setAttribute('tangent', new THREE.Float32BufferAttribute(new Float32Array(28).fill(0.5), 4));
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(new Uint8Array(21).fill(127), 3, true));
  geometry.setIndex([0, 1, 2, 3, 4, 5, 6, 1, 2]);
  geometry.addGroup(0, 3, 0); geometry.addGroup(3, 6, 1); geometry.setDrawRange(3, 6);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
}
function triangleMultiset(geometry, start = 0, count = geometry.index.count, positions = false) {
  const attribute = geometry.attributes.position, array = attribute.array;
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength), width = attribute.itemSize * array.BYTES_PER_ELEMENT;
  const vertex = index => positions ? [...bytes.subarray(index * width, (index + 1) * width)].join(',') : index;
  const result = new Map();
  for (let index = start; index < start + count; index += 3) {
    const key = [0, 1, 2].map(offset => vertex(geometry.index.getX(index + offset))).join('|');
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}
function misses(indices, size) {
  const cache = []; let count = 0;
  for (const index of indices) { const at = cache.indexOf(index); if (at < 0) count++; else cache.splice(at, 1); cache.unshift(index); if (cache.length > size) cache.pop(); }
  return count;
}

describe('exact NPC cache geometry', () => {
  it('shares every main attribute bit and preserves oriented triangles within every group/range', () => {
    const source = seamedGeometry(), originalIndices = source.index.array.slice(), originalAttributes = { ...source.attributes };
    const material = new THREE.MeshStandardMaterial(), { color, shadow } = exactTrafficGeometry(source, [material, material]);
    expect(color).not.toBe(source); expect(color.index).not.toBe(source.index);
    expect(source.index.array).toEqual(originalIndices);
    for (const name of Object.keys(originalAttributes)) expect(color.attributes[name]).toBe(originalAttributes[name]);
    expect(color.groups).toEqual(source.groups); expect(shadow.groups).toEqual(source.groups);
    expect(color.drawRange).toEqual(source.drawRange); expect(shadow.drawRange).toEqual(source.drawRange);
    for (const range of [...source.groups, source.drawRange]) {
      expect(triangleMultiset(color, range.start, range.count)).toEqual(triangleMultiset(source, range.start, range.count));
      expect(triangleMultiset(shadow, range.start, range.count, true)).toEqual(triangleMultiset(source, range.start, range.count, true));
    }
    expect(Object.keys(shadow.attributes)).toEqual(['position']);
    expect(shadow.attributes.position.count).toBe(4); // +0 and -0 remain distinct.
    expect(shadow.boundingSphere).toEqual(source.boundingSphere);
    expect(exactTrafficGeometry(source, material).color).toBe(color);
    expect(exactTrafficGeometry(source, material).shadow).toBe(shadow);
    disposeExactGeometry(source);
  });

  it.each([
    ['alpha test', material => { material.alphaTest = 0.5; }],
    ['alpha hash', material => { material.alphaHash = true; }],
    ['alpha coverage', material => { material.alphaToCoverage = true; }],
    ['transparency', material => { material.transparent = true; }],
    ['opacity', material => { material.opacity = 0.5; }],
    ['alpha map', material => { material.alphaMap = new THREE.Texture(); }],
    ['possible map alpha', material => { material.map = new THREE.Texture(); }],
    ['displacement', material => { material.displacementMap = new THREE.Texture(); }],
    ['custom shader hook', material => { material.onBeforeCompile = () => {}; }],
  ])('keeps full depth attributes for %s materials', (_name, mutate) => {
    const source = seamedGeometry(), material = new THREE.MeshStandardMaterial(); mutate(material);
    expect(canUsePositionOnlyShadow(source, material)).toBe(false);
    const result = exactTrafficGeometry(source, material); expect(result.shadow).toBe(result.color); disposeExactGeometry(source);
  });

  it.each(['skinned', 'morphed', 'customDepthMaterial', 'customDistanceMaterial'])('guards %s depth behavior', flag => {
    const source = seamedGeometry(), material = new THREE.MeshStandardMaterial();
    expect(canUsePositionOnlyShadow(source, material, { [flag]: true })).toBe(false);
  });

  it('guards half-float and integer GPU position interpretation', () => {
    const source = seamedGeometry(), material = new THREE.MeshStandardMaterial();
    source.setAttribute('position', new THREE.Float16BufferAttribute(new Uint16Array(21), 3));
    expect(canUsePositionOnlyShadow(source, material)).toBe(false);
    source.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(21), 3)); source.attributes.position.gpuType = THREE.IntType;
    expect(canUsePositionOnlyShadow(source, material)).toBe(false);
  });

  it('reduces vertex-cache misses without changing a shuffled grid triangle', () => {
    const source = new THREE.PlaneGeometry(10, 10, 30, 30), original = source.index.array.slice();
    let seed = 17;
    for (let i = original.length / 3 - 1; i > 0; i--) {
      seed = seed * 16807 % 2147483647; const target = seed % (i + 1);
      for (let corner = 0; corner < 3; corner++) [original[i * 3 + corner], original[target * 3 + corner]] = [original[target * 3 + corner], original[i * 3 + corner]];
    }
    source.setIndex(new THREE.BufferAttribute(original, 1));
    const result = exactTrafficGeometry(source, new THREE.MeshStandardMaterial());
    expect(triangleMultiset(result.color)).toEqual(triangleMultiset(source));
    for (const size of [16, 32]) expect(misses(result.color.index.array, size)).toBeLessThan(misses(source.index.array, size) * 0.6);
    disposeExactGeometry(source);
  });

  it('bounds high-valence/degenerate ordering work while keeping its index stream exact', () => {
    const source = seamedGeometry(); source.clearGroups(); source.setDrawRange(0, Infinity); source.setIndex(new THREE.Uint32BufferAttribute(new Uint32Array(30000), 1));
    const result = exactTrafficGeometry(source, new THREE.MeshStandardMaterial());
    expect(result.color.index.array).toEqual(source.index.array); expect(result.colorPrepareMs).toBeLessThan(150);
    disposeExactGeometry(source);
  });

  it('cleans owned buffers without disposing shared source attributes', () => {
    const source = seamedGeometry(), position = source.attributes.position, material = new THREE.MeshStandardMaterial();
    const first = exactTrafficGeometry(source, material); let colors = 0, shadows = 0, sources = 0;
    source.addEventListener('dispose', () => { sources++; });
    first.color.addEventListener('dispose', () => { colors++; expect(first.color.attributes).toEqual({}); });
    first.shadow.addEventListener('dispose', () => { shadows++; });
    disposeExactGeometry(source);
    expect({ colors, shadows, sources }).toEqual({ colors: 1, shadows: 1, sources: 0 });
    expect(source.attributes.position).toBe(position); expect(first.color.attributes.position).toBe(position);
    const second = exactTrafficGeometry(source, material); expect(second.color).not.toBe(first.color);
    second.color.addEventListener('dispose', () => { colors++; }); second.shadow.addEventListener('dispose', () => { shadows++; });
    source.dispose(); expect({ colors, shadows, sources }).toEqual({ colors: 2, shadows: 2, sources: 1 });
  });

  it('preserves real truck asset position triangles bit-for-bit', () => {
    const bytes = readFileSync(new URL('../../public/models/truck.glb', import.meta.url));
    const length = bytes.readUInt32LE(12), document = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8').trim()), binary = bytes.subarray(28 + length);
    const constructors = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    function accessor(index) {
      const item = document.accessors[index], view = document.bufferViews[item.bufferView], ArrayType = constructors[item.componentType];
      const width = widths[item.type], size = width * ArrayType.BYTES_PER_ELEMENT, target = new Uint8Array(item.count * size);
      for (let vertex = 0; vertex < item.count; vertex++) {
        const start = (view.byteOffset || 0) + (item.byteOffset || 0) + vertex * (view.byteStride || size);
        target.set(binary.subarray(start, start + size), vertex * size);
      }
      return new THREE.BufferAttribute(new ArrayType(target.buffer), width, item.normalized || false);
    }
    for (const mesh of document.meshes) for (const primitive of mesh.primitives) {
      const source = new THREE.BufferGeometry();
      for (const [name, index] of Object.entries(primitive.attributes)) source.setAttribute({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' }[name], accessor(index));
      source.setIndex(accessor(primitive.indices));
      const result = exactTrafficGeometry(source, new THREE.MeshStandardMaterial());
      expect(triangleMultiset(result.color)).toEqual(triangleMultiset(source));
      expect(triangleMultiset(result.shadow, 0, source.index.count, true)).toEqual(triangleMultiset(source, 0, source.index.count, true));
      expect(result.color.attributes.normal).toBe(source.attributes.normal); expect(result.color.attributes.uv).toBe(source.attributes.uv);
      disposeExactGeometry(source);
    }
  });
});
