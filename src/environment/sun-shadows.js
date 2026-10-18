import { Matrix4, ShaderChunk, Vector3 } from 'three';
import { CSM } from 'three/addons/csm/CSM.js';

export const SUN_SHADOW_PROFILES = Object.freeze({
  performance: Object.freeze({ cascades: 2, mapSize: 1024, maxFar: 320, blendDistance: 8, splits: Object.freeze([32]) }),
  high: Object.freeze({ cascades: 3, mapSize: 1536, maxFar: 360, blendDistance: 8, splits: Object.freeze([32, 110]) }),
});

const supportsSunShadow = material => material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial
  || material?.isMeshLambertMaterial || material?.isMeshPhongMaterial || material?.isMeshToonMaterial;
const activeSystems = new WeakMap();
const NO_SUN_LIGHTS = Object.freeze([]);

export function getRaceSunShadowLights(scene) {
  return activeSystems.get(scene)?.lights || NO_SUN_LIGHTS;
}

/** Prepare a newly mounted model or material before a custom shader warmup. */
export function prepareRaceSunShadowMaterials(scene, rootOrMaterials) {
  const system = activeSystems.get(scene);
  if (!system) return false;
  system.prepareMaterials(rootOrMaterials);
  return true;
}

/** A spotlight outside its cone/range or at zero intensity adds no light. */
export function skipInactiveSpotlightBRDF(source) {
  const start = source.indexOf('#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )');
  const end = source.indexOf('#if ( NUM_DIR_LIGHTS > 0 )', start);
  if (start === -1 || end === -1) return source;
  const section = source.slice(start, end);
  const call = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  if (section.split(call).length !== 2) return source;
  const guarded = section.replace(call, `if ( directLight.visible ) { ${call} }`);
  return source.slice(0, start) + guarded + source.slice(end);
}

