import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CULL_MARGIN, SCENERY_CULL_DISTANCE, placedBounds, placementMatrix, RoadVisibility, wrapWorldZ } from './visibility';
import { placeOnRoad } from './road-path';

function camera() {
  const result = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
  result.position.set(0, 5, 12);
  result.lookAt(0, 5, -100);
  result.updateProjectionMatrix();
  result.updateMatrixWorld();
  return result;
}

describe('world recycling', () => {
  it('wraps one complete world without losing the layout phase', () => {
    expect(wrapWorldZ(24, 0, 720)).toBe(41);
    expect(wrapWorldZ(24, 720, 720)).toBe(41);
    expect(wrapWorldZ(24, 18, 720)).toBe(59);
    expect(wrapWorldZ(24, 30, 720)).toBe(-649);
  });

  it('keeps positions in range for offsets beyond the world and negative phases', () => {
    for (const offset of [-17, 0, 735, 1450]) {
      for (const distance of [-120, 0, 720, 12345678.5]) {
        const z = wrapWorldZ(offset, distance, 720);
        expect(z).toBeGreaterThan(-655);
        expect(z).toBeLessThanOrEqual(65);
      }
    }
  });
});

describe('whole-model visibility', () => {
  it('transforms an off-center prototype bound with its rotation and scale', () => {
    const local = new THREE.Sphere(new THREE.Vector3(-2, 4, 0), 5);
    const placed = placedBounds(local, placementMatrix({ x: 20, rotation: Math.PI / 2, scale: 2 }));
    expect(placed.center.x).toBeCloseTo(20);
    expect(placed.center.y).toBeCloseTo(8);
    expect(placed.center.z).toBeCloseTo(4);
    expect(placed.radius).toBeCloseTo(10);
    expect(local.radius).toBe(5);
  });

  it('keeps the whole object when its center is beyond a side plane', () => {
    const view = new RoadVisibility();
    view.update(camera(), 0);
    // At 50 m depth the right plane is x=28.87. A 9 m radius
    // building centered at x=34 still has a clearly visible side.
    expect(view.visible(new THREE.Sphere(new THREE.Vector3(34, 5, 0), 9), -38)).toBe(true);
    expect(view.visible(new THREE.Sphere(new THREE.Vector3(60, 5, 0), 4), -38)).toBe(false);
  });

  it('keeps large buildings across the cutoff and removes them only wholly beyond fog', () => {
    const view = new RoadVisibility();
    const activeCamera = camera();
    view.update(activeCamera, 0);
    const bounds = new THREE.Sphere(new THREE.Vector3(20, 10, 0), 20);
    const nearestDepth = z => {
      // Match the rendered model's world matrix, then measure camera-space
      // depth. Logical road Z is not camera depth once the road curves.
      const world = bounds.clone().applyMatrix4(placeOnRoad(new THREE.Matrix4(), new THREE.Matrix4(), z, 0));
      return -world.center.applyMatrix4(activeCamera.matrixWorldInverse).z - world.radius - CULL_MARGIN;
    };
    expect(nearestDepth(-640)).toBeCloseTo(613.555, 3);
    expect(nearestDepth(-640)).toBeLessThan(SCENERY_CULL_DISTANCE);
    expect(view.visible(bounds, -640)).toBe(true); // Curved near face remains inside 620m.
    expect(nearestDepth(-680)).toBeGreaterThan(SCENERY_CULL_DISTANCE);
    expect(view.visible(bounds, -680)).toBe(false);
  });

  it('culls the bent model bound rather than its old straight-road location', () => {
    const activeCamera = camera();
    const view = new RoadVisibility();
    view.update(activeCamera, 200);
    const prototype = new THREE.Sphere(new THREE.Vector3(0, 5, 0), 8);
    for (const [x, z, expectedCurved, expectedStraight] of [[80, -100, true, false], [-120, -250, false, true]]) {
      const localMatrix = placementMatrix({ x });
      const localBounds = placedBounds(prototype, localMatrix);
      const renderedBounds = prototype.clone().applyMatrix4(placeOnRoad(new THREE.Matrix4(), localMatrix, z, 200));
      const straightBounds = localBounds.clone();
      straightBounds.center.z += z;
      renderedBounds.radius += CULL_MARGIN;
      straightBounds.radius += CULL_MARGIN;
      expect(view.frustum.intersectsSphere(straightBounds)).toBe(expectedStraight);
      expect(view.frustum.intersectsSphere(renderedBounds)).toBe(expectedCurved);
      expect(view.visible(localBounds, z)).toBe(expectedCurved);
      // Shared prepared bounds must survive repeated visibility tests intact.
      expect(localBounds.center.toArray()).toEqual([x, 5, 0]);
      expect(localBounds.radius).toBe(8);
    }
  });

  it('keeps bounds containing the camera and discards objects wholly behind it', () => {
    const view = new RoadVisibility();
    view.update(camera(), 0);
    expect(view.visible(new THREE.Sphere(new THREE.Vector3(4, 5, 0), 12), 12)).toBe(true);
    expect(view.visible(new THREE.Sphere(new THREE.Vector3(0, 5, 0), 3), 40)).toBe(false);
  });

  it('stays unchanged while paused but responds to camera movement and resizing', () => {
    const view = new RoadVisibility();
    const activeCamera = camera();
    expect(view.update(activeCamera, 200)).toBe(true);
    const first = view.version;
    expect(view.update(activeCamera, 200)).toBe(false);
    expect(view.version).toBe(first);
    activeCamera.position.x = 1;
    expect(view.update(activeCamera, 200)).toBe(true);
    activeCamera.aspect = 2;
    activeCamera.updateProjectionMatrix();
    expect(view.update(activeCamera, 200)).toBe(true);
    expect(view.update(activeCamera, 201)).toBe(true);
  });
});
