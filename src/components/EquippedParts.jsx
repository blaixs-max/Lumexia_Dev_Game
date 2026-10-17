import { memo, useEffect, useMemo } from 'react';
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, TorusGeometry } from 'three';

// Anchors use the displayed vehicle bounds, after its source-model rotation.
// This keeps the sedan's hood and each sports car's rear deck clear of glass.
const MOUNTS = {
  default: { engineY: 0.76, engineZ: 0.19, nitroY: 0.72, nitroZ: 0.34, axleZ: 0.31 },
  gt: { engineY: 0.68, engineZ: -0.28, nitroY: 0.72, nitroZ: 0.35, axleZ: 0.30 },
  apex: { engineY: 0.84, engineZ: 0.20, nitroY: 0.80, nitroZ: 0.35, axleZ: 0.30 },
};
const STAGES = [0, 1, 2];
const SIDES = [-1, 1];
const fittedLevel = value => Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 0;

/** Small real-time meshes; equipment-card illustrations are separate assets. */
const EquippedParts = memo(function EquippedParts({ carId = 'default', levels = {}, width = 1.8, length = 5.5, height = 1 }) {
  const engine = fittedLevel(levels.engine);
  const handling = fittedLevel(levels.handling);
  const nitro = fittedLevel(levels.nitro);
  const mount = MOUNTS[carId] || MOUNTS.default;
  const resources = useMemo(() => ({
    box: new BoxGeometry(1, 1, 1),
    cylinder: new CylinderGeometry(1, 1, 1, 10),
    ring: new TorusGeometry(1, 0.09, 5, 12),
    graphite: new MeshStandardMaterial({ color: '#18262c', metalness: 0.72, roughness: 0.35 }),
    metal: new MeshStandardMaterial({ color: '#a7bdc6', metalness: 0.85, roughness: 0.26 }),
    lime: new MeshStandardMaterial({ color: '#dfff72', emissive: '#b5df3d', emissiveIntensity: 0.15, metalness: 0.45, roughness: 0.35 }),
    cyan: new MeshStandardMaterial({ color: '#78d9ed', emissive: '#3daabd', emissiveIntensity: 0.12, metalness: 0.6, roughness: 0.3 }),
  }), []);
  useEffect(() => () => Object.values(resources).forEach(resource => resource.dispose()), [resources]);

  if (!engine && !handling && !nitro) return null;
  const unit = width / 1.8;
  const bottleRadius = 0.09 * unit;
  const bottleLength = length * 0.14;
  const wheelRadius = height * 0.18;

  return <group name="installed-equipment" dispose={null}>
    {engine > 0 ? <group name={`engine-stage-${engine}`} position={[0, height * mount.engineY, length * mount.engineZ]}>
      <mesh geometry={resources.box} material={resources.graphite} position={[0, -height * 0.045, 0]} scale={[width * 0.39, height * 0.19, length * 0.12]} castShadow />
      <mesh geometry={resources.box} material={resources.metal} position={[0, 0.07 * unit, 0]} scale={[width * 0.31, 0.07 * unit, length * 0.09]} castShadow />
      <mesh geometry={resources.box} material={resources.graphite} position={[0, 0.105 * unit, -length * 0.035]} scale={[width * 0.24, 0.065 * unit, length * 0.035]} />
      {STAGES.filter(index => index < engine).map(index => <mesh key={index} geometry={resources.box} material={resources.lime} position={[(index - (engine - 1) / 2) * width * 0.075, 0.111 * unit, length * 0.012]} scale={[width * 0.032, 0.018 * unit, length * 0.055]} />)}
      {engine >= 2 ? SIDES.map(side => <mesh key={side} geometry={resources.cylinder} material={resources.metal} rotation={[Math.PI / 2, 0, 0]} position={[side * width * 0.19, 0, length * 0.015]} scale={[0.045 * unit, length * 0.13, 0.045 * unit]} castShadow />) : null}
    </group> : null}

    {handling > 0 ? <group name={`handling-stage-${handling}`}>
      {SIDES.flatMap(side => SIDES.map(axle => <group key={`${side}-${axle}`} position={[side * width * 0.46, height * 0.23, axle * length * mount.axleZ]}>
        <mesh geometry={resources.ring} material={resources.metal} rotation={[0, Math.PI / 2, 0]} scale={wheelRadius} />
        <mesh geometry={resources.box} material={resources.cyan} position={[side * 0.007, wheelRadius * 0.3, wheelRadius * 0.7]} scale={[0.035 * unit, wheelRadius * (0.65 + handling * 0.12), wheelRadius * 0.38]} />
      </group>))}
      {handling >= 2 ? SIDES.map(side => <group key={side} position={[side * width * 0.48, height * 0.14, 0]}>
        <mesh geometry={resources.box} material={resources.graphite} scale={[0.055 * unit, 0.07 * unit, length * 0.36]} castShadow />
        <mesh geometry={resources.box} material={resources.cyan} position={[side * 0.03 * unit, 0, 0]} scale={[0.015 * unit, 0.018 * unit, length * (handling === 3 ? 0.31 : 0.16)]} />
      </group>) : null}
    </group> : null}

    {nitro > 0 ? <group name={`nitro-stage-${nitro}`} position={[0, height * mount.nitroY + bottleRadius, length * mount.nitroZ]}>
      <mesh geometry={resources.box} material={resources.graphite} position={[0, -bottleRadius * 0.95 - height * 0.04, 0]} scale={[width * 0.49, height * 0.15, bottleLength * 0.8]} castShadow />
      {SIDES.map(side => <group key={side} position={[side * width * 0.15, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={resources.cylinder} material={resources.cyan} scale={[bottleRadius, bottleLength, bottleRadius]} castShadow />
        {SIDES.map(end => <mesh key={end} geometry={resources.cylinder} material={resources.metal} position={[0, end * bottleLength * 0.4, 0]} scale={[bottleRadius * 1.07, 0.045 * unit, bottleRadius * 1.07]} />)}
        <mesh geometry={resources.cylinder} material={resources.graphite} position={[0, bottleLength * 0.57, 0]} scale={[bottleRadius * 0.38, bottleLength * 0.16, bottleRadius * 0.38]} />
        {STAGES.filter(index => index < nitro).map(index => <mesh key={index} geometry={resources.cylinder} material={resources.lime} position={[0, (index - (nitro - 1) / 2) * bottleLength * 0.16, 0]} scale={[bottleRadius * 1.018, bottleLength * 0.055, bottleRadius * 1.018]} />)}
      </group>)}
    </group> : null}
  </group>;
});

export default EquippedParts;
