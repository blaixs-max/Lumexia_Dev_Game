import { memo, Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Sky, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { VEHICLE_DIMENSIONS, damp } from '../utils/gameplay';
import { NitroBoostParticles, RocketTrailParticles } from './AdvancedParticles';

useGLTF.setDecoderPath('/draco/');
const CITY = '/models/Kaykit-city/KayKit_City_Builder_Bits_1.0_FREE/Assets/gltf/';
const PLAYER_MODEL = '/models/sport_car_compact.glb';
const TRAFFIC_MODELS = {
  sport: { path: '/models/ferrari.glb', rotation: 0 },
  sedan: { path: '/models/Car 3/scene.gltf', rotation: Math.PI },
  suv: { path: '/models/Car 2/scene.gltf', rotation: Math.PI },
  truck: { path: '/models/truck.glb', rotation: Math.PI },
};

// One locally generated reflection environment; no runtime HDR/CDN dependency.
function RaceLighting({ low }) {
  return <>
    <ambientLight intensity={0.6} color="#b4c6de" />
    <hemisphereLight args={['#c1def1', '#30494a', 1.8]} />
    <directionalLight position={[-35, 60, -100]} color="#ffdbab" intensity={3.2} castShadow={!low}
      shadow-mapSize={[1024, 1024]} shadow-camera-left={-22} shadow-camera-right={22}
      shadow-camera-top={34} shadow-camera-bottom={-25} shadow-camera-near={1} shadow-camera-far={190}
      shadow-bias={-0.0003} shadow-normalBias={0.04} />
    <Environment resolution={64} frames={1}>
      <Lightformer form="rect" intensity={3} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[20, 30, 1]} color="#d6eaff" />
      <Lightformer form="rect" intensity={4} position={[-12, 5, -6]} rotation={[0, Math.PI / 2, 0]} scale={[30, 8, 1]} color="#ffd6a0" />
      <Lightformer form="rect" intensity={2} position={[12, 6, 3]} rotation={[0, -Math.PI / 2, 0]} scale={[20, 8, 1]} color="#a8d9e8" />
    </Environment>
    <Sky distance={10000} sunPosition={[-180, 24, -500]} turbidity={7} rayleigh={1.4} mieCoefficient={0.007} mieDirectionalG={0.85} />
    <fog attach="fog" args={['#81969e', 110, low ? 300 : 470]} />
  </>;
}

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
  const playerPosition = useMemo(() => [0, 0.1, -2], []);
  const boosting = useGameStore(s => s.isNitroActive && s.gameState === 'playing');
  const rocket = useGameStore(s => s.rocketActive && s.gameState === 'playing');
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame((_, delta) => {
    const state = useGameStore.getState();
    if (!group.current || state.gameState === 'paused') return;
    group.current.position.x = state.currentX;
    const tilt = reducedMotion ? 0 : -state.steeringVelocity * 0.008;
    group.current.rotation.z = damp(group.current.rotation.z, tilt, 8, Math.min(delta, 0.1));
    group.current.rotation.y = damp(group.current.rotation.y, -state.steeringVelocity * 0.012, 8, Math.min(delta, 0.1));
    // Stable transient array shared with instanced particles, not React state.
    /* eslint-disable react-hooks/immutability */
    playerPosition[0] = state.currentX;
    /* eslint-enable react-hooks/immutability */
  });
  return <>
    <group ref={group} position={[0, 0.09, -2]}>
      <ContactPatch width={1.8} length={5.5} />
      <VehicleModel path={PLAYER_MODEL} />
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.6, 4]} /><meshBasicMaterial color={rocket ? '#ff894c' : '#9eeff2'} transparent opacity={boosting || rocket ? 0.32 : 0.1} depthWrite={false} /></mesh>
    </group>
    <NitroBoostParticles position={playerPosition} isActive={boosting && !reducedMotion} />
    <RocketTrailParticles position={playerPosition} isActive={rocket && !reducedMotion} />
  </>;
}

function ChaseCamera() {
  const { camera, size } = useThree();
  const focus = useMemo(() => new THREE.Vector3(), []);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  useFrame((_, delta) => {
    const state = useGameStore.getState();
    if (state.gameState === 'paused') return;
    const dt = Math.min(delta, 0.1);
    const portrait = size.height > size.width;
    const targetFov = (portrait ? 66 : 54) + (reducedMotion ? 0 : Math.min(state.speed / 28, 7) + (state.isNitroActive || state.rocketActive ? 4 : 0));
    camera.position.set(damp(camera.position.x, state.currentX * 0.38, 3, dt),
      damp(camera.position.y, portrait ? 6.4 : 5.2, 3, dt), damp(camera.position.z, portrait ? 13 : 11.5, 3, dt));
    focus.set(state.currentX * 0.15, 0.7, -36);
    camera.lookAt(focus);
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      /* eslint-disable react-hooks/immutability */
      camera.fov = damp(camera.fov, targetFov, 3, dt);
      camera.updateProjectionMatrix();
      /* eslint-enable react-hooks/immutability */
    }
  });
  return null;
}

