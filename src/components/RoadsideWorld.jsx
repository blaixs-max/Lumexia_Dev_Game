import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { buildArchitectureAssets } from '../environment/architecture';
import { buildNatureAssets } from '../environment/nature';
import { buildStreetDetailsAssets } from '../environment/street-details';
import { createLandscape, createPlacements, WORLD_SPAN } from '../environment/landscape';

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

const AssetInstances = memo(function AssetInstances({ model, placements, low }) {
  const refs = useRef([]);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const parts = useMemo(() => {
    model.updateMatrixWorld(true);
    const result = [];
    model.traverse(node => { if (node.isMesh) result.push({ geometry: node.geometry, material: node.material, matrix: node.matrixWorld.clone() }); });
    return result;
  }, [model]);
  useFrame(() => {
    const distance = useGameStore.getState().totalDistance * 5;
    for (let i = 0; i < placements.length; i++) {
      const item = placements[i];
      const z = 65 - ((item.z + WORLD_SPAN - distance % WORLD_SPAN) % WORLD_SPAN);
      const shown = z > -(low ? 370 : 535);
      transform.position.set(item.x, 0, z);
      transform.rotation.set(0, item.rotation, 0);
      transform.scale.setScalar(shown ? item.scale : 0);
      transform.updateMatrix();
      for (let p = 0; p < parts.length; p++) {
        matrix.multiplyMatrices(transform.matrix, parts[p].matrix);
        refs.current[p]?.setMatrixAt(i, matrix);
      }
    }
    for (const mesh of refs.current) if (mesh) mesh.instanceMatrix.needsUpdate = true;
  });
  return <>{parts.map((part, index) => <instancedMesh key={index} ref={mesh => { refs.current[index] = mesh; }}
    args={[part.geometry, part.material, placements.length]} frustumCulled={false} dispose={null}
    castShadow={!low} receiveShadow />)}</>;
});

function PlotGround({ assets, placements, landscape, low }) {
  const shadows = useRef(), walks = useRef();
  const transform = useMemo(() => new THREE.Object3D(), []);
  const plots = useMemo(() => Object.entries(placements).flatMap(([type, positions]) => {
    if (!['oak', 'oak2', 'poplar', 'pine', 'shrubs', 'townhouse', 'villa', 'apartment', 'office', 'warehouse'].includes(type)) return [];
    const size = new THREE.Box3().setFromObject(assets[type]).getSize(new THREE.Vector3());
    const building = ['townhouse', 'villa', 'apartment', 'office', 'warehouse'].includes(type);
    return positions.map(item => ({ ...item, building, width: size.x, depth: size.z }));
  }), [assets, placements]);
  const homes = useMemo(() => plots.filter(p => p.building), [plots]);
  useFrame(() => {
    if (!shadows.current || !walks.current) return;
    const distance = useGameStore.getState().totalDistance * 5;
    for (let i = 0; i < plots.length; i++) {
      const item = plots[i];
      const z = 65 - ((item.z + WORLD_SPAN - distance % WORLD_SPAN) % WORLD_SPAN);
      const scale = z > -(low ? 370 : 535) ? item.scale : 0;
      transform.position.set(item.x, 0.055, z); transform.rotation.set(-Math.PI / 2, 0, item.rotation);
      transform.scale.set(item.width * scale * 1.1, item.depth * scale * 1.1, 1); transform.updateMatrix(); shadows.current.setMatrixAt(i, transform.matrix);
    }
    for (let i = 0; i < homes.length; i++) {
      const item = homes[i], side = Math.sign(item.x);
      const z = 65 - ((item.z + WORLD_SPAN - distance % WORLD_SPAN) % WORLD_SPAN);
      const front = Math.abs(item.x) - item.depth * item.scale * 0.5 + 0.1;
      const length = Math.max(0.1, front - 13.8);
      transform.position.set(side * (13.8 + length * 0.5), 0.018, z);
      transform.rotation.set(-Math.PI / 2, 0, 0); transform.scale.set(z > -(low ? 370 : 535) ? length : 0, 2.4, 1);
      transform.updateMatrix(); walks.current.setMatrixAt(i, transform.matrix);
    }
    shadows.current.instanceMatrix.needsUpdate = true; walks.current.instanceMatrix.needsUpdate = true;
  });
  return <>
    <instancedMesh ref={shadows} args={[undefined, undefined, plots.length]} frustumCulled={false}><planeGeometry /><meshBasicMaterial map={landscape.contact} transparent depthWrite={false} /></instancedMesh>
    <instancedMesh ref={walks} args={[undefined, undefined, homes.length]} frustumCulled={false} receiveShadow><planeGeometry /><meshStandardMaterial color="#a5a18e" roughness={0.98} /></instancedMesh>
  </>;
}

