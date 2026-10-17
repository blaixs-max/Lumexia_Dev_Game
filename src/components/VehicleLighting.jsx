import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { sampleDayCycle } from '../environment/day-cycle';
import { sampleTunnelAmount } from '../environment/road-path';
import { createTrafficBeamMaterial } from '../environment/vehicle-lighting';

// Targets live in the same car group as the lights, so steering rotates the
// entire beam. Keep this pair mounted throughout the run to avoid recompiling
// every lit material when traffic or quality changes.
const CAR_LIGHTS = {
  rally: { native: true, front: -1.66, height: .577, spacing: .526 },
  street: { native: true, front: -1.932, height: .58, spacing: .484 },
  formula: { native: true, front: -1.618, height: .679, spacing: .657 },
};

export function PlayerHeadlights({ carId }) {
  const layout = CAR_LIGHTS[carId];
  const front = layout?.front ?? -2.018;
  const rear = layout?.rear ?? 2.18;
  const height = layout?.height ?? .53;
  const spacing = layout?.spacing ?? .63;
  const lensWidth = layout?.lensWidth ?? .19;
  const lensHeight = layout?.lensHeight ?? .105;
  const lights = useRef([]), lenses = useRef([]);
  const cycle = useRef({});
  const targets = useMemo(() => [-1, 1].map(side => {
    const target = new THREE.Object3D();
    target.position.set(side * 1.2, -0.04, -27);
    return target;
  }), []);
  useFrame(() => {
    const state = useGameStore.getState();
    const strength = Math.max(sampleDayCycle(state.elapsedTime, cycle.current).night, sampleTunnelAmount(state.totalDistance * 5, -2));
    for (let index = 0; index < 2; index++) {
      if (lights.current[index]) lights.current[index].intensity = 1800 * strength;
      if (lenses.current[index]) lenses.current[index].material.emissiveIntensity = 0.02 + strength * 2.4;
    }
  });
  return <group name="player-headlights">
    {[-1, 1].map((side, index) => <group key={side}>
      <primitive object={targets[index]} />
      <spotLight ref={light => { lights.current[index] = light; }} position={[side * spacing, height + .02, front + .068]} target={targets[index]}
        color="#dcecff" intensity={0} distance={70} angle={0.29} penumbra={0.8} decay={2} castShadow={false} />
      {!layout?.native ? <>
      <mesh position={[side * 0.63, height - .01, front + .118]}>
        <boxGeometry args={[lensWidth + .05, lensHeight + .065, 0.22]} />
        <meshStandardMaterial color="#1c283c" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh ref={mesh => { lenses.current[index] = mesh; }} position={[side * 0.63, height, front]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[lensWidth, lensHeight]} />
        <meshStandardMaterial color="#9caabb" emissive="#dcecff" emissiveIntensity={0.02} metalness={0.3} roughness={0.24} />
      </mesh>
      <mesh position={[side * 0.58, layout?.rearHeight ?? (layout ? height * .75 : .4), rear]}>
        <boxGeometry args={[0.16, 0.07, 0.045]} />
        <meshBasicMaterial color="#ff343d" toneMapped={false} />
      </mesh>
      </> : null}
    </group>)}
  </group>;
}

export function TrafficHeadlights({ id, width, length }) {
  const beam = useRef(), lenses = useRef([]);
  const cycle = useRef({});
  const beamMaterial = useMemo(() => createTrafficBeamMaterial(), []);
  useEffect(() => () => beamMaterial.dispose(), [beamMaterial]);
  useFrame(() => {
    const state = useGameStore.getState();
    let roadZ = 0;
    for (let index = 0; index < state.enemies.length; index++) {
      if (state.enemies[index].id === id) { roadZ = state.enemies[index].z; break; }
    }
    const strength = Math.max(sampleDayCycle(state.elapsedTime, cycle.current).night, sampleTunnelAmount(state.totalDistance * 5, roadZ));
    if (beam.current) beam.current.material.uniforms.lightStrength.value = strength;
    for (let index = 0; index < 2; index++) if (lenses.current[index]) lenses.current[index].material.emissiveIntensity = 0.02 + strength * 2.1;
  });
  return <group name="traffic-headlights">
    {[-1, 1].map((side, index) => <mesh key={side} ref={mesh => { lenses.current[index] = mesh; }} position={[side * width * 0.31, 0.65, -length * 0.49]}>
      <boxGeometry args={[width * 0.15, 0.13, 0.06]} />
      <meshStandardMaterial color="#9caabb" emissive="#dceaff" emissiveIntensity={0.02} metalness={0.3} roughness={0.24} />
    </mesh>)}
    <mesh ref={beam} position={[0, 0.04, -length * 0.5 - 7]} rotation={[-Math.PI / 2, 0, 0]} material={beamMaterial}>
      <planeGeometry args={[width * 2.4, 14]} />
    </mesh>
  </group>;
}
