import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { VEHICLE_DIMENSIONS } from '../utils/vehicleDimensions';
import { TrafficHeadlights } from './VehicleLighting';
import { getRaceSunShadowLights, prepareRaceSunShadowMaterials } from '../environment/sun-shadows';
import { cloneTrafficFallback, createTrafficBodyBatches, updateTrafficBodyBatches, updateTrafficPoses } from '../environment/traffic-render';

const TrafficCarLights = memo(function TrafficCarLights({ id, type, model, poses }) {
  const group = useRef(), signals = useRef();
  const dimensions = VEHICLE_DIMENSIONS[type] || VEHICLE_DIMENSIONS.sedan;
  const rearMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ad3530', toneMapped: false }), []);
  const fallback = useMemo(() => model.instanced ? null : cloneTrafficFallback(model), [model]);
  useEffect(() => () => rearMaterial.dispose(), [rearMaterial]);
  useFrame(() => {
    const state = useGameStore.getState();
    const enemy = state.enemies.find(item => item.id === id);
    const pose = poses.get(id);
    if (!group.current || !enemy || !pose) return;
    group.current.position.set(pose.x, pose.y, pose.z);
    group.current.rotation.y = pose.yaw;
    const braking = Number.isFinite(enemy.actualSpeed) && enemy.actualSpeed < enemy.ownSpeed - 6;
    rearMaterial.color.setHex(braking ? 0xff7461 : 0xad3530);
    if (signals.current) {
      signals.current.visible = Boolean(enemy.indicator) && Math.sin(state.elapsedTime * 14) > 0;
      signals.current.position.x = enemy.indicator * dimensions.width * 0.4;
    }
  });
  return <group ref={group} name={`traffic-car-${id}`} position={[0, -0.025, -350]}>
    {fallback ? <primitive object={fallback} dispose={null} /> : null}
    <TrafficHeadlights id={id} width={dimensions.width} length={dimensions.length} />
    <group position={[0, 0.72, dimensions.length * 0.48]}>
      {[-1, 1].map(side => <mesh key={side} position={[side * dimensions.width * 0.32, 0, 0]} material={rearMaterial}><boxGeometry args={[0.28, 0.12, 0.06]} /></mesh>)}
      <mesh ref={signals}><boxGeometry args={[0.25, 0.17, 0.1]} /><meshBasicMaterial color="#ffd15b" toneMapped={false} /></mesh>
    </group>
  </group>;
});

export default function TrafficVehicles({ models }) {
  const { scene, camera } = useThree();
  const resource = useMemo(() => createTrafficBodyBatches(models), [models]);
  const poses = useMemo(() => new Map(), []);
  const signature = useGameStore(state => state.enemies.map(enemy => `${enemy.id}:${enemy.type}`).join('|'));
  const entities = useMemo(() => signature ? signature.split('|').map(item => {
    const [id, type] = item.split(':'); return { id, type };
  }) : [], [signature]);
  useLayoutEffect(() => {
    prepareRaceSunShadowMaterials(scene, Object.values(models).flatMap(model => model.parts.flatMap(part => [part.material].flat())));
    return () => resource.dispose();
  }, [models, resource, scene]);
  useFrame((_, delta) => {
    const state = useGameStore.getState();
    updateTrafficPoses(poses, state, delta);
    camera.updateMatrixWorld();
    const lights = getRaceSunShadowLights(scene);
    for (const light of lights) {
      // Match the shadow renderer's forthcoming camera exactly, after the
      // sun/CSM update. This changes no shadow settings, splits or coverage.
      light.updateWorldMatrix(true, false);
      light.target.updateWorldMatrix(true, false);
      light.shadow.updateMatrices(light);
    }
    updateTrafficBodyBatches(resource, state.enemies, poses, [camera, ...lights.map(light => light.shadow.camera)]);
  }, -0.4);
  return <>
    <primitive object={resource.root} dispose={null} />
    {entities.map(enemy => <TrafficCarLights key={enemy.id} {...enemy} model={models[enemy.type] || models.sedan} poses={poses} />)}
  </>;
}
