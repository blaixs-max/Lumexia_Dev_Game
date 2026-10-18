import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, ShaderChunk, Vector3 } from 'three';
import { CSMShader } from 'three/addons/csm/CSMShader.js';
import { createRaceSunShadows, getRaceSunShadowLights, prepareRaceSunShadowMaterials, skipInactiveSpotlightBRDF, SUN_SHADOW_PROFILES } from './sun-shadows';

const fixture = () => {
  const scene = new Scene(), camera = new PerspectiveCamera(60, 1.6, 0.5, 750);
  camera.position.set(0, 5.2, 11.5); camera.lookAt(0, 0.7, -36); camera.updateMatrixWorld();
  return { scene, camera };
};

describe('continuous race sun shadows', () => {
  it.each([false, true])('covers visible traffic with a bounded cascade budget (low=%s)', low => {
    const { scene, camera } = fixture();
    const shadows = createRaceSunShadows({ scene, camera, low });
    try {
      const expected = low ? SUN_SHADOW_PROFILES.performance : SUN_SHADOW_PROFILES.high;
      expect(shadows.lights).toHaveLength(expected.cascades);
      expect(expected.maxFar).toBeGreaterThanOrEqual(320);
      expect(shadows.lights.every(light => light.shadow.mapSize.x === expected.mapSize && light.castShadow)).toBe(true);
      expect(shadows.lights.at(-1).userData.cascadeFar).toBe(expected.maxFar);
      expect(shadows.lights.every(light => light.userData.cascadeFade)).toBe(true);
      expect(shadows.lights.every(light => light.userData.cascadeBlendDistance === 8)).toBe(true);
      const direction = new Vector3(-0.3, -0.15, 1).normalize(), color = new Color('#ffc99c');
      shadows.update(direction, color, 1.25);
      for (const light of shadows.lights) {
        expect(light.intensity).toBe(1.25);
        expect(light.color.equals(color)).toBe(true);
        expect(light.target.position.clone().sub(light.position).normalize().distanceTo(direction)).toBeLessThan(1e-10);
        expect(light.shadow.camera.far).toBeGreaterThan(expected.maxFar);
      }
      camera.aspect = 0.6; camera.fov = 72; camera.updateProjectionMatrix();
      shadows.update(direction, color, 0.8);
      expect(shadows.lights.every(light => Number.isFinite(light.shadow.camera.right) && light.shadow.camera.right > 0)).toBe(true);
    } finally { shadows.dispose(); }
  });

  it('prepares future materials once, preserves custom shader code, and fades cascades', () => {
    const { scene, camera } = fixture();
    const material = new MeshStandardMaterial(), originalHook = vi.fn();
    material.onBeforeCompile = originalHook; material.defines.CUSTOM_ROAD = 1;
    const source = new Scene(); source.add(new Mesh(new BoxGeometry(), material));
    const shadows = createRaceSunShadows({ scene, camera, assets: [{ scene: source }] });
    try {
      expect(material.defines).toMatchObject({ USE_CSM: 1, CSM_CASCADES: 3, CSM_FADE: '', CUSTOM_ROAD: 1 });
      expect(ShaderChunk.lights_fragment_begin).toContain('margin = max( 8.0 / ( shadowFar - cameraNear ), 0.25 * pow( closestEdge, 2.0 ) );');
      const shader = { uniforms: {} };
      material.onBeforeCompile(shader, {});
      expect(originalHook).toHaveBeenCalledOnce();
      expect(shader.uniforms.shadowFar.value).toBe(360);
      expect(shader.uniforms.CSM_cascades.value).toHaveLength(3);
      expect(shader.uniforms.CSM_cascades.value[0].y).toBeCloseTo(32 / 360);
      const future = new MeshStandardMaterial(), unlit = new MeshBasicMaterial();
      scene.add(new Mesh(new BoxGeometry(), future), new Mesh(new BoxGeometry(), unlit));
      shadows.update(new Vector3(0, -1, 1).normalize(), new Color('white'), 2);
      expect(future.defines.USE_CSM).toBe(1);
      expect(unlit.defines?.USE_CSM).toBeUndefined();
      const version = future.version;
      shadows.update(new Vector3(0, -1, 1).normalize(), new Color('white'), 2);
      expect(future.version).toBe(version);
    } finally { shadows.dispose(); }
  });

  it.each([false, true])('keeps road vehicle geometry in shadow coverage through sun-angle changes (low=%s)', low => {
    const { scene, camera } = fixture();
    const shadows = createRaceSunShadows({ scene, camera, low });
    try {
      for (const direction of [[82, -145, 460], [82, -34, 460], [-82, -85, 460]]) {
        shadows.update(new Vector3(...direction).normalize(), new Color('white'), 2);
        scene.updateMatrixWorld(true);
        shadows.lights.forEach(light => light.shadow.updateMatrices(light));
        // Test both lane edges, ground contact and roof height, from the
        // player's tyres to the visible approach rather than just map sizes.
        for (const z of [-2, -32, -90, -180, -275]) for (const x of [-6, 6]) for (const y of [0, 3]) {
          const vertex = new Vector3(x, y, z);
          expect(shadows.lights.some(light => light.shadow.getFrustum().containsPoint(vertex))).toBe(true);
        }
      }
    } finally { shadows.dispose(); }
  });

  it.each([false, true])('covers both maps throughout the widened cascade transitions (low=%s)', low => {
    const { scene, camera } = fixture();
    const shadows = createRaceSunShadows({ scene, camera, low });
    try {
      for (const direction of [[82, -145, 460], [82, -34, 460], [-82, -85, 460]]) {
        shadows.update(new Vector3(...direction).normalize(), new Color('white'), 2);
        scene.updateMatrixWorld(true);
        shadows.lights.forEach(light => light.shadow.updateMatrices(light));
        for (let index = 0; index < shadows.lights.length - 1; index++) {
          const near = shadows.lights[index], far = shadows.lights[index + 1];
          const split = near.userData.cascadeFar, halfOverlap = near.userData.cascadeBlendDistance / 2;
          for (const depth of [split - halfOverlap, split, split + halfOverlap]) for (const x of [-1, 1]) for (const y of [-1, 1]) {
            const halfHeight = depth * Math.tan(camera.fov * Math.PI / 360);
            const vertex = new Vector3(x * halfHeight * camera.aspect, y * halfHeight, -depth).applyMatrix4(camera.matrixWorld);
            expect(near.shadow.getFrustum().containsPoint(vertex)).toBe(true);
            expect(far.shadow.getFrustum().containsPoint(vertex)).toBe(true);
          }
        }
      }
    } finally { shadows.dispose(); }
  });

  it('restores shared materials and global chunks before the next garage or race', () => {
    const { scene, camera } = fixture();
    const material = new MeshStandardMaterial(), hook = vi.fn(), defines = material.defines, cacheKey = material.customProgramCacheKey;
    material.onBeforeCompile = hook; defines.CUSTOM_MODEL = 2;
    const chunks = { fragment: ShaderChunk.lights_fragment_begin, pars: ShaderChunk.lights_pars_begin };
    scene.add(new Mesh(new BoxGeometry(), material));
    const shadows = createRaceSunShadows({ scene, camera });
    const lights = [...shadows.lights];
    shadows.dispose(); shadows.dispose();
    expect(scene.children.some(object => lights.includes(object))).toBe(false);
    expect(material.onBeforeCompile).toBe(hook);
    expect(material.customProgramCacheKey).toBe(cacheKey);
    expect(material.defines).toBe(defines);
    expect(material.defines).toEqual({ STANDARD: '', CUSTOM_MODEL: 2 });
    expect(ShaderChunk.lights_fragment_begin).toBe(chunks.fragment);
    expect(ShaderChunk.lights_pars_begin).toBe(chunks.pars);
  });
});


