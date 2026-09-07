import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { buildArchitectureAssets } from '../environment/architecture';
import { buildNatureAssets } from '../environment/nature';
import { buildStreetDetailsAssets } from '../environment/street-details';
import { createLandscape, createPlacements, WORLD_SPAN } from '../environment/landscape';
import { placementMatrix, placedBounds, RoadVisibility, wrapWorldZ } from '../environment/visibility';
import StreetLighting from './StreetLighting';

function disposeAssets(assets) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  for (const model of Object.values(assets)) model.traverse(node => {
    if (!node.isMesh) return;
    geometries.add(node.geometry);
    for (const material of [node.material].flat()) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  textures.forEach(value => value.dispose());
}

function uploadVisiblePrefix(mesh, count) {
  mesh.count = count;
  mesh.visible = count > 0;
  mesh.userData.visibleInstances = count;
  if (!count) return;
  mesh.instanceMatrix.clearUpdateRanges();
  mesh.instanceMatrix.addUpdateRange(0, count * 16);
  mesh.instanceMatrix.needsUpdate = true;
}

const AssetInstances = memo(function AssetInstances({ model, placements, visibility }) {
  const refs = useRef([]);
  const previous = useRef({ version: -1, prepared: null });
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const prepared = useMemo(() => {
    model.updateMatrixWorld(true);
    const parts = [];
    model.traverse(node => { if (node.isMesh) parts.push({ geometry: node.geometry, material: node.material, matrix: node.matrixWorld.clone() }); });
    const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere());
    const items = placements.map(item => {
      const base = placementMatrix(item);
      return { z: item.z, bounds: placedBounds(sphere, base), matrices: parts.map(part => new THREE.Matrix4().multiplyMatrices(base, part.matrix)) };
    });
    return { parts, items };
  }, [model, placements]);
  useFrame(() => {
    if (previous.current.version === visibility.version && previous.current.prepared === prepared) return;
    let count = 0;
    for (const item of prepared.items) {
      const z = wrapWorldZ(item.z, visibility.distance, WORLD_SPAN);
      // Every material part shares this full-model test: windows, walls,
      // roof, branches and leaves enter and leave together at screen edges.
      if (!visibility.visible(item.bounds, z)) continue;
      for (let p = 0; p < prepared.parts.length; p++) {
        matrix.copy(item.matrices[p]);
        matrix.setPosition(matrix.elements[12], matrix.elements[13], matrix.elements[14] + z);
        refs.current[p]?.setMatrixAt(count, matrix);
      }
      count++;
    }
    for (const mesh of refs.current) if (mesh) uploadVisiblePrefix(mesh, count);
    previous.current.version = visibility.version;
    previous.current.prepared = prepared;
  });
  return <>{prepared.parts.map((part, index) => <instancedMesh key={index} ref={mesh => {
    refs.current[index] = mesh;
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.userData.instanceCapacity = placements.length;
      previous.current.version = -1;
    }
  }} args={[part.geometry, part.material, placements.length]} frustumCulled={false} dispose={null}
    castShadow={false} receiveShadow />)}</>;
});

