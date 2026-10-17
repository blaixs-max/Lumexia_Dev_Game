import { memo, useEffect, useMemo } from 'react';
import { CylinderGeometry, ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three';

// Two beveled pole halves form an open horseshoe, rather than a flat badge.
function poleHalf() {
  const shape = new Shape();
  shape.moveTo(-0.84, 0.6);
  shape.lineTo(-0.84, -0.1);
  shape.bezierCurveTo(-0.84, -0.59, -0.48, -0.92, 0, -0.92);
  shape.lineTo(0, -0.48);
  shape.bezierCurveTo(-0.23, -0.48, -0.4, -0.3, -0.4, -0.1);
  shape.lineTo(-0.4, 0.6);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.055, bevelThickness: 0.055, curveSegments: 18 }).translate(0, 0, -0.14);
}

function poleCap() {
  const shape = new Shape();
  shape.moveTo(-0.22, 0);
  shape.lineTo(0.22, 0);
  shape.lineTo(0.22, 0.22);
  shape.lineTo(-0.22, 0.22);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: 0.29, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.035, bevelThickness: 0.035 }).translate(0, 0, -0.145);
}

const MagnetPickup = memo(function MagnetPickup() {
  const resources = useMemo(() => ({
    body: poleHalf(),
    cap: poleCap(),
    bolt: new CylinderGeometry(0.052, 0.052, 0.018, 8),
    red: new MeshStandardMaterial({ color: '#e63832', metalness: 0.52, roughness: 0.25, emissive: '#ae2920', emissiveIntensity: 0.38 }),
    blue: new MeshStandardMaterial({ color: '#217aca', metalness: 0.52, roughness: 0.25, emissive: '#126daf', emissiveIntensity: 0.42 }),
    chrome: new MeshStandardMaterial({ color: '#e4edf0', metalness: 0.85, roughness: 0.19, emissive: '#426d83', emissiveIntensity: 0.22 }),
    fastener: new MeshStandardMaterial({ color: '#233039', metalness: 0.75, roughness: 0.3 }),
  }), []);
  useEffect(() => () => Object.values(resources).forEach(resource => resource.dispose()), [resources]);

  return <group name="magnet-pickup-model" dispose={null} rotation={[-0.1, 0, 0]}>
    <mesh geometry={resources.body} material={resources.red} castShadow />
    <mesh geometry={resources.body} material={resources.blue} scale={[-1, 1, 1]} castShadow />
    {[-1, 1].map(side => <group key={side}>
      <mesh geometry={resources.cap} material={resources.chrome} position={[side * 0.62, 0.61, 0]} castShadow />
      <mesh geometry={resources.bolt} material={resources.fastener} position={[side * 0.62, 0.42, 0.201]} rotation={[Math.PI / 2, 0, 0]} />
    </group>)}
  </group>;
});

export default MagnetPickup;
