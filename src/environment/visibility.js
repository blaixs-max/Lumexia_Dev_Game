import * as THREE from 'three';

// Keep complete scenery beyond the shared 600 m fog end. The bounding sphere
// is tested, so a large building's visible front cannot disappear early.
export const SCENERY_CULL_DISTANCE = 620;
export const CULL_MARGIN = 1.5;

export function wrapWorldZ(offset, distance, span, rear = 65) {
  const phase = ((offset - distance % span) % span + span) % span;
  return rear - phase;
}

export function placementMatrix(item) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(item.x, item.y || 0, 0),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.rotation || 0),
    new THREE.Vector3().setScalar(item.scale ?? 1),
  );
}

export function placedBounds(localSphere, matrix) {
  return localSphere.clone().applyMatrix4(matrix);
}

export function isBoundsVisible(bounds, z, frustum, viewMatrix, scratchSphere, cutoff = SCENERY_CULL_DISTANCE) {
  scratchSphere.center.set(bounds.center.x, bounds.center.y, bounds.center.z + z);
  scratchSphere.radius = bounds.radius + CULL_MARGIN;
  const e = viewMatrix.elements, center = scratchSphere.center;
  const depth = -(e[2] * center.x + e[6] * center.y + e[10] * center.z + e[14]);
  if (depth - scratchSphere.radius > cutoff) return false;
  return frustum.intersectsSphere(scratchSphere);
}

// Shared by all scenery batches: one camera/frustum calculation per frame,
// with a version that lets every GPU buffer stay untouched when paused.
export class RoadVisibility {
  constructor() {
    this.frustum = new THREE.Frustum();
    this.projectionView = new THREE.Matrix4();
    this.view = new THREE.Matrix4();
    this.previousCamera = new THREE.Matrix4();
    this.previousProjection = new THREE.Matrix4();
    this.scratchSphere = new THREE.Sphere();
    this.distance = NaN;
    this.version = 0;
  }

  update(camera, distance) {
    camera.updateMatrixWorld();
    if (distance === this.distance && this.previousCamera.equals(camera.matrixWorld)
      && this.previousProjection.equals(camera.projectionMatrix)) return false;
    this.distance = distance;
    this.previousCamera.copy(camera.matrixWorld);
    this.previousProjection.copy(camera.projectionMatrix);
    this.view.copy(camera.matrixWorldInverse);
    this.projectionView.multiplyMatrices(camera.projectionMatrix, this.view);
    this.frustum.setFromProjectionMatrix(this.projectionView);
    this.version++;
    return true;
  }

  visible(bounds, z) {
    return isBoundsVisible(bounds, z, this.frustum, this.view, this.scratchSphere);
  }
}
