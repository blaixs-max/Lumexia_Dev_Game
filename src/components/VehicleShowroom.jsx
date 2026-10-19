import { Component, Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { usePageVisible } from '../hooks/usePageVisible';
import { useGameStore } from '../store';
import { getCar } from '../utils/garage';
import EquippedParts from './EquippedParts';

useGLTF.setDecoderPath('/draco/');

class ShowroomBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="lx-showroom-fallback" role="status">Araç önizlemesi yüklenemedi</div> : this.props.children; }
}

function ShowroomCar({ car, levels, stationary = false }) {
  const { scene } = useGLTF(car.preview);
  const group = useRef();
  const angle = (car.showroomRotation || 0) - .4;
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const prepared = useMemo(() => {
    const model = scene.clone(true);
    model.traverse(node => { if (node.isMesh) node.layers.enable(1); });
    const bounds = new Box3().setFromObject(model), size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
    const scale = Math.min(5.2 / Math.max(size.x, size.z, 1), 1.65 / Math.max(size.y, .01));
    return { model, scale, position: [-center.x * scale, -bounds.min.y * scale, -center.z * scale],
      dimensions: { width: size.x * scale, length: size.z * scale, height: size.y * scale } };
  }, [scene]);
  useFrame(({ clock }) => {
    if (group.current && !reducedMotion && !stationary) group.current.rotation.y = angle + Math.sin(clock.elapsedTime * .18) * .12;
  });
  return <group ref={group} rotation={[0, angle, 0]}><group rotation={[0, car.rotation, 0]}><primitive object={prepared.model} scale={prepared.scale} position={prepared.position} dispose={null} /></group><EquippedParts carId={car.id} levels={levels} {...prepared.dimensions} /></group>;
}

function VehicleContactShadows({ workshop }) {
  const shadow = useRef();
  useLayoutEffect(() => {
    // Capture the vehicle only; workshop walls must not become a large floor shadow.
    shadow.current?.traverse(node => { if (node.isCamera) node.layers.set(1); });
  }, []);
  return <ContactShadows ref={shadow} position={[0, -.015, 0]} opacity={workshop ? .45 : .65} scale={8} blur={2.6} far={4} resolution={256} frames={1} color="#000000" />;
}

function WorkshopRoom() {
  return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.04, 0]} receiveShadow>
      <planeGeometry args={[30, 30]} /><meshStandardMaterial color="#655f52" roughness={.88} metalness={.08} />
    </mesh>
    <mesh position={[0, 3, -5.4]}><boxGeometry args={[22, 6, .2]} /><meshStandardMaterial color="#696052" roughness={.9} /></mesh>
    <mesh position={[0, 2.45, -5.23]}><boxGeometry args={[8.8, 4.9, .16]} /><meshStandardMaterial color="#282a27" roughness={.85} /></mesh>
    {Array.from({ length: 18 }, (_, index) => <mesh key={index} position={[0, .16 + index * .26, -5.1]}>
      <boxGeometry args={[8.4, .235, .1]} /><meshStandardMaterial color={index % 2 ? '#48483f' : '#4e4c42'} roughness={.62} metalness={.32} />
    </mesh>)}
    {[-4.45, 4.45].map(x => <group key={x} position={[x, 0, -4.95]}>
      <mesh position={[0, 2.5, 0]}><boxGeometry args={[.2, 5.1, .3]} /><meshStandardMaterial color="#292b29" metalness={.5} roughness={.55} /></mesh>
      <mesh position={[0, .55, .75]}><cylinderGeometry args={[.13, .16, 1.1, 12]} /><meshStandardMaterial color="#c8ac5e" metalness={.3} roughness={.65} /></mesh>
      <mesh position={[0, .64, .75]}><cylinderGeometry args={[.135, .135, .2, 12]} /><meshStandardMaterial color="#2b2e29" roughness={.7} /></mesh>
    </group>)}
    <mesh position={[0, 5.05, -5.02]}><boxGeometry args={[11, .24, .36]} /><meshStandardMaterial color="#323630" roughness={.55} metalness={.5} /></mesh>
    <mesh position={[0, 4.65, -4.7]}><boxGeometry args={[4.2, .08, .16]} /><meshStandardMaterial color="#fff1c9" emissive="#fff1c9" emissiveIntensity={2} /></mesh>
    <pointLight position={[0, 3.5, -3]} color="#ffe4b4" intensity={22} distance={12} decay={2} />
    <mesh position={[-6.7, 1, -4.6]}><boxGeometry args={[1.8, 2, 1]} /><meshStandardMaterial color="#3c4640" roughness={.8} metalness={.3} /></mesh>
    <mesh position={[-6.7, 1.02, -4.08]}><boxGeometry args={[.025, 1.85, .02]} /><meshStandardMaterial color="#202720" roughness={.7} /></mesh>
    {[-2.9, 2.9].map(x => <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, -.026, .2]}>
      <planeGeometry args={[.045, 6.4]} /><meshStandardMaterial color="#b8a76e" roughness={1} transparent opacity={.6} />
    </mesh>)}
  </group>;
}

