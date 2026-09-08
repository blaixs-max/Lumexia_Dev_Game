import { memo, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { VEHICLE_DIMENSIONS, damp } from '../utils/gameplay';
import { NitroBoostParticles, RocketTrailParticles } from './AdvancedParticles';
import RoadsideWorld from './RoadsideWorld';
import RaceLighting from './RaceLighting';
import CurvedRoadMesh from './CurvedRoadMesh';
import RoadTunnels from './RoadTunnels';
import { placeOnRoad, sampleRoadFrame } from '../environment/road-path';
import { PlayerHeadlights, TrafficHeadlights } from './VehicleLighting';
import { createTrafficBeamMaterial } from '../environment/vehicle-lighting';

useGLTF.setDecoderPath('/draco/');
const PLAYER_MODEL = '/models/sport_car_runtime.glb';
const TRAFFIC_MODELS = {
  sport: { path: '/models/ferrari_runtime.glb', rotation: 0 },
  sedan: { path: '/models/Car 3/scene.gltf', rotation: Math.PI },
  suv: { path: '/models/Car 2/scene.gltf', rotation: Math.PI },
  truck: { path: '/models/truck.glb', rotation: Math.PI },
};

function VehicleModel({ path, type = 'player', rotation = 0 }) {
  const { scene } = useGLTF(path);
  const { model, scale, offset } = useMemo(() => {
    const model = scene.clone(true);
    model.traverse(child => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const dimensions = VEHICLE_DIMENSIONS[type];
    // Rendered vehicles fit their collision bounds, including their origin.
    const scale = Math.min(dimensions.width / size.x, dimensions.length / size.z);
    return { model, scale, offset: [-center.x * scale, -box.min.y * scale, -center.z * scale] };
  }, [scene, type]);
  return <group rotation={[0, rotation, 0]}><primitive object={model} scale={scale} position={offset} dispose={null} /></group>;
}

function ContactPatch({ width, length }) {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} scale={[width * 0.62, length * 0.48, 1]}>
    <circleGeometry args={[1, 24]} /><meshBasicMaterial color="#06101b" transparent opacity={0.38} depthWrite={false} />
  </mesh>;
}

function PlayerCar() {
  const group = useRef();
  const frame = useRef({});
  const playerPosition = useMemo(() => [0, 0.1, -2], []);
  const boosting = useGameStore(s => s.isNitroActive && s.gameState === 'playing');
  const rocket = useGameStore(s => s.rocketActive && s.gameState === 'playing');
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame((_, delta) => {
    const state = useGameStore.getState();
    if (!group.current || state.gameState === 'paused') return;
    const road = sampleRoadFrame(state.totalDistance * 5, -2, frame.current);
    group.current.position.set(road.x + state.currentX * Math.cos(road.yaw), 0.09, road.z - state.currentX * Math.sin(road.yaw));
    const tilt = reducedMotion ? 0 : -state.steeringVelocity * 0.008;
    group.current.rotation.z = damp(group.current.rotation.z, tilt, 8, Math.min(delta, 0.1));
    group.current.rotation.y = damp(group.current.rotation.y, road.yaw - state.steeringVelocity * 0.012, 8, Math.min(delta, 0.1));
    // Stable transient array shared with instanced particles, not React state.
    /* eslint-disable react-hooks/immutability */
    playerPosition[0] = group.current.position.x;
    playerPosition[2] = group.current.position.z;
    /* eslint-enable react-hooks/immutability */
  });
  return <>
    <group ref={group} position={[0, 0.09, -2]}>
      <ContactPatch width={1.8} length={5.5} />
      <VehicleModel path={PLAYER_MODEL} />
      <PlayerHeadlights />
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.6, 4]} /><meshBasicMaterial color={rocket ? '#ff894c' : '#9eeff2'} transparent opacity={boosting || rocket ? 0.32 : 0.1} depthWrite={false} /></mesh>
    </group>
    <NitroBoostParticles position={playerPosition} isActive={boosting && !reducedMotion} />
    <RocketTrailParticles position={playerPosition} isActive={rocket && !reducedMotion} />
  </>;
}