function StreetGround({ landscape }) {
  const posts = useRef();
  const pavingLeft = useMemo(() => landscape.paving.clone(), [landscape]);
  const pavingRight = useMemo(() => landscape.paving.clone(), [landscape]);
  const transform = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => () => { pavingLeft.dispose(); pavingRight.dispose(); }, [pavingLeft, pavingRight]);
  useFrame(() => {
    const distance = useGameStore.getState().totalDistance * 5;
    pavingLeft.offset.set(0, -distance / 4);
    pavingRight.offset.set(0, -distance / 4);
    if (!posts.current) return;
    for (let i = 0; i < 240; i++) {
      transform.position.set(i % 2 ? 9.05 : -9.05, 0.42, 65 - ((Math.floor(i / 2) * 5 + 600 - distance % 600) % 600));
      transform.updateMatrix(); posts.current.setMatrixAt(i, transform.matrix);
    }
    posts.current.instanceMatrix.needsUpdate = true;
  });
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, -200]} receiveShadow><planeGeometry args={[1600, 1600]} /><meshStandardMaterial map={landscape.grass} color="#bac2a5" roughness={1} bumpMap={landscape.grass} bumpScale={0.045} /></mesh>
    <mesh geometry={landscape.terrain}><meshStandardMaterial vertexColors roughness={1} /></mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 9, 0, 0]} geometry={landscape.rail}><meshStandardMaterial color="#929c9e" roughness={0.47} metalness={0.72} side={THREE.DoubleSide} /></mesh>
      <mesh position={[side * 12.5, 0.045, -240]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[2.4, 600]} /><meshStandardMaterial map={side < 0 ? pavingLeft : pavingRight} color="#c1bcb0" roughness={0.92} bumpMap={landscape.paving} bumpScale={0.025} /></mesh>
      {[11.2, 13.8].map(x => <mesh key={x} position={[side * x, 0.03, -240]} receiveShadow><boxGeometry args={[0.22, 0.16, 600]} /><meshStandardMaterial color="#8d8b81" roughness={0.96} /></mesh>)}
      <mesh position={[side * 10.35, -0.05, -240]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.45, 600]} /><meshStandardMaterial color="#5b5848" roughness={1} /></mesh>
    </group>)}
    <instancedMesh ref={posts} args={[undefined, undefined, 240]} frustumCulled={false}><boxGeometry args={[0.12, 0.85, 0.11]} /><meshStandardMaterial color="#767e7b" metalness={0.65} roughness={0.55} /></instancedMesh>
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
    return { ...buildArchitectureAssets(), ...buildNatureAssets({ leafTexture, barkTexture }), ...buildStreetDetailsAssets() };
  }, [sourceLeaf, sourceBark]);
  const placements = useMemo(() => createPlacements(low), [low]);
  const landscape = useMemo(() => createLandscape(), []);
  useEffect(() => () => {
    disposeAssets(assets);
  }, [assets]);
  useEffect(() => () => { Object.values(landscape).forEach(resource => resource.dispose()); }, [landscape]);
  return <>
    <StreetGround landscape={landscape} />
    <PlotGround assets={assets} placements={placements} landscape={landscape} low={low} />
    {Object.entries(placements).map(([type, instances]) => instances.length && assets[type] ? <AssetInstances key={type} model={assets[type]} placements={instances} low={low} /> : null)}
  </>;
}
