import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../store';
import { deformRoadGeometry } from '../environment/road-path';

const ORIGIN = [0, 0, 0];
const UNIT = [1, 1, 1];
const DEFAULT_ARGS = [1, 1];

/** Only the low-poly continuous road surfaces bend; cars and buildings stay rigid. */
export default function CurvedRoadMesh({ geometry, shape = 'plane', args = DEFAULT_ARGS,
  position = ORIGIN, rotation = ORIGIN, scale = UNIT, children, ...props }) {
  const previousDistance = useRef(NaN);
  const prepared = useMemo(() => {
    const result = geometry ? geometry.clone() : shape === 'box'
      ? new THREE.BoxGeometry(...args) : new THREE.PlaneGeometry(...args);
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    result.applyMatrix4(matrix);
    result.attributes.position.setUsage(THREE.DynamicDrawUsage);
    result.attributes.normal.setUsage(THREE.DynamicDrawUsage);
    return { geometry: result, positions: result.attributes.position.array.slice(), normals: result.attributes.normal.array.slice() };
  }, [geometry, shape, args, position, rotation, scale]);
  const previousGeometry = useRef();
  useEffect(() => () => prepared.geometry.dispose(), [prepared]);
  useFrame(() => {
    const distance = useGameStore.getState().totalDistance * 5;
    if (previousDistance.current === distance && previousGeometry.current === prepared) return;
    deformRoadGeometry(prepared.geometry, prepared.positions, prepared.normals, distance);
    previousDistance.current = distance;
    previousGeometry.current = prepared;
  });
  return <mesh {...props} geometry={prepared.geometry} frustumCulled={false}>{children}</mesh>;
}