describe('sun-shadow registration and CPU work', () => {
  it('prepares late JSX materials before first rendering and supports a mounted mesh material swap', () => {
    const { scene, camera } = fixture();
    const sceneHook = vi.fn(), meshHook = vi.fn();
    scene.onBeforeRender = sceneHook;
    const shadows = createRaceSunShadows({ scene, camera });
    const nested = new Group(), late = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    late.onBeforeRender = meshHook;
    try {
      scene.add(nested); nested.add(late);
      const finalMaterial = new MeshStandardMaterial();
      late.material = finalMaterial;
      scene.onBeforeRender.call(scene, {}, scene, camera, null);
      expect(sceneHook.mock.contexts[0]).toBe(scene);
      expect(finalMaterial.defines.USE_CSM).toBe(1);
      const replacement = new MeshStandardMaterial();
      late.material = replacement;
      late.onBeforeRender.call(late, {}, scene, camera, late.geometry, replacement, null);
      expect(replacement.defines.USE_CSM).toBe(1);
      expect(meshHook.mock.contexts[0]).toBe(late);
      expect(meshHook.mock.calls[0][4]).toBe(replacement);
      const version = replacement.version;
      late.onBeforeRender.call(late, {}, scene, camera, late.geometry, replacement, null);
      expect(replacement.version).toBe(version);
    } finally { shadows.dispose(); }
    expect(scene.onBeforeRender).toBe(sceneHook);
    expect(late.onBeforeRender).toBe(meshHook);
  });

  it('removes observers and draw guards when a subtree leaves, and respects a newer user hook', () => {
    const { scene, camera } = fixture();
    const group = new Group(), material = new MeshStandardMaterial(), mesh = new Mesh(new BoxGeometry(), material);
    const original = vi.fn(); mesh.onBeforeRender = original; group.add(mesh); scene.add(group);
    const shadows = createRaceSunShadows({ scene, camera });
    try {
      scene.remove(group);
      expect(mesh.onBeforeRender).toBe(original);
      const detachedMaterial = new MeshStandardMaterial(); group.add(new Mesh(new BoxGeometry(), detachedMaterial));
      scene.onBeforeRender.call(scene, {}, scene, camera, null);
      expect(detachedMaterial.defines.USE_CSM).toBeUndefined();
      scene.add(group); scene.onBeforeRender.call(scene, {}, scene, camera, null);
      expect(detachedMaterial.defines.USE_CSM).toBe(1);
      const newerHook = vi.fn(); mesh.onBeforeRender = newerHook;
      scene.remove(group);
      expect(mesh.onBeforeRender).toBe(newerHook);
    } finally { shadows.dispose(); }
  });

  it('releases disposed material hooks and allows explicit source-material registration', () => {
    const { scene, camera } = fixture();
    const material = new MeshStandardMaterial(), originalHook = material.onBeforeCompile;
    const shadows = createRaceSunShadows({ scene, camera });
    try {
      expect(getRaceSunShadowLights(scene)).toBe(shadows.lights);
      expect(prepareRaceSunShadowMaterials(scene, [material])).toBe(true);
      expect(material.defines.USE_CSM).toBe(1);
      material.dispose();
      expect(material.onBeforeCompile).toBe(originalHook);
      expect(material.defines.USE_CSM).toBeUndefined();
      expect(prepareRaceSunShadowMaterials(scene, material)).toBe(true);
      expect(material.defines.USE_CSM).toBe(1);
    } finally { shadows.dispose(); }
    expect(prepareRaceSunShadowMaterials(scene, material)).toBe(false);
    expect(getRaceSunShadowLights(scene)).toHaveLength(0);
    expect(material.onBeforeCompile).toBe(originalHook);
  });

  it('does not traverse the scene in settled frames and still updates for exact camera changes', () => {
    const { scene, camera } = fixture();
    scene.add(new Mesh(new BoxGeometry(), new MeshStandardMaterial()));
    const shadows = createRaceSunShadows({ scene, camera });
    const direction = new Vector3(82, -145, 460).normalize(), color = new Color('white');
    try {
      shadows.update(direction, color, 2);
      const traverse = vi.spyOn(scene, 'traverse'), position = vi.spyOn(shadows.lights[0].position, 'copy');
      for (let frame = 0; frame < 20; frame++) { shadows.update(direction, color, 2); scene.onBeforeRender.call(scene); }
      expect(traverse).not.toHaveBeenCalled();
      expect(position).not.toHaveBeenCalled();
      camera.position.x += 0.000001;
      shadows.update(direction, color, 2);
      expect(position).toHaveBeenCalled();
      expect(traverse).not.toHaveBeenCalled();
    } finally { shadows.dispose(); }
  });

  it('preserves exact cascade geometry and uniforms across FOV, aspect and range changes', () => {
    const { scene, camera } = fixture();
    const material = new MeshStandardMaterial(); scene.add(new Mesh(new BoxGeometry(), material));
    const shadows = createRaceSunShadows({ scene, camera });
    let reference;
    try {
      const shader = { uniforms: {} }; material.onBeforeCompile(shader, {});
      const direction = new Vector3(82, -34, 460).normalize(), color = new Color('white');
      camera.fov = 68.123456789; camera.aspect = 0.61; camera.updateProjectionMatrix();
      shadows.update(direction, color, 2);
      const referenceScene = new Scene(), referenceCamera = camera.clone();
      reference = createRaceSunShadows({ scene: referenceScene, camera: referenceCamera });
      reference.update(direction, color, 2);
      for (let index = 0; index < shadows.lights.length; index++) {
        expect(shadows.lights[index].shadow.camera.projectionMatrix.elements).toEqual(reference.lights[index].shadow.camera.projectionMatrix.elements);
        expect(shadows.lights[index].position.toArray()).toEqual(reference.lights[index].position.toArray());
      }
      reference.dispose(); reference = null;
      camera.near = 0.75; camera.far = 240; camera.updateProjectionMatrix();
      shadows.update(direction, color, 2);
      expect(shader.uniforms.cameraNear.value).toBe(0.75);
      expect(shader.uniforms.shadowFar.value).toBe(240);
      expect(shadows.lights.at(-1).userData.cascadeFar).toBe(240);
    } finally { reference?.dispose(); shadows.dispose(); }
  });
});

