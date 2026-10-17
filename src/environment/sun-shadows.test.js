import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, PerspectiveCamera, Scene, ShaderChunk, Vector3 } from 'three';
import { createRaceSunShadows, SUN_SHADOW_PROFILES } from './sun-shadows';

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
