import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_SPAN } from '../environment/landscape';
import { placementMatrix, placedBounds, wrapWorldZ } from '../environment/visibility';

const POOL_WIDTH = 14;
const POOL_LENGTH = 22;
const POOL_HEIGHT = 0.068;

function lightMaterial(halo) {
  return new THREE.ShaderMaterial({
    name: halo ? 'streetlamp-soft-lens-halo' : 'streetlamp-warm-ground-pool',
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      lightColor: { value: new THREE.Color(halo ? '#ffe9c5' : '#ffd7a3') },
      opacity: { value: halo ? 0.30 : 0.17 },
    }]),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: true,
    vertexShader: `
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vLightUv;
      void main() {
        vLightUv = uv * 2.0 - 1.0;
        ${halo ? `
          vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float instanceScale = length(instanceMatrix[0].xyz);
          vec4 mvPosition = center + vec4(position.xy * 1.25 * instanceScale, 0.0, 0.0);
        ` : `
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        `}
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 lightColor;
      uniform float opacity;
      varying vec2 vLightUv;
      void main() {
        float radiusSquared = dot(vLightUv, vLightUv);
        float feather = 1.0 - smoothstep(0.45, 1.0, radiusSquared);
        float alpha = exp(-radiusSquared * ${halo ? '4.2' : '2.1'}) * feather * opacity;
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            alpha *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            alpha *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
          #endif
        #endif
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(lightColor, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
}

function upload(mesh, count) {
  mesh.count = count;
  mesh.visible = count > 0;
  mesh.userData.visibleInstances = count;
  if (!count) return;
  mesh.instanceMatrix.clearUpdateRanges();
  mesh.instanceMatrix.addUpdateRange(0, count * 16);
  mesh.instanceMatrix.needsUpdate = true;
}

// Two shared draws for the whole street. These local light impressions do not
// add renderer lights, shadow passes, animated opacity, textures or postprocess.
export default function StreetLighting({ model, placements, visibility }) {
  const pools = useRef(), halos = useRef();
  const previous = useRef({ version: -1, prepared: null });
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const resources = useMemo(() => ({
    geometry: new THREE.PlaneGeometry(1, 1),
    pool: lightMaterial(false),
    halo: lightMaterial(true),
  }), []);
  const prepared = useMemo(() => {
    model.updateMatrixWorld(true);
    // Read the finished model instead of duplicating its cantilever offset.
    const lens = model.getObjectByName('lamp-led-lens');
    if (!lens) return [];
    const center = new THREE.Box3().setFromObject(lens).getCenter(new THREE.Vector3());
    const poolBounds = new THREE.Box3(
      new THREE.Vector3(center.x - POOL_WIDTH / 2, POOL_HEIGHT, center.z - POOL_LENGTH / 2),
      new THREE.Vector3(center.x + POOL_WIDTH / 2, POOL_HEIGHT, center.z + POOL_LENGTH / 2),
    );
    // The whole fixture and its spill share a conservative visibility volume.
    const sphere = new THREE.Box3().setFromObject(model).union(poolBounds)
      .expandByScalar(0.65).getBoundingSphere(new THREE.Sphere());
    const pool = new THREE.Matrix4().compose(
      new THREE.Vector3(center.x, POOL_HEIGHT, center.z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2),
      new THREE.Vector3(POOL_WIDTH, POOL_LENGTH, 1),
    );
    const halo = new THREE.Matrix4().makeTranslation(center.x, center.y - 0.025, center.z);
    return placements.map(item => {
      const base = placementMatrix(item);
      return { z: item.z, bounds: placedBounds(sphere, base),
        pool: new THREE.Matrix4().multiplyMatrices(base, pool),
        halo: new THREE.Matrix4().multiplyMatrices(base, halo) };
    });
  }, [model, placements]);
  useEffect(() => () => {
    resources.geometry.dispose(); resources.pool.dispose(); resources.halo.dispose();
  }, [resources]);
  useFrame(() => {
    if (!pools.current || !halos.current || (previous.current.version === visibility.version && previous.current.prepared === prepared)) return;
    let count = 0;
    for (const item of prepared) {
      const z = wrapWorldZ(item.z, visibility.distance, WORLD_SPAN);
      if (!visibility.visible(item.bounds, z)) continue;
      matrix.copy(item.pool); matrix.setPosition(matrix.elements[12], matrix.elements[13], matrix.elements[14] + z);
      pools.current.setMatrixAt(count, matrix);
      matrix.copy(item.halo); matrix.setPosition(matrix.elements[12], matrix.elements[13], matrix.elements[14] + z);
      halos.current.setMatrixAt(count, matrix);
      count++;
    }
    upload(pools.current, count); upload(halos.current, count);
    previous.current.version = visibility.version;
    previous.current.prepared = prepared;
  });
  const setup = (ref, mesh) => {
    ref.current = mesh;
    if (mesh) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.userData.instanceCapacity = placements.length;
      mesh.count = 0;
      previous.current.version = -1;
    }
  };
  return <>
    <instancedMesh ref={mesh => setup(pools, mesh)} args={[resources.geometry, resources.pool, placements.length]} frustumCulled={false} renderOrder={2} dispose={null} />
    <instancedMesh ref={mesh => setup(halos, mesh)} args={[resources.geometry, resources.halo, placements.length]} frustumCulled={false} renderOrder={3} dispose={null} />
  </>;
}