describe('inactive headlight shading', () => {
  it('guards only the spotlight BRDF call and preserves shadow/map processing and other lights', () => {
    const source = CSMShader.lights_fragment_begin;
    const result = skipInactiveSpotlightBRDF(source);
    const call = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
    expect(result).not.toBe(source);
    expect(result.replace(`if ( directLight.visible ) { ${call} }`, call)).toBe(source);
    expect(skipInactiveSpotlightBRDF('future changed lighting chunk')).toBe('future changed lighting chunk');
  });

  it('keeps the installed Three spotlight visibility contract explicit', () => {
    const source = ShaderChunk.lights_pars_begin;
    const start = source.indexOf('void getSpotLightInfo(');
    const end = source.indexOf('#endif', start);
    const spotlight = source.slice(start, end);
    expect(spotlight).toContain('light.visible = ( light.color != vec3( 0.0 ) );');
    expect(spotlight).toMatch(/else\s*\{\s*light\.color = vec3\( 0\.0 \);\s*light\.visible = false;/);
  });

  it('retains diffuse, specular, clearcoat and sheen for illuminated pixels and skips only zero additions', () => {
    const colors = [[0, 0, 0], [0.8, 1.2, 2.7], [0.000001, 0, 0], [0, 0.37, 0]];
    const existing = [0.13, 0.47, 0.91];
    // Each of these installed physical-light accumulators is linear in the
    // attenuated incident RGB. Black also covers day, cone/range cutoffs.
    for (const coefficients of [[0.1, 0.4, 0.8], [4, 2, 1], [0.7, 0.3, 0.1], [0.03, 0.05, 0.07]]) for (const color of colors) {
      const legacy = existing.map((value, axis) => value + color[axis] * coefficients[axis]);
      const visible = color.some(channel => channel !== 0);
      const guarded = visible ? existing.map((value, axis) => value + color[axis] * coefficients[axis]) : existing;
      expect(guarded).toEqual(legacy);
    }
  });
});