function ChaseCamera() {
  const { camera, size } = useThree();
  const focus = useMemo(() => new THREE.Vector3(), []);
  const roadFrame = useRef({});
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame((_, delta) => {
    const state = useGameStore.getState();
    if (state.gameState === 'paused') return;
    const dt = Math.min(delta, 0.1);
    const portrait = size.height > size.width;
    const targetFov = (portrait ? 66 : 54) + (reducedMotion ? 0 : Math.min(state.speed / 28, 7) + (state.isNitroActive || state.rocketActive ? 4 : 0));
    camera.position.set(damp(camera.position.x, state.currentX * 0.38, 3, dt),
      damp(camera.position.y, portrait ? 6.4 : 5.2, 3, dt), damp(camera.position.z, portrait ? 13 : 11.5, 3, dt));
    const road = sampleRoadFrame(state.totalDistance * 5, -36, roadFrame.current);
    focus.set(road.x + state.currentX * 0.15, 0.7, road.z);
    camera.lookAt(focus);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      /* eslint-disable react-hooks/immutability */
      camera.fov = damp(camera.fov, targetFov, 3, dt);
      camera.updateProjectionMatrix();
      /* eslint-enable react-hooks/immutability */
    }
  }, -0.75);
  return null;
}

const TrafficCar = memo(function TrafficCar({ id, type }) {
  const group = useRef();
  const roadFrame = useRef({});
  const signals = useRef();
  const model = TRAFFIC_MODELS[type] || TRAFFIC_MODELS.sedan;
  const dimensions = VEHICLE_DIMENSIONS[type] || VEHICLE_DIMENSIONS.sedan;
  useFrame(() => {
    const state = useGameStore.getState();
    const enemy = state.enemies.find(item => item.id === id);
    if (!group.current || !enemy) return;
    const road = sampleRoadFrame(state.totalDistance * 5, enemy.z, roadFrame.current);
    group.current.position.set(road.x + enemy.x * Math.cos(road.yaw), 0, road.z - enemy.x * Math.sin(road.yaw));
    group.current.rotation.y = road.yaw + (enemy.isChanging ? enemy.indicator * -0.09 : 0);
    if (signals.current) {
      signals.current.visible = Boolean(enemy.indicator) && Math.sin(state.elapsedTime * 14) > 0;
      signals.current.position.x = enemy.indicator * dimensions.width * 0.4;
    }
  });
  return <group ref={group} position={[0, 0, -350]}>
    <ContactPatch width={dimensions.width} length={dimensions.length} />
    <Suspense fallback={<mesh position={[0, 0.8, 0]}><boxGeometry args={[dimensions.width, 1.6, dimensions.length]} /><meshStandardMaterial color="#acbac5" /></mesh>}>
      <VehicleModel path={model.path} type={type} rotation={model.rotation} />
    </Suspense>
    <TrafficHeadlights id={id} width={dimensions.width} length={dimensions.length} />
    <group position={[0, 0.72, dimensions.length * 0.48]}>
      {[-1, 1].map(side => <mesh key={side} position={[side * dimensions.width * 0.32, 0, 0]}><boxGeometry args={[0.28, 0.12, 0.06]} /><meshBasicMaterial color="#fd544f" toneMapped={false} /></mesh>)}
      <mesh ref={signals}><boxGeometry args={[0.25, 0.17, 0.1]} /><meshBasicMaterial color="#ffd15b" toneMapped={false} /></mesh>
    </group>
  </group>;
});

function Traffic() {
  const signature = useGameStore(s => s.enemies.map(e => `${e.id}:${e.type}`).join('|'));
  const entities = useMemo(() => signature ? signature.split('|').map(item => { const [id, type] = item.split(':'); return { id, type }; }) : [], [signature]);
  return <>{entities.map(enemy => <TrafficCar key={enemy.id} {...enemy} />)}</>;
}

