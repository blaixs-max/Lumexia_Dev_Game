import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { DAY_LIGHT_POSITIONS, DAY_SKY_COLORS, sampleDayCycle } from '../environment/day-cycle';
import { sampleTunnelAmount } from '../environment/road-path';
import NightSky from './NightSky';

export default function RaceLighting({ low = false }) {
  const ambient = useRef(), hemisphere = useRef(), directional = useRef(), fog = useRef();
  const cycle = useRef({});
  const scene = useThree(state => state.scene);
  const palette = useMemo(() => ({
    ambient: [new THREE.Color('#bdcbd6'), new THREE.Color('#a4b9dc'), new THREE.Color('#d5a4a0')],
    upper: [new THREE.Color('#c2d8ec'), new THREE.Color('#8faadc'), new THREE.Color('#bd9cb7')],
    lower: [new THREE.Color('#60634c'), new THREE.Color('#182235'), new THREE.Color('#46394a')],
    directional: [new THREE.Color('#fff0d6'), new THREE.Color('#a5bfee'), new THREE.Color('#ffb27e')],
    horizon: [new THREE.Color(DAY_SKY_COLORS.day.horizon), new THREE.Color(DAY_SKY_COLORS.night.horizon), new THREE.Color(DAY_SKY_COLORS.twilight.horizon)],
    positions: [new THREE.Vector3(...DAY_LIGHT_POSITIONS.day), new THREE.Vector3(...DAY_LIGHT_POSITIONS.night), new THREE.Vector3(...DAY_LIGHT_POSITIONS.twilight)],
  }), []);

  useEffect(() => {
    const previousIntensity = scene.environmentIntensity;
    return () => { scene.environmentIntensity = previousIntensity; };
  }, [scene]);

  useFrame(({ scene: renderScene }) => {
    if (!ambient.current || !hemisphere.current || !directional.current || !fog.current) return;
    const state = useGameStore.getState();
    const { night, twilight } = sampleDayCycle(state.elapsedTime, cycle.current);
    const tunnel = sampleTunnelAmount(state.totalDistance * 5, -2);
    ambient.current.color.copy(palette.ambient[0]).lerp(palette.ambient[1], night).lerp(palette.ambient[2], twilight * 0.45);
    ambient.current.intensity = THREE.MathUtils.lerp(0.22, 0.09, night) * (1 - tunnel * 0.55) + tunnel * 0.08;
    hemisphere.current.color.copy(palette.upper[0]).lerp(palette.upper[1], night).lerp(palette.upper[2], twilight * 0.65);
    hemisphere.current.groundColor.copy(palette.lower[0]).lerp(palette.lower[1], night).lerp(palette.lower[2], twilight * 0.65);
    hemisphere.current.intensity = THREE.MathUtils.lerp(0.85, 0.42, night) * (1 - tunnel * 0.72) + tunnel * 0.18;
    directional.current.color.copy(palette.directional[0]).lerp(palette.directional[1], night).lerp(palette.directional[2], twilight * 0.9);
    directional.current.position.lerpVectors(palette.positions[0], palette.positions[1], night).lerp(palette.positions[2], twilight);
    directional.current.intensity = THREE.MathUtils.lerp(2.65, 0.72, night) * (1 - twilight * 0.38) * (1 - tunnel * 0.82);
    fog.current.color.copy(palette.horizon[0]).lerp(palette.horizon[1], night).lerp(palette.horizon[2], twilight * 0.8);
    fog.current.near = THREE.MathUtils.lerp(260, 160, night);
    fog.current.far = THREE.MathUtils.lerp(600, 590, night);
    renderScene.environmentIntensity = THREE.MathUtils.lerp(1, 0.16, night) * (1 - twilight * 0.3) * (1 - tunnel * 0.7) + tunnel * 0.08;
  }, -0.6);

  // Every light and shader variant stays mounted across the whole cycle.
  // One neutral reflection capture is reused; only its intensity changes.
  return <>
    <ambientLight ref={ambient} intensity={0.22} color="#bdcbd6" />
    <hemisphereLight ref={hemisphere} args={['#c2d8ec', '#60634c', 0.85]} />
    <directionalLight ref={directional} position={DAY_LIGHT_POSITIONS.day} color="#fff0d6" intensity={2.65} castShadow={!low}
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-40} shadow-camera-right={40}
      shadow-camera-top={52} shadow-camera-bottom={-40} shadow-camera-near={1} shadow-camera-far={600}
      shadow-bias={-0.0003} shadow-normalBias={0.04} />
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" intensity={3} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 30, 1]} color="#d6eaff" />
      <Lightformer form="rect" intensity={4} position={[-12, 5, -6]} rotation={[0, Math.PI / 2, 0]} scale={[30, 8, 1]} color="#ffd6a0" />
      <Lightformer form="rect" intensity={2} position={[12, 6, 3]} rotation={[0, -Math.PI / 2, 0]} scale={[20, 8, 1]} color="#a8d9e8" />
    </Environment>
    <NightSky />
    <fog ref={fog} attach="fog" args={[DAY_SKY_COLORS.day.horizon, 260, 600]} />
  </>;
}