function PlotGround({ assets, placements, landscape, visibility }) {
  const shadows = useRef(), walks = useRef();
  const previous = useRef({ version: -1, plots: null });
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const plots = useMemo(() => Object.entries(placements).flatMap(([type, positions]) => {
    if (!['oak', 'oak2', 'poplar', 'pine', 'shrubs', 'townhouse', 'villa', 'apartment', 'office', 'warehouse'].includes(type)) return [];
    const size = new THREE.Box3().setFromObject(assets[type]).getSize(new THREE.Vector3());
    const building = ['townhouse', 'villa', 'apartment', 'office', 'warehouse'].includes(type);
    return positions.map(item => {
      const transform = new THREE.Object3D();
      transform.position.set(item.x, 0.055, 0);
      transform.rotation.set(-Math.PI / 2, 0, item.rotation);
      transform.scale.set(size.x * item.scale * 1.1, size.z * item.scale * 1.1, 1);
      transform.updateMatrix();
      const bounds = new THREE.Sphere(new THREE.Vector3(item.x, 0.055, 0), Math.hypot(size.x, size.z) * item.scale * 0.55);
      let walkway = null;
      if (building) {
        const side = Math.sign(item.x);
        const front = Math.abs(item.x) - size.z * item.scale * 0.5 + 0.1;
        const length = Math.max(0.1, front - 13.8);
        const walk = new THREE.Object3D();
        walk.position.set(side * (13.8 + length * 0.5), 0.018, 0);
        walk.rotation.set(-Math.PI / 2, 0, 0);
        walk.scale.set(length, 2.4, 1);
        walk.updateMatrix();
        walkway = { matrix: walk.matrix.clone(), bounds: new THREE.Sphere(walk.position.clone(), Math.hypot(length, 2.4) / 2) };
      }
      return { z: item.z, matrix: transform.matrix.clone(), bounds, walkway };
    });
  }), [assets, placements]);
  const homes = useMemo(() => plots.filter(plot => plot.walkway), [plots]);
  useFrame(() => {
    if (!shadows.current || !walks.current || (previous.current.version === visibility.version && previous.current.plots === plots)) return;
    let shadowCount = 0, walkCount = 0;
    for (const plot of plots) {
      const z = wrapWorldZ(plot.z, visibility.distance, WORLD_SPAN);
      if (visibility.visible(plot.bounds, z)) {
        matrix.copy(plot.matrix); matrix.setPosition(matrix.elements[12], matrix.elements[13], matrix.elements[14] + z);
        shadows.current.setMatrixAt(shadowCount++, matrix);
      }
      if (plot.walkway && visibility.visible(plot.walkway.bounds, z)) {
        matrix.copy(plot.walkway.matrix); matrix.setPosition(matrix.elements[12], matrix.elements[13], matrix.elements[14] + z);
        walks.current.setMatrixAt(walkCount++, matrix);
      }
    }
    uploadVisiblePrefix(shadows.current, shadowCount);
    uploadVisiblePrefix(walks.current, walkCount);
    previous.current.version = visibility.version;
    previous.current.plots = plots;
  });
  const setup = (ref, mesh) => {
    ref.current = mesh;
    if (mesh) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; previous.current.version = -1; }
  };
  return <>
    <instancedMesh ref={mesh => setup(shadows, mesh)} args={[undefined, undefined, plots.length]} frustumCulled={false}><planeGeometry /><meshBasicMaterial map={landscape.contact} transparent depthWrite={false} /></instancedMesh>
    <instancedMesh ref={mesh => setup(walks, mesh)} args={[undefined, undefined, homes.length]} frustumCulled={false} receiveShadow><planeGeometry /><meshStandardMaterial color="#a5a18e" roughness={0.98} /></instancedMesh>
  </>;
}