const TrafficCar = memo(function TrafficCar({ id, type }) {
  const group = useRef();
  const signals = useRef();
  const model = TRAFFIC_MODELS[type] || TRAFFIC_MODELS.sedan;
  const dimensions = VEHICLE_DIMENSIONS[type] || VEHICLE_DIMENSIONS.sedan;
  useFrame(() => {
    const state = useGameStore.getState();
    const enemy = state.enemies.find(item => item.id === id);
    if (!group.current || !enemy) return;
    group.current.position.set(enemy.x, 0, enemy.z);
    group.current.rotation.y = enemy.isChanging ? enemy.indicator * -0.09 : 0;
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
  const color = kind === 'rocket' ? '#ff9065' : kind === 'magnet' ? '#90e4f2' : '#fbd775';
  useFrame(() => {
    const state = useGameStore.getState();
    const pickup = state.coins.find(coin => coin.id === id);
    if (!group.current || !pickup) return;
    group.current.position.set(pickup.x, 1.2 + Math.sin(state.elapsedTime * 3 + pickup.z * 0.1) * 0.12, pickup.z);
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
      dummy.position.set(i % 2 ? 2.25 : -2.25, 0.025, 25 - ((Math.floor(i / 2) * 16 + 480 - distance % 480) % 480));
      dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      stripes.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(i % 2 ? 8.8 : -8.8, 0.3, 25 - ((Math.floor(i / 2) * 16 + 480 - distance % 480) % 480));
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); markers.current.setMatrixAt(i, dummy.matrix);
    }
    stripes.current.instanceMatrix.needsUpdate = true;
    markers.current.instanceMatrix.needsUpdate = true;
    asphalt.offset.set(0, -(distance % 200) / 200);
  });
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, -180]} receiveShadow><planeGeometry args={[17, 600]} /><meshStandardMaterial color="#69737b" map={asphalt} roughness={0.85} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, -180]} receiveShadow><planeGeometry args={[21, 600]} /><meshStandardMaterial color="#334148" roughness={0.96} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, -200]} receiveShadow><planeGeometry args={[1800, 1600]} /><meshStandardMaterial color="#617b65" roughness={1} /></mesh>
    <instancedMesh ref={stripes} args={[undefined, undefined, 60]} frustumCulled={false}><planeGeometry args={[0.16, 5]} /><meshBasicMaterial color="#d5dad3" /></instancedMesh>
    <instancedMesh ref={markers} args={[undefined, undefined, 60]} frustumCulled={false}><boxGeometry args={[0.1, 0.4, 0.17]} /><meshStandardMaterial color="#ffe0aa" emissive="#ffb55a" emissiveIntensity={0.7} /></instancedMesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 7.4, 0.035, -180]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.14, 600]} /><meshBasicMaterial color="#f0dfa9" /></mesh>
      <mesh position={[side * 8.9, 0.6, -180]}><boxGeometry args={[0.14, 0.23, 600]} /><meshStandardMaterial color="#a0afb3" metalness={0.55} roughness={0.48} /></mesh>
      <mesh position={[side * 9.2, 0.24, -180]}><boxGeometry args={[0.32, 0.5, 600]} /><meshStandardMaterial color="#65767a" roughness={0.9} /></mesh>
    </group>)}
  </>;
}

function SceneryAsset({ path, height }) {
  const { scene } = useGLTF(path);
  const { model, scale, offset } = useMemo(() => {
    const model = scene.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const scale = height / Math.max(box.max.y - box.min.y, 0.1);
    return { model, scale, offset: [-center.x * scale, -box.min.y * scale, -center.z * scale] };
  }, [scene, height]);
  return <primitive object={model} scale={scale} position={offset} dispose={null} />;
}

function Roadside({ low }) {
  const group = useRef();
  const buildings = useMemo(() => Array.from({ length: low ? 20 : 32 }, (_, index) => {
    const side = index % 2 ? 1 : -1;
    const row = Math.floor(index / 2);
    const city = row % 8 < 4;
    return { side, z: -row * 40, x: side * (25 + row % 3 * 8), height: city ? 10 + row % 4 * 4 : 8 + row % 3 * 2,
      path: city ? `${CITY}building_${['A', 'C', 'F', 'G'][row % 4]}.gltf` : row % 3 === 0 ? '/models/Farm-buildings/Barn.glb' : '/models/Nature-pack/Pine_Trees.glb' };
  }), [low]);
  useFrame(() => {
    if (!group.current) return;
    const distance = useGameStore.getState().totalDistance * 5;
    const span = buildings.length / 2 * 40;
    group.current.children.forEach((object, index) => { object.position.z = 45 - ((45 - buildings[index].z + span - distance % span) % span); });
  });
  return <group ref={group}>{buildings.map((item, index) => <group key={index} position={[item.x, 0, item.z]} rotation={[0, item.side > 0 ? Math.PI : 0, 0]}>
    <Suspense fallback={null}><SceneryAsset path={item.path} height={item.height} /></Suspense>
  </group>)}</group>;
}

