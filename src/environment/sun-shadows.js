import { ShaderChunk, Vector3 } from 'three';
import { CSM } from 'three/addons/csm/CSM.js';

export const SUN_SHADOW_PROFILES = Object.freeze({
  performance: Object.freeze({ cascades: 2, mapSize: 1024, maxFar: 320, blendDistance: 8, splits: Object.freeze([32]) }),
  high: Object.freeze({ cascades: 3, mapSize: 1536, maxFar: 360, blendDistance: 8, splits: Object.freeze([32, 110]) }),
});

const supportsSunShadow = material => material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial
  || material?.isMeshLambertMaterial || material?.isMeshPhongMaterial || material?.isMeshToonMaterial;

/** One sun with overlapping depth ranges, rather than a light per vehicle. */
export function createRaceSunShadows({ scene, camera, low = false, assets = [] }) {
  const profile = low ? SUN_SHADOW_PROFILES.performance : SUN_SHADOW_PROFILES.high;
  const previousChunks = { lights_fragment_begin: ShaderChunk.lights_fragment_begin, lights_pars_begin: ShaderChunk.lights_pars_begin };
  const originals = new Map();
  const csm = new CSM({
    camera, parent: scene, cascades: profile.cascades, shadowMapSize: profile.mapSize,
    maxFar: profile.maxFar, mode: 'custom', lightNear: 1, lightFar: 850, lightMargin: 160,
    shadowBias: -0.00001, lightIntensity: 2.65, lightDirection: new Vector3(82, -145, 460).normalize(),
    customSplitsCallback: (_count, near, far, target) => {
      for (let index = 0; index < profile.splits.length; index++) {
        const split = Math.min(profile.splits[index], far * (index + 1) / profile.cascades);
        target.push(Math.max(near, split) / far);
      }
      target.push(1);
    },
  });
  csm.fade = true;
  // The addon's quadratic fade is less than one world unit at the first
  // split. Give approaching vehicles eight units to blend into the sharper
  // map, while preserving the longer built-in fade at the distant horizon.
  ShaderChunk.lights_fragment_begin = ShaderChunk.lights_fragment_begin.replace(
    'margin = 0.25 * pow( closestEdge, 2.0 );',
    `margin = max( ${profile.blendDistance.toFixed(1)} / ( shadowFar - cameraNear ), 0.25 * pow( closestEdge, 2.0 ) );`,
  );
  const updateFrustums = () => {
    csm.updateFrustums();
    // Both maps must contain the overlapping receivers, including oblique
    // sun angles and the screen corners just beyond their nominal split.
    for (const light of csm.lights) {
      const shadowCamera = light.shadow.camera;
      shadowCamera.left -= profile.blendDistance; shadowCamera.right += profile.blendDistance;
      shadowCamera.bottom -= profile.blendDistance; shadowCamera.top += profile.blendDistance;
      shadowCamera.updateProjectionMatrix();
    }
  };
  updateFrustums();
  const injectedChunks = { lights_fragment_begin: ShaderChunk.lights_fragment_begin, lights_pars_begin: ShaderChunk.lights_pars_begin };
  csm.lights.forEach((light, index) => {
    light.name = `race-sun-cascade-${index + 1}`;
    light.shadow.normalBias = 0.015 + index * 0.01;
    light.shadow.radius = 2;
  });
  const syncCascadeMetadata = () => {
    const far = Math.min(camera.far, profile.maxFar);
    csm.lights.forEach((light, index) => {
      Object.assign(light.userData, { shadowProfile: low ? 'performance' : 'high', cascade: index + 1,
        cascadeNear: index ? csm.breaks[index - 1] * far : camera.near, cascadeFar: csm.breaks[index] * far,
        cascadeFade: true, cascadeBlendDistance: profile.blendDistance, sunShadowMaxFar: far, shadowMapSize: profile.mapSize });
    });
  };
  syncCascadeMetadata();

  const prepareMaterials = root => {
    root.traverse(object => {
      if (!object.isMesh) return;
      for (const material of [object.material].flat()) {
        if (!supportsSunShadow(material) || originals.has(material)) continue;
        const previous = { hook: material.onBeforeCompile, defines: material.defines,
          defineValues: material.defines ? { ...material.defines } : undefined,
          cacheKey: material.customProgramCacheKey, cacheValue: material.customProgramCacheKey() };
        originals.set(material, previous);
        csm.setupMaterial(material);
        const csmHook = material.onBeforeCompile;
        // Keep any model or road shader customization in the same program.
        material.onBeforeCompile = function (shader, renderer) {
          previous.hook.call(this, shader, renderer);
          csmHook.call(this, shader, renderer);
        };
        material.customProgramCacheKey = () => `${previous.cacheValue}|race-csm:${profile.cascades}:fade:${profile.blendDistance}`;
        material.needsUpdate = true;
      }
    });
  };
  prepareMaterials(scene);
  for (const asset of assets) prepareMaterials(asset.scene || asset);
  let previousFov = camera.fov, previousAspect = camera.aspect, previousNear = camera.near, previousFar = camera.far;
  let disposed = false;

  return {
    profile,
    lights: csm.lights,
    prepareMaterials,
    update(direction, color, intensity) {
      if (disposed) return;
      // Future pickups, equipment and freshly mounted NPCs join the existing
      // variant once. This does not recompile materials already prepared.
      prepareMaterials(scene);
      csm.lightDirection.copy(direction);
      for (const light of csm.lights) { light.color.copy(color); light.intensity = intensity; }
      if (camera.fov !== previousFov || camera.aspect !== previousAspect || camera.near !== previousNear || camera.far !== previousFar) {
        updateFrustums();
        syncCascadeMetadata();
        previousFov = camera.fov; previousAspect = camera.aspect; previousNear = camera.near; previousFar = camera.far;
      }
      camera.updateMatrixWorld();
      csm.update();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      csm.remove();
      csm.dispose();
      for (const light of csm.lights) light.shadow.dispose();
      for (const [material, previous] of originals) {
        material.onBeforeCompile = previous.hook;
        material.customProgramCacheKey = previous.cacheKey;
        if (previous.defines) { Object.assign(previous.defines, previous.defineValues); material.defines = previous.defines; }
        else delete material.defines;
        material.needsUpdate = true;
      }
      originals.clear();
      for (const key of Object.keys(previousChunks)) {
        if (ShaderChunk[key] === injectedChunks[key]) ShaderChunk[key] = previousChunks[key];
      }
    },
  };
}