function StreetGround({ landscape, visibility }) {
  const posts = useRef();
  const previous = useRef(-1);
  const pavingLeft = useMemo(() => { const map = landscape.paving.clone(); map.repeat.set(1, WORLD_SPAN / 4); return map; }, [landscape]);
  const pavingRight = useMemo(() => { const map = landscape.paving.clone(); map.repeat.set(1, WORLD_SPAN / 4); return map; }, [landscape]);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const postPlacements = useMemo(() => Array.from({ length: Math.floor(WORLD_SPAN / 5) * 2 }, (_, i) => {
    const x = i % 2 ? 9.05 : -9.05;
    return { z: Math.floor(i / 2) * 5, matrix: new THREE.Matrix4().makeTranslation(x, 0.42, 0), bounds: new THREE.Sphere(new THREE.Vector3(x, 0.42, 0), 0.44) };
  }), []);
  useEffect(() => () => { pavingLeft.dispose(); pavingRight.dispose(); }, [pavingLeft, pavingRight]);
  useFrame(() => {
    if (!posts.current || previous.current === visibility.version) return;
    pavingLeft.offset.set(0, -visibility.distance / 4);
    pavingRight.offset.set(0, -visibility.distance / 4);
    let count = 0;
    for (const post of postPlacements) {
      const z = wrapWorldZ(post.z, visibility.distance, WORLD_SPAN);
      if (!visibility.visible(post.bounds, z)) continue;
      matrix.copy(post.matrix); matrix.setPosition(matrix.elements[12], matrix.elements[13], matrix.elements[14] + z);
      posts.current.setMatrixAt(count++, matrix);
    }
    uploadVisiblePrefix(posts.current, count);
    previous.current = visibility.version;
  });
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, -200]} receiveShadow><planeGeometry args={[1600, 1600]} /><meshStandardMaterial map={landscape.grass} color="#bac2a5" roughness={1} bumpMap={landscape.grass} bumpScale={0.045} /></mesh>
    <mesh geometry={landscape.terrain}><meshStandardMaterial vertexColors roughness={1} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 9, 0, 0]} scale={[1, 1, 1.2]} geometry={landscape.rail}><meshStandardMaterial color="#929c9e" roughness={0.47} metalness={0.72} side={THREE.DoubleSide} /></mesh>
      <mesh position={[side * 12.5, 0.045, -295]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[2.4, WORLD_SPAN]} /><meshStandardMaterial map={side < 0 ? pavingLeft : pavingRight} color="#c1bcb0" roughness={0.92} bumpMap={landscape.paving} bumpScale={0.025} /></mesh>
      {[11.2, 13.8].map(x => <mesh key={x} position={[side * x, 0.03, -295]} receiveShadow><boxGeometry args={[0.22, 0.16, WORLD_SPAN]} /><meshStandardMaterial color="#8d8b81" roughness={0.96} /></mesh>)}
      <mesh position={[side * 10.35, -0.05, -295]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.45, WORLD_SPAN]} /><meshStandardMaterial color="#5b5848" roughness={1} /></mesh>
    </group>)}
    <instancedMesh ref={mesh => {
      posts.current = mesh;
      if (mesh) { mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.count = 0; previous.current = -1; }
    }} args={[undefined, undefined, postPlacements.length]} frustumCulled={false}><boxGeometry args={[0.12, 0.85, 0.11]} /><meshStandardMaterial color="#767e7b" metalness={0.65} roughness={0.55} /></instancedMesh>
  </>;
}

export default function RoadsideWorld({ low }) {
  const [sourceLeaf, sourceBark] = useTexture(['/textures/roadside/oak-leaves.png', '/textures/roadside/bark.png']);
  const assets = useMemo(() => {
    const leafTexture = sourceLeaf.clone(), barkTexture = sourceBark.clone();
    leafTexture.colorSpace = barkTexture.colorSpace = THREE.SRGBColorSpace;
    leafTexture.anisotropy = barkTexture.anisotropy = 8;
    barkTexture.wrapS = barkTexture.wrapT = THREE.RepeatWrapping;
    leafTexture.needsUpdate = barkTexture.needsUpdate = true;
    const nature = buildNatureAssets({ leafTexture, barkTexture });
    barkTexture.dispose(); // Nature owns its repeat-configured clone.
    return { ...buildArchitectureAssets(), ...nature, ...buildStreetDetailsAssets() };
  }, [sourceLeaf, sourceBark]);
  // Major silhouettes and their seeded locations are identical across quality
  // settings. Only small verge details have a lower initial density.
  const fullPlacements = useMemo(() => createPlacements(false), []);
  const placements = useMemo(() => low ? {
    ...fullPlacements,
    grasses: fullPlacements.grasses.filter((_, i) => i % 2 === 0),
    shrubs: fullPlacements.shrubs.filter((_, i) => i % 2 === 0),
    fence: fullPlacements.fence.filter((_, i) => i % 3 !== 2),
  } : fullPlacements, [fullPlacements, low]);
  const landscape = useMemo(() => createLandscape(), []);
  const visibility = useMemo(() => new RoadVisibility(), []);
  useFrame(({ camera }) => {
    visibility.update(camera, useGameStore.getState().totalDistance * 5);
  }, -0.5);
  useEffect(() => () => disposeAssets(assets), [assets]);
  useEffect(() => () => { Object.values(landscape).forEach(resource => resource.dispose()); }, [landscape]);
  return <>
    <StreetGround landscape={landscape} visibility={visibility} />
    <PlotGround assets={assets} placements={placements} landscape={landscape} visibility={visibility} />
    <StreetLighting model={assets.streetlamp} placements={placements.streetlamp} visibility={visibility} />
    {Object.entries(placements).map(([type, instances]) => instances.length && assets[type] ? <AssetInstances key={type} model={assets[type]} placements={instances} visibility={visibility} /> : null)}
  </>;
}