/** One sun with overlapping depth ranges, rather than a light per vehicle. */
export function createRaceSunShadows({ scene, camera, low = false, assets = [] }) {
  const profile = low ? SUN_SHADOW_PROFILES.performance : SUN_SHADOW_PROFILES.high;
  const previousChunks = { lights_fragment_begin: ShaderChunk.lights_fragment_begin, lights_pars_begin: ShaderChunk.lights_pars_begin };
  const originals = new Map();
  const observedObjects = new Set(), pendingMeshes = new Set(), renderHooks = new Map();
  const preparedMaterials = new WeakSet();
  let disposed = false;
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
  const previousFragment = ShaderChunk.lights_fragment_begin;
  ShaderChunk.lights_fragment_begin = skipInactiveSpotlightBRDF(previousFragment);
  const spotlightGuard = ShaderChunk.lights_fragment_begin !== previousFragment;
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

  const restoreMaterial = (material, update = true) => {
    const previous = originals.get(material);
    if (!previous) return;
    originals.delete(material);
    csm.shaders.delete(material);
    preparedMaterials.delete(material);
    material.removeEventListener('dispose', onMaterialDisposed);
    material.onBeforeCompile = previous.hook;
    material.customProgramCacheKey = previous.cacheKey;
    if (previous.defines) {
      delete material.defines.USE_CSM; delete material.defines.CSM_CASCADES; delete material.defines.CSM_FADE;
      Object.assign(previous.defines, previous.defineValues); material.defines = previous.defines;
    } else delete material.defines;
    if (update) material.needsUpdate = true;
  };
  function onMaterialDisposed(event) { restoreMaterial(event.target, false); }
  const prepareMaterial = material => {
    if (!material || preparedMaterials.has(material)) return;
    preparedMaterials.add(material);
    if (!supportsSunShadow(material)) return;
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
    material.customProgramCacheKey = () => `${previous.cacheValue}|race-csm:${profile.cascades}:fade:${profile.blendDistance}:visible-spots:${spotlightGuard ? 1 : 0}`;
    material.addEventListener('dispose', onMaterialDisposed);
    material.needsUpdate = true;
  };
  const prepareMaterials = root => {
    if (Array.isArray(root)) { for (const entry of root) prepareMaterials(entry); }
    else if (root?.isMaterial) prepareMaterial(root);
    else root?.traverse(object => { if (object.isMesh) prepareMaterials(object.material); });
  };
  const flushPendingMaterials = () => {
    for (const mesh of pendingMeshes) prepareMaterials(mesh.material);
    pendingMeshes.clear();
  };
  const observeTree = object => {
    if (observedObjects.has(object)) return;
    observedObjects.add(object);
    object.addEventListener('childadded', onChildAdded);
    object.addEventListener('childremoved', onChildRemoved);
    if (object.isMesh) {
      pendingMeshes.add(object);
      const previous = object.onBeforeRender;
      const guard = function (renderer, renderScene, renderCamera, geometry, material, group) {
        // A mounted mesh can swap its material without any topology event.
        // Prepare that exact draw material before WebGLRenderer compiles it.
        if (!preparedMaterials.has(material)) prepareMaterial(material);
        previous.call(this, renderer, renderScene, renderCamera, geometry, material, group);
      };
      renderHooks.set(object, { previous, guard });
      object.onBeforeRender = guard;
    }
    for (const child of object.children) observeTree(child);
  };
  const forgetTree = object => {
    if (!observedObjects.delete(object)) return;
    pendingMeshes.delete(object);
    const hook = renderHooks.get(object);
    if (hook && object.onBeforeRender === hook.guard) object.onBeforeRender = hook.previous;
    renderHooks.delete(object);
    object.removeEventListener('childadded', onChildAdded);
    object.removeEventListener('childremoved', onChildRemoved);
    for (const child of object.children) forgetTree(child);
  };
  function onChildAdded(event) { if (!disposed) observeTree(event.child); }
  function onChildRemoved(event) { forgetTree(event.child); }
  observeTree(scene);
  flushPendingMaterials();
  for (const asset of assets) prepareMaterials(asset.scene || asset);
  const previousBeforeRender = scene.onBeforeRender;
  const beforeRender = function (...args) {
    flushPendingMaterials();
    previousBeforeRender.apply(this, args);
    // JSX can attach a mesh before its child material is assigned. Flushing
    // this small lifecycle queue here catches the final material before the
    // first visible draw, including objects added after the lighting tick.
    flushPendingMaterials();
  };
  scene.onBeforeRender = beforeRender;
  const registration = { prepareMaterials, lights: csm.lights };
  activeSystems.set(scene, registration);
  let previousFov = camera.fov, previousAspect = camera.aspect, previousNear = camera.near, previousFar = camera.far;
  const previousCameraMatrix = new Matrix4();
  let hasUpdated = false;

  return {
    profile,
    lights: csm.lights,
    prepareMaterials,
    update(direction, color, intensity) {
      if (disposed) return;
      flushPendingMaterials();
      const directionChanged = !csm.lightDirection.equals(direction);
      if (directionChanged) csm.lightDirection.copy(direction);
      for (const light of csm.lights) {
        if (!light.color.equals(color)) light.color.copy(color);
        if (light.intensity !== intensity) light.intensity = intensity;
      }
      const rangeChanged = camera.near !== previousNear || camera.far !== previousFar;
      const projectionChanged = rangeChanged || camera.fov !== previousFov || camera.aspect !== previousAspect;
      if (projectionChanged) {
        updateFrustums();
        if (rangeChanged) syncCascadeMetadata();
        previousFov = camera.fov; previousAspect = camera.aspect; previousNear = camera.near; previousFar = camera.far;
      }
      camera.updateMatrixWorld();
      if (hasUpdated && !directionChanged && !projectionChanged && previousCameraMatrix.equals(camera.matrixWorld)) return;
      csm.update();
      previousCameraMatrix.copy(camera.matrixWorld);
      hasUpdated = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (activeSystems.get(scene) === registration) activeSystems.delete(scene);
      if (scene.onBeforeRender === beforeRender) scene.onBeforeRender = previousBeforeRender;
      forgetTree(scene);
      pendingMeshes.clear();
      csm.remove();
      csm.dispose();
      for (const light of csm.lights) light.shadow.dispose();
      for (const material of originals.keys()) restoreMaterial(material);
      for (const key of Object.keys(previousChunks)) {
        if (ShaderChunk[key] === injectedChunks[key]) ShaderChunk[key] = previousChunks[key];
      }
    },
  };
}
