import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { useGameStore } from '../store';
import { TUNNEL_LENGTH, tunnelStartZ, deformRoadGeometry, placeOnRoad } from '../environment/road-path';

const SPRING_HEIGHT = 3.6;
const ARCH_STEPS = 20;
const LONGITUDINAL_STEP = 6;

function archProfile(radius, rise) {
  const points = [[-radius, 0], [-radius, SPRING_HEIGHT]];
  for (let i = 1; i <= ARCH_STEPS; i++) {
    const angle = Math.PI * (1 - i / ARCH_STEPS);
    points.push([radius * Math.cos(angle), SPRING_HEIGHT + rise * Math.sin(angle)]);
  }
  points.push([radius, 0]);
  return points;
}

// A U-shaped solid cross-section leaves the complete carriageway open.
function section(inner, outer) {
  const shape = new THREE.Shape();
  const perimeter = [...inner, ...outer.slice().reverse()];
  shape.moveTo(...perimeter[0]);
  perimeter.slice(1).forEach(point => shape.lineTo(...point));
  shape.closePath();
  return shape;
}

function extrusion(shape, length, front = 0) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: length, steps: Math.ceil(length / LONGITUDINAL_STEP), bevelEnabled: false, curveSegments: 1,
  });
  geometry.translate(0, 0, front - length);
  return geometry;
}

function box(width, height, length, x, y, z) {
  const geometry = new THREE.BoxGeometry(width, height, length, 1, 1, Math.max(1, Math.ceil(length / LONGITUDINAL_STEP)));
  geometry.translate(x, y, z);
  return geometry;
}

