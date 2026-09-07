import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { createTrafficBeamMaterial } from '../environment/vehicle-lighting';

// Targets live in the same car group as the lights, so steering rotates the
// entire beam. Keep this pair mounted throughout the run to avoid recompiling
// every lit material when traffic or quality changes.
export function PlayerHeadlights() {
  const targets = useMemo(() => [-1, 1].map(side => {
    const target = new THREE.Object3D();
    target.position.set(side * 1.2, -0.04, -27);
    return target;
  }), []);
  return <group name="player-headlights">
    {[-1, 1].map((side, index) => <group key={side}>
      <primitive object={targets[index]} />
      <spotLight position={[side * 0.63, 0.55, -1.95]} target={targets[index]}
        color="#dcecff" intensity={1800} distance={70} angle={0.29} penumbra={0.8} decay={2} castShadow={false} />
      <mesh position={[side * 0.63, 0.52, -1.9]}>
        <boxGeometry args={[0.24, 0.17, 0.22]} />
        <meshStandardMaterial color="#1c283c" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[side * 0.63, 0.53, -2.018]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.19, 0.105]} />
        <meshBasicMaterial color="#e2f0ff" toneMapped={false} />
      </mesh>
      <mesh position={[side * 0.58, 0.4, 2.18]}>
        <boxGeometry args={[0.16, 0.07, 0.045]} />
        <meshBasicMaterial color="#ff343d" toneMapped={false} />
      </mesh>
    </group>)}
  </group>;
}

export function TrafficHeadlights({ width, length }) {
  const beamMaterial = useMemo(() => createTrafficBeamMaterial(), []);
  useEffect(() => () => beamMaterial.dispose(), [beamMaterial]);
  return <group name="traffic-headlights">
    {[-1, 1].map(side => <mesh key={side} position={[side * width * 0.31, 0.65, -length * 0.49]}>
      <boxGeometry args={[width * 0.15, 0.13, 0.06]} />
      <meshBasicMaterial color="#dceaff" toneMapped={false} />
    </mesh>)}
    <mesh position={[0, 0.04, -length * 0.5 - 7]} rotation={[-Math.PI / 2, 0, 0]} material={beamMaterial}>
      <planeGeometry args={[width * 2.4, 14]} />
    </mesh>
  </group>;
}