const Pickup = memo(function Pickup({ id, kind }) {
  const group = useRef();
  const token = useRef();
  const roadFrame = useRef({});
  const color = kind === 'rocket' ? '#ff9065' : kind === 'magnet' ? '#90e4f2' : '#fbd775';
  useFrame(() => {
    const state = useGameStore.getState();
    const pickup = state.coins.find(coin => coin.id === id);
    if (!group.current || !pickup) return;
    const road = sampleRoadFrame(state.totalDistance * 5, pickup.z, roadFrame.current);
    group.current.position.set(road.x + pickup.x * Math.cos(road.yaw), 1.2 + Math.sin(state.elapsedTime * 3 + pickup.z * 0.1) * 0.12, road.z - pickup.x * Math.sin(road.yaw));
    group.current.rotation.y = road.yaw;
    token.current.rotation.y = state.elapsedTime * 2.5;
  });
  return <group ref={group} position={[0, 1.2, -300]}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.05, 0]}><ringGeometry args={[0.4, 0.7, 24]} /><meshBasicMaterial color={color} transparent opacity={0.55} depthWrite={false} /></mesh>
    <group ref={token}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.5, 0.5, 0.14, 24]} /><meshStandardMaterial color={color} metalness={0.65} roughness={0.23} emissive={color} emissiveIntensity={0.25} /></mesh>
      {kind === 'coin' ? <mesh position={[0, 0, 0.082]}><torusGeometry args={[0.35, 0.024, 6, 20]} /><meshStandardMaterial color="#fff0b8" metalness={0.8} roughness={0.2} /></mesh> : <mesh position={[0, 0.05, 0.13]} rotation={[0, 0, kind === 'rocket' ? 0 : Math.PI]}><coneGeometry args={[0.2, 0.62, 3]} /><meshBasicMaterial color="#0b2535" /></mesh>}
    </group>
  </group>;
});

function Pickups() {
  const signature = useGameStore(s => s.coins.map(c => `${c.id}:${c.kind || 'coin'}`).join('|'));
  const entities = useMemo(() => signature ? signature.split('|').map(item => { const [id, kind] = item.split(':'); return { id, kind }; }) : [], [signature]);
  return <>{entities.map(coin => <Pickup key={coin.id} {...coin} />)}</>;
}

function Road() {
  const stripes = useRef();
  const markers = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const curved = useMemo(() => new THREE.Matrix4(), []);
  const asphalt = useMemo(() => {
    const data = new Uint8Array(64 * 64 * 4);
    for (let i = 0; i < 64 * 64; i++) {
      const value = 105 + ((i * 73 + Math.floor(i / 64) * 17) % 31);
      data.set([value, value, value, 255], i * 4);
    }
    const texture = new THREE.DataTexture(data, 64, 64);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 170);
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => () => asphalt.dispose(), [asphalt]);
  useFrame(() => {
    const distance = useGameStore.getState().totalDistance * 5;
    if (!stripes.current || !markers.current) return;
    for (let i = 0; i < 60; i++) {
      const z = 25 - ((Math.floor(i / 2) * 16 + 480 - distance % 480) % 480);
      dummy.position.set(i % 2 ? 2.25 : -2.25, 0.025, 0);
      dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      stripes.current.setMatrixAt(i, placeOnRoad(curved, dummy.matrix, z, distance));
      dummy.position.set(i % 2 ? 8.8 : -8.8, 0.3, 0);
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); markers.current.setMatrixAt(i, placeOnRoad(curved, dummy.matrix, z, distance));
    }
    stripes.current.instanceMatrix.needsUpdate = true;
    markers.current.instanceMatrix.needsUpdate = true;
    asphalt.offset.set(0, -(distance % 200) / 200);
  });
  return <>
    <CurvedRoadMesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -295]} args={[17, 720, 1, 144]} receiveShadow><meshStandardMaterial color="#555f70" map={asphalt} roughness={0.72} /></CurvedRoadMesh>
    <CurvedRoadMesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, -295]} args={[21, 720, 1, 144]} receiveShadow><meshStandardMaterial color="#334148" roughness={0.96} /></CurvedRoadMesh>
    <instancedMesh ref={stripes} args={[undefined, undefined, 60]} frustumCulled={false}><planeGeometry args={[0.16, 5]} /><meshStandardMaterial color="#c5cede" roughness={0.8} emissive="#607799" emissiveIntensity={0.14} /></instancedMesh>
    <instancedMesh ref={markers} args={[undefined, undefined, 60]} frustumCulled={false}><boxGeometry args={[0.1, 0.4, 0.17]} /><meshStandardMaterial color="#ffe0aa" emissive="#ffb55a" emissiveIntensity={0.7} /></instancedMesh>
    {[-1, 1].map(side => <group key={side}>
      <CurvedRoadMesh position={[side * 7.4, 0.035, -295]} rotation={[-Math.PI / 2, 0, 0]} args={[0.14, 720, 1, 144]}><meshStandardMaterial color="#e3d3a9" roughness={0.8} emissive="#9b8147" emissiveIntensity={0.12} /></CurvedRoadMesh>
    </group>)}
  </>;
}

