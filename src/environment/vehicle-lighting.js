import * as THREE from 'three';

// NPC headlights share simple surfaces instead of adding two dynamic lights
// for every car. The feathered road footprint stays attached to each vehicle.
const BEAM_VERTEX = `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const BEAM_FRAGMENT = `
  varying vec2 vUv;
  uniform float lightStrength;
  #include <fog_pars_fragment>
  void main() {
    float spread = mix(0.12, 0.5, vUv.y);
    float lateral = 1.0 - smoothstep(spread * 0.45, spread, abs(vUv.x - 0.5));
    float longitudinal = smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y));
    float alpha = lateral * longitudinal * 0.16 * lightStrength;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        alpha *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        alpha *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
      #endif
    #endif
    gl_FragColor = vec4(0.64, 0.78, 1.0, alpha);
    #include <colorspace_fragment>
  }
`;

export function createTrafficBeamMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: BEAM_VERTEX, fragmentShader: BEAM_FRAGMENT,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { lightStrength: { value: 0 } }]),
    fog: true, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, toneMapped: false,
  });
}