function mergeParts(parts, color) {
  const sources = parts.map(geometry => {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (source !== geometry) geometry.dispose();
    return source;
  });
  const merged = mergeGeometries(sources, false);
  sources.forEach(source => source.dispose());
  const geometry = mergeVertices(merged, 1e-5);
  merged.dispose();
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const tint = new THREE.Color(color);
  for (let i = 0; i < position.count; i++) {
    // Low contrast casting variation, fixed in route coordinates, avoids a
    // flat plastic tube without texture downloads or frame-time randomness.
    const shade = 0.89 + Math.sin(position.getZ(i) * 0.39 + position.getX(i) * 0.8) * 0.035
      + Math.max(0, geometry.attributes.normal.getY(i)) * 0.055;
    colors.set([tint.r * shade, tint.g * shade, tint.b * shade], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

function buildTunnel() {
  const length = TUNNEL_LENGTH;
  const concrete = [], joints = [], earth = [], guides = [], metal = [];
  const opening = archProfile(8.9, 6.6);
  concrete.push(extrusion(section(opening, archProfile(9.75, 7.45)), length));
  const portal = section(archProfile(8.8, 6.6), archProfile(10.5, 8.0));
  concrete.push(extrusion(portal, 1.5, 0.7), extrusion(portal, 1.5, -length + 0.8));
  for (const side of [-1, 1]) {
    // The walkways begin beyond x±8.2; no fixture or wall crosses the road.
    concrete.push(box(0.65, 0.24, length, side * 8.525, 0.10, -length / 2));
    concrete.push(box(0.16, 0.42, length, side * 8.83, 0.21, -length / 2));
    guides.push(box(0.035, 0.045, length - 2, side * 8.775, 0.92, -length / 2));
    metal.push(box(0.06, 0.10, length - 2, side * 8.81, 3.1, -length / 2));
    for (let z = 5; z < length - 3; z += 12) {
      guides.push(box(0.05, 0.18, 0.30, side * 8.735, 0.53, -z));
    }
  }
  const joint = section(archProfile(8.84, 6.54), opening);
  for (let z = 6; z < length - 3; z += 6) {
    const geometry = new THREE.ShapeGeometry(joint, 1);
    geometry.translate(0, 0, -z);
    joints.push(geometry);
  }
  // A cut-and-cover hill surrounds the roof and closes around the portals.
  // All earth remains outside the concrete opening; trees need route masking.
  const hillside = [
    [-25, -0.08], [-25, 0.1], [-22, 0.8], [-18, 3.0], [-13, 7.0], [-10, 10.0],
    [-5, 12.4], [0, 13.1], [5, 12.4], [10, 10.0], [13, 7.0], [18, 3.0], [22, 0.8], [25, 0.1], [25, -0.08],
  ];
  earth.push(extrusion(section(archProfile(9.78, 7.48), hillside), length - 2.2, -1.1));

  const concreteMaterial = new THREE.MeshStandardMaterial({ color: '#b6bbc0', roughness: 0.96, vertexColors: true,
    emissive: '#627078', emissiveIntensity: 0.15 });
  const jointMaterial = new THREE.MeshStandardMaterial({ color: '#262e37', roughness: 1, vertexColors: true, side: THREE.DoubleSide });
  const earthMaterial = new THREE.MeshStandardMaterial({ color: '#859174', roughness: 1, vertexColors: true,
    emissive: '#26351c', emissiveIntensity: 0.12 });
  const guideMaterial = new THREE.MeshStandardMaterial({ color: '#ffe8c1', emissive: '#ffd4a0', emissiveIntensity: 1.5, vertexColors: true });
  const metalMaterial = new THREE.MeshStandardMaterial({ color: '#56606a', metalness: 0.62, roughness: 0.55, vertexColors: true });
  const parts = [
    [concrete, concreteMaterial, '#d7d8d5'], [joints, jointMaterial, '#9ca4ab'],
    [earth, earthMaterial, '#8b9274'], [guides, guideMaterial, '#ffffff'], [metal, metalMaterial, '#b0b7bd'],
  ].map(([source, material, tint]) => {
    const geometry = mergeParts(source, tint);
    return { geometry, material, positions: geometry.attributes.position.array.slice(), normals: geometry.attributes.normal.array.slice() };
  });
  const housing = mergeParts([
    box(0.30, 0.13, 1.8, 0, 0, 0), box(0.08, 0.18, 0.10, 0, 0.13, -0.65), box(0.08, 0.18, 0.10, 0, 0.13, 0.65),
  ], '#b6bdc4');
  const lens = new THREE.BoxGeometry(0.22, 0.026, 1.58);
  lens.translate(0, -0.079, 0);
  const lensMaterial = new THREE.MeshStandardMaterial({ color: '#fff3d9', emissive: '#ffe0aa', emissiveIntensity: 4.0, roughness: 0.3 });
  const fixtures = [];
  for (let z = 4; z < length - 3; z += 8) for (const side of [-1, 1]) {
    fixtures.push({ z: -z, local: new THREE.Matrix4().makeTranslation(side * 3.4, 9.45, 0) });
  }
  return { parts, fixtures, housing, lens, metalMaterial, lensMaterial };
}

export default function RoadTunnels() {
  const group = useRef(), housings = useRef(), lenses = useRef();
  const previous = useRef(NaN);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const tunnel = useMemo(() => buildTunnel(), []);
  useEffect(() => () => {
    const materials = new Set(tunnel.parts.map(part => part.material));
    tunnel.parts.forEach(part => part.geometry.dispose());
    tunnel.housing.dispose(); tunnel.lens.dispose();
    materials.add(tunnel.lensMaterial);
    materials.forEach(material => material.dispose());
  }, [tunnel]);
  useFrame(() => {
    if (!group.current || !housings.current || !lenses.current) return;
    const distance = useGameStore.getState().totalDistance * 5;
    if (distance === previous.current) return;
    const front = tunnelStartZ(distance);
    group.current.visible = front >= -730 && front - TUNNEL_LENGTH <= 85;
    if (group.current.visible) {
      group.current.position.z = front;
      for (const part of tunnel.parts) deformRoadGeometry(part.geometry, part.positions, part.normals, distance, front);
      for (let i = 0; i < tunnel.fixtures.length; i++) {
        const fixture = tunnel.fixtures[i];
        placeOnRoad(matrix, fixture.local, front + fixture.z, distance);
        matrix.setPosition(matrix.elements[12], matrix.elements[13], matrix.elements[14] - front);
        housings.current.setMatrixAt(i, matrix); lenses.current.setMatrixAt(i, matrix);
      }
      housings.current.instanceMatrix.needsUpdate = true;
      lenses.current.instanceMatrix.needsUpdate = true;
    }
    previous.current = distance;
  });
  const setup = (ref, mesh) => {
    ref.current = mesh;
    if (mesh) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); previous.current = NaN; }
  };
  return <group ref={group} dispose={null} name="road-tunnel">
    {tunnel.parts.map((part, index) => <mesh key={index} geometry={part.geometry} material={part.material} frustumCulled={false} receiveShadow />)}
    <instancedMesh ref={mesh => setup(housings, mesh)} args={[tunnel.housing, tunnel.metalMaterial, tunnel.fixtures.length]} frustumCulled={false} />
    <instancedMesh ref={mesh => setup(lenses, mesh)} args={[tunnel.lens, tunnel.lensMaterial, tunnel.fixtures.length]} frustumCulled={false} />
  </group>;
}
