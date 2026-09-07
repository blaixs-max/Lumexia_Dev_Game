import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MOON_POSITION = [82, 85, -460];
const MOON_ROTATION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(...MOON_POSITION).normalize().negate(),
);

const skyVertex = /* glsl */`
  varying vec3 vDirection;
  void main() {
    vDirection = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skyFragment = /* glsl */`
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uLowerSky;
  varying vec3 vDirection;
  void main() {
    float elevation = normalize(vDirection).y;
    vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, elevation));
    sky = mix(sky, uLowerSky, smoothstep(0.0, 0.32, -elevation));
    gl_FragColor = vec4(sky, 1.0);
    #include <colorspace_fragment>
  }
`;

const starVertex = /* glsl */`
  uniform float uPixelRatio;
  attribute float aSize;
  attribute vec3 aTint;
  varying vec3 vTint;
  void main() {
    vTint = aTint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uPixelRatio);
  }
`;

const starFragment = /* glsl */`
  varying vec3 vTint;
  void main() {
    float radius = length(gl_PointCoord - 0.5) * 2.0;
    float alpha = 1.0 - smoothstep(0.12, 1.0, radius);
    if (alpha < 0.015) discard;
    gl_FragColor = vec4(vTint, alpha);
    #include <colorspace_fragment>
  }
`;

const moonVertex = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const moonFragment = /* glsl */`
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), f.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), f.x), f.y);
  }
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float radius = length(p);
    float edge = max(fwidth(radius), 0.001);
    float disc = 1.0 - smoothstep(0.44 - edge, 0.44 + edge, radius);
    float halo = exp(-radius * radius * 7.0) * 0.14;
    float alpha = disc + halo * (1.0 - disc);
    if (alpha < 0.001) discard;

    vec3 color = vec3(0.18, 0.28, 0.46);
    if (disc > 0.0) {
      vec2 surface = p / 0.44;
      vec3 normal = vec3(surface, sqrt(max(0.0, 1.0 - dot(surface, surface))));
      float light = 0.13 + 0.87 * max(dot(normal, normalize(vec3(-0.48, 0.28, 1.0))), 0.0);
      float seas = noise(surface * 3.6 + vec2(7.3, 2.1)) * 0.68
        + noise(surface * 7.5 + vec2(3.1, 9.7)) * 0.32;
      float relief = 0.0;
      for (int i = 0; i < 10; i++) {
        float seed = float(i);
        vec2 center = vec2(hash(vec2(seed, 4.2)), hash(vec2(seed, 8.7))) * 1.45 - 0.725;
        float craterRadius = 0.055 + hash(vec2(seed, 1.3)) * 0.13;
        float d = length(surface - center) / craterRadius;
        float bowl = 1.0 - smoothstep(0.0, 0.85, d);
        float rim = exp(-pow((d - 0.92) * 9.0, 2.0));
        relief += rim * 0.075 - bowl * 0.09;
      }
      float mineral = 0.96 - smoothstep(0.34, 0.68, seas) * 0.30 + relief;
      mineral += (noise(surface * 34.0) - 0.5) * 0.035;
      vec3 rock = vec3(0.79, 0.83, 0.86) * mineral * light;
      color = mix(color, rock, disc);
    }
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`;

function createStars() {
  const count = 1200;
  const positions = new Float32Array(count * 3);
  const tints = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  let seed = 71938;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < count; index++) {
    const elevation = 0.035 + random() * 0.965;
    const angle = random() * Math.PI * 2;
    const ring = Math.sqrt(1 - elevation * elevation);
    positions.set([Math.cos(angle) * ring * 620, elevation * 620, Math.sin(angle) * ring * 620], index * 3);
    const haze = THREE.MathUtils.smoothstep(elevation, 0.035, 0.22);
    const brightness = (0.25 + random() * 0.68) * haze;
    const warm = random() > 0.82;
    tints.set(warm ? [brightness, brightness * 0.86, brightness * 0.70]
      : [brightness * 0.73, brightness * 0.86, brightness], index * 3);
    sizes[index] = 1.35 + random() ** 4 * 2.3;
  }
  return { positions, tints, sizes };
}

/** Three inexpensive draws: navy dome, fixed stars and a procedural moon. */
export default function NightSky() {
  const group = useRef();
  const starMaterial = useRef();
  const stars = useMemo(() => createStars(), []);
  const skyUniforms = useMemo(() => ({
    uHorizon: { value: new THREE.Color('#101b32') },
    uZenith: { value: new THREE.Color('#030711') },
    uLowerSky: { value: new THREE.Color('#0a1427') },
  }), []);
  const starUniforms = useMemo(() => ({ uPixelRatio: { value: 1 } }), []);

  // Follow translation after ChaseCamera (-0.75), keeping stars fixed in the
  // world. No animation, temporal noise, allocations or React state per frame.
  useFrame(({ camera, gl }) => {
    if (group.current) group.current.position.copy(camera.position);
    if (starMaterial.current) starMaterial.current.uniforms.uPixelRatio.value = gl.getPixelRatio();
  }, -0.5);

  return <group ref={group}>
    <mesh renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[650, 24, 12]} />
      <shaderMaterial vertexShader={skyVertex} fragmentShader={skyFragment} uniforms={skyUniforms}
        side={THREE.BackSide} depthWrite={false} depthTest={false} toneMapped={false} fog={false} />
    </mesh>
    <points renderOrder={-900} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[stars.positions, 3]} />
        <bufferAttribute attach="attributes-aTint" args={[stars.tints, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[stars.sizes, 1]} />
      </bufferGeometry>
      <shaderMaterial ref={starMaterial} vertexShader={starVertex} fragmentShader={starFragment} uniforms={starUniforms}
        transparent depthWrite={false} toneMapped={false} fog={false} />
    </points>
    <mesh position={MOON_POSITION} quaternion={MOON_ROTATION} renderOrder={-800}>
      <planeGeometry args={[76, 76]} />
      <shaderMaterial vertexShader={moonVertex} fragmentShader={moonFragment}
        transparent depthWrite={false} toneMapped={false} fog={false} />
    </mesh>
  </group>;
}
