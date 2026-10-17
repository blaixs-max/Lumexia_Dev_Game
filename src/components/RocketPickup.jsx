import { memo, useEffect, useMemo } from 'react';
import {
  ExtrudeGeometry,
  LatheGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lathe = (profile, segments = 32) => new LatheGeometry(profile.map(([radius, height]) => new Vector2(radius, height)), segments);

// Baking the four swept fins and their trim into shared meshes keeps this
// silhouette inexpensive when several pickups are visible down the road.
function fins() {
  const outline = new Shape();
  outline.moveTo(.21, -.25);
  outline.lineTo(.32, -.35);
  outline.lineTo(.53, -.64);
  outline.lineTo(.53, -.75);
  outline.lineTo(.3, -.65);
  outline.lineTo(.21, -.5);
  outline.closePath();
  const fin = new ExtrudeGeometry(outline, {
    depth: .048, steps: 1, bevelEnabled: true,
    bevelThickness: .012, bevelSize: .016, bevelSegments: 2,
  }).translate(0, 0, -.024);
  const pieces = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => fin.clone().rotateY(angle));
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  fin.dispose();
  return geometry;
}

function copperTrim() {
  const pieces = [
    new TorusGeometry(.267, .009, 6, 32).rotateX(Math.PI / 2).translate(0, .485, 0),
    new TorusGeometry(.157, .012, 6, 24).rotateX(Math.PI / 2).translate(0, -.665, 0),
  ];
  const geometry = mergeGeometries(pieces);
  pieces.forEach(piece => piece.dispose());
  return geometry;
}

function createResources() {
  return {
    hull: lathe([
      [0, -.61], [.13, -.61], [.19, -.56], [.225, -.47],
      [.257, -.3], [.273, -.08], [.273, .34], [.267, .5], [0, .5],
    ]),
    nose: lathe([
      [0, .495], [.267, .495], [.263, .55], [.248, .64],
      [.221, .73], [.184, .82], [.136, .91], [.076, .99], [0, 1.055],
    ]),
    nozzle: lathe([
      [0, -.56], [.117, -.56], [.145, -.61], [.165, -.68],
      [.165, -.715], [.112, -.715], [.094, -.64], [0, -.64],
    ], 24),
    fins: fins(),
    copperTrim: copperTrim(),
    windowRim: new TorusGeometry(.139, .023, 8, 28),
    windowLens: new SphereGeometry(1, 24, 12),
    flame: lathe([
      [0, -.47], [.027, -.405], [.047, -.29], [.085, -.17],
      [.104, -.08], [.088, 0], [0, 0],
    ], 20),
    flameCore: lathe([
      [0, -.31], [.022, -.23], [.044, -.12], [.061, -.045], [.047, .005], [0, .005],
    ], 16),
    pearl: new MeshStandardMaterial({
      color: '#e7edf0', metalness: .38, roughness: .25,
      emissive: '#c4d8e8', emissiveIntensity: .11,
    }),
    vermilion: new MeshStandardMaterial({
      color: '#e65432', metalness: .28, roughness: .28,
      emissive: '#df3b18', emissiveIntensity: .16,
    }),
    graphite: new MeshStandardMaterial({ color: '#21313c', metalness: .7, roughness: .28 }),
    copper: new MeshStandardMaterial({ color: '#dc9b63', metalness: .75, roughness: .28 }),
    glass: new MeshStandardMaterial({
      color: '#62d9f0', metalness: .28, roughness: .16,
      emissive: '#31bddd', emissiveIntensity: .55,
    }),
    exhaust: new MeshBasicMaterial({ color: '#ff793a', transparent: true, opacity: .72, depthWrite: false, toneMapped: false }),
    exhaustCore: new MeshBasicMaterial({ color: '#ffedb1', toneMapped: false }),
  };
}

/** Upright +Y, front window +Z; approximately 1.1 × 2.24 × 1.1 units. */
const RocketPickup = memo(function RocketPickup() {
  const resources = useMemo(() => createResources(), []);
  useEffect(() => () => Object.values(resources).forEach(resource => resource.dispose()), [resources]);

  return <group name="rocket-pickup-model" dispose={null}>
    <mesh name="rocket-pearl-hull" geometry={resources.hull} material={resources.pearl} castShadow />
    <mesh name="rocket-vermilion-nose" geometry={resources.nose} material={resources.vermilion} castShadow />
    <mesh name="rocket-swept-fins" geometry={resources.fins} material={resources.vermilion} castShadow />
    <mesh name="rocket-engine-nozzle" geometry={resources.nozzle} material={resources.graphite} castShadow />
    <mesh name="rocket-copper-trim" geometry={resources.copperTrim} material={resources.copper} />
    <group name="rocket-forward-window" position={[0, .16, .277]} rotation={[-.035, 0, 0]}>
      <mesh geometry={resources.windowRim} material={resources.graphite} />
      <mesh geometry={resources.windowLens} material={resources.glass} position={[0, 0, .008]} scale={[.121, .121, .038]} />
    </group>
    <group name="rocket-exhaust" position={[0, -.706, 0]}>
      <mesh name="rocket-flame-outer" geometry={resources.flame} material={resources.exhaust} />
      <mesh name="rocket-flame-core" geometry={resources.flameCore} material={resources.exhaustCore} />
    </group>
  </group>;
});

export default RocketPickup;