function FeedbackParticles() {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const roadFrame = useRef({});
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    if (!mesh.current) return;
    const state = useGameStore.getState();
    const particles = state.particles;
    for (let i = 0; i < 70; i++) {
      const p = particles[i];
      if (p) {
        const road = sampleRoadFrame(state.totalDistance * 5, p.z, roadFrame.current);
        dummy.position.set(road.x + p.x * Math.cos(road.yaw), p.y, road.z - p.x * Math.sin(road.yaw)); dummy.scale.setScalar(Math.max(0, p.life) * (p.size || 0.15));
        color.set(p.color || '#ffe5a0'); mesh.current.setColorAt(i, color);
      } else { dummy.scale.setScalar(0); }
      dummy.updateMatrix(); mesh.current.setMatrixAt(i, dummy.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, 70]} frustumCulled={false}><boxGeometry args={[0.15, 0.15, 0.4]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>;
}

export default function RaceScene({ low, adaptive, onReady, onReduceQuality }) {
  // Load every traffic type before the countdown; prepare its material with the
  // actual race lighting so its first appearance doesn't compile new shaders.
  const loaded = useGLTF([PLAYER_MODEL, ...Object.values(TRAFFIC_MODELS).map(model => model.path)]);
  const beamWarmup = useMemo(() => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), createTrafficBeamMaterial()), []);
  useEffect(() => () => { beamWarmup.geometry.dispose(); beamWarmup.material.dispose(); }, [beamWarmup]);
  const warmupScene = useMemo(() => {
    const group = new THREE.Group();
    for (const asset of loaded) {
      const clone = asset.scene.clone(true);
      clone.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
      group.add(clone);
    }
    group.add(beamWarmup);
    return group;
  }, [loaded, beamWarmup]);
  const ready = useRef(false);
  const warmup = useRef({ frames: 0, started: false, complete: false });
  const samples = useRef({ time: 0, frames: 0, warmup: 3 });
  useFrame(({ gl, scene, camera }, delta) => {
    if (!warmup.current.complete) {
      // Let the one-frame reflection environment finish before compiling.
      if (++warmup.current.frames >= 2 && !warmup.current.started) {
        warmup.current.started = true;
        const textures = new Set();
        warmupScene.traverse(node => {
          if (!node.isMesh) return;
          for (const material of [node.material].flat()) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        });
        for (const texture of textures) gl.initTexture(texture);
        gl.compileAsync(warmupScene, camera, scene).then(() => { warmup.current.complete = true; })
          .catch(error => { console.warn('Race shader warmup:', error); warmup.current.complete = true; });
      }
      return;
    }
    if (!ready.current) { ready.current = true; onReady(); }
    useGameStore.getState().updateGame(delta);
    if (adaptive && useGameStore.getState().gameState === 'playing') {
      if (samples.current.warmup > 0) { samples.current.warmup -= delta; return; }
      samples.current.time += delta; samples.current.frames++;
      if (samples.current.time >= 5) {
        if (samples.current.frames / samples.current.time < 52) onReduceQuality();
        samples.current.time = 0; samples.current.frames = 0;
      }
    }
  }, -1);
  return <>
    <RaceLighting low={low} /><ChaseCamera /><Road /><RoadsideWorld low={low} /><RoadTunnels />
    <PlayerCar /><Traffic /><Pickups /><FeedbackParticles />
  </>;
}