function Horizon() {
  return <group>{Array.from({ length: 14 }, (_, index) => <mesh key={index} position={[(index - 7) * 68, -13, -440 - index % 3 * 25]} rotation={[0, index * 0.7, 0]}>
    <coneGeometry args={[70 + index % 3 * 18, 70 + index % 4 * 22, 5]} /><meshStandardMaterial color={index % 2 ? '#6e8790' : '#82969b'} roughness={1} />
  </mesh>)}</group>;
}

function VergeTrees({ low }) {
  const crowns = useRef();
  const trunks = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const count = low ? 48 : 88;
  useFrame(() => {
    if (!crowns.current || !trunks.current) return;
    const distance = useGameStore.getState().totalDistance * 5;
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      const row = Math.floor(i / 2);
      const height = 3.5 + (row * 7 % 5) * 0.6;
      const x = side * (13.5 + row % 3 * 2.6);
      const z = 30 - ((row * 17 + count / 2 * 17 - distance % (count / 2 * 17)) % (count / 2 * 17));
      dummy.position.set(x, height * 0.7, z); dummy.scale.set(height * 0.28, height * 0.55, height * 0.28);
      dummy.rotation.set(0, row * 1.7, 0); dummy.updateMatrix(); crowns.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, height * 0.24, z); dummy.scale.set(0.13, height * 0.5, 0.13);
      dummy.updateMatrix(); trunks.current.setMatrixAt(i, dummy.matrix);
    }
    crowns.current.instanceMatrix.needsUpdate = true;
    trunks.current.instanceMatrix.needsUpdate = true;
  });
  return <>
    <instancedMesh ref={crowns} args={[undefined, undefined, count]} frustumCulled={false}><coneGeometry args={[1, 2, 7]} /><meshStandardMaterial color="#35645b" roughness={1} /></instancedMesh>
    <instancedMesh ref={trunks} args={[undefined, undefined, count]} frustumCulled={false}><cylinderGeometry args={[1, 1.3, 1, 5]} /><meshStandardMaterial color="#665f4e" roughness={1} /></instancedMesh>
  </>;
}

function StreetLamps() {
  const group = useRef();
  useFrame(() => {
    if (!group.current) return;
    const distance = useGameStore.getState().totalDistance * 5;
    group.current.children.forEach((lamp, i) => { lamp.position.z = 30 - ((Math.floor(i / 2) * 65 + 520 - distance % 520) % 520); });
  });
  return <group ref={group}>{Array.from({ length: 16 }, (_, i) => {
    const side = i % 2 ? 1 : -1;
    return <group key={i} position={[side * 10.1, 0, -Math.floor(i / 2) * 65]}>
      <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.075, 0.11, 8, 6]} /><meshStandardMaterial color="#36464f" metalness={0.5} roughness={0.5} /></mesh>
      <mesh position={[-side * 0.8, 7.95, 0]}><boxGeometry args={[1.75, 0.11, 0.13]} /><meshStandardMaterial color="#36464f" /></mesh>
      <mesh position={[-side * 1.5, 7.84, 0]}><boxGeometry args={[0.8, 0.08, 0.36]} /><meshBasicMaterial color="#ffdea0" toneMapped={false} /></mesh>
    </group>;
  })}</group>;
}

function FeedbackParticles() {
  const mesh = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    if (!mesh.current) return;
    const particles = useGameStore.getState().particles;
    for (let i = 0; i < 70; i++) {
      const p = particles[i];
      if (p) {
        dummy.position.set(p.x, p.y, p.z); dummy.scale.setScalar(Math.max(0, p.life) * (p.size || 0.15));
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
  // Essential model readiness gates simulation; scenery/traffic load independently.
  useGLTF(PLAYER_MODEL);
  const ready = useRef(false);
  const samples = useRef({ time: 0, frames: 0, reduced: false });
  useEffect(() => {
    for (const model of Object.values(TRAFFIC_MODELS)) useGLTF.preload(model.path);
  }, []);
  useFrame((_, delta) => {
    if (!ready.current) { ready.current = true; onReady(); }
    useGameStore.getState().updateGame(delta);
    if (adaptive && !samples.current.reduced && useGameStore.getState().gameState === 'playing') {
      samples.current.time += delta; samples.current.frames++;
      if (samples.current.time >= 5) {
        if (samples.current.frames / samples.current.time < 42) { samples.current.reduced = true; onReduceQuality(); }
        samples.current.time = 0; samples.current.frames = 0;
      }
    }
  }, -1);
  return <>
    <RaceLighting low={low} /><ChaseCamera /><Road /><Horizon /><StreetLamps /><Roadside low={low} /><VergeTrees low={low} />
    <PlayerCar /><Traffic /><Pickups /><FeedbackParticles />
  </>;
}