function WorkshopFraming() {
  const { width, height } = useThree(state => state.size);
  // Wide desktop bays need a closer view; preserve the existing phone framing.
  const zoom = Math.min(1.75, Math.max(1, width / Math.max(height, 1) / 1.8));
  return <PerspectiveCamera makeDefault position={[6.4, 2.8, 7.3]} fov={33} zoom={zoom} />;
}

export default function VehicleShowroom({ carId, quality = 'auto', interactive = false, variant = 'default' }) {
  const visible = usePageVisible();
  const upgrades = useGameStore(s => s.garageUpgrades);
  const car = getCar(carId);
  const workshop = variant === 'workshop';
  return <div className={`lx-showroom${workshop ? ' lx-showroom--workshop' : ''}`} role="img" aria-label={`${car.name} 3D önizlemesi${interactive ? ', döndürmek için sürükle' : ''}`}>
    {!workshop ? <div className="lx-showroom-grid" aria-hidden="true" /> : null}
    <ShowroomBoundary key={car.id}>
      <Canvas frameloop={visible ? 'always' : 'never'} camera={{ position: workshop ? [6.4, 2.8, 7.3] : [6, 3, 7], fov: workshop ? 33 : 34 }} dpr={quality === 'performance' ? 1 : [1, 1.5]} gl={{ alpha: true, antialias: true }}>
        {workshop ? <><color attach="background" args={['#615b4e']} /><fog attach="fog" args={['#615b4e', 16, 34]} /><WorkshopRoom /><WorkshopFraming /></> : null}
        <ambientLight intensity={workshop ? 1.25 : 1.7} />
        <directionalLight position={[4, 7, 5]} intensity={workshop ? 3 : 4} color="#fff1d3" />
        <directionalLight position={[-4, 3, -4]} intensity={workshop ? 1.3 : 3} color={workshop ? '#d9e3de' : '#a6d3dd'} />
        {!workshop ? <pointLight position={[0, 2, -3]} intensity={18} color="#defb7b" /> : null}
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={3} position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[7, 5, 1]} color="#fff5e6" />
          <Lightformer form="rect" intensity={2} position={[-5, 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 2, 1]} color="#cfdfed" />
          <Lightformer form="rect" intensity={2} position={[5, 2, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 2, 1]} color="#ffffff" />
        </Environment>
        <Suspense fallback={null}>
          <ShowroomCar car={car} levels={upgrades[car.id]} stationary={workshop && interactive} />
          {quality !== 'performance' ? <VehicleContactShadows workshop={workshop} /> : null}
        </Suspense>
        {!workshop ? <><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.04, 0]}><circleGeometry args={[3.35, 64]} /><meshStandardMaterial color="#1a2023" metalness={.6} roughness={.45} /></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.025, 0]}><ringGeometry args={[3.25, 3.28, 64]} /><meshBasicMaterial color="#defb7b" transparent opacity={.5} /></mesh></> : null}
        {interactive ? <OrbitControls enableZoom={false} enablePan={false} target={[0, workshop ? .65 : .5, 0]} minPolarAngle={workshop ? .9 : .6} maxPolarAngle={1.45} minAzimuthAngle={workshop ? -.75 : -Infinity} maxAzimuthAngle={workshop ? 1.35 : Infinity} /> : null}
      </Canvas>
    </ShowroomBoundary>
    {!workshop ? <div className="lx-car-caption"><span><i /> {car.name}</span><span>{interactive ? 'Döndürmek için sürükle' : car.classLabel}</span></div> : null}
  </div>;
}
