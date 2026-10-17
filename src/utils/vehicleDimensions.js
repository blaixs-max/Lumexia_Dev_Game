export const TRAFFIC_MODELS = {
  sport: { path: '/models/ferrari_runtime.glb', rotation: 0 },
  sedan: { path: '/models/Car 3/scene.gltf', rotation: Math.PI },
  suv: { path: '/models/Car 2/scene.gltf', rotation: Math.PI },
  truck: { path: '/models/truck.glb', rotation: Math.PI },
};

// Keep the original fit limits separate from collision footprints: changing a
// collider must not resize an already-familiar car on the road.
export const VEHICLE_RENDER_LIMITS = {
  player: { width: 1.8, length: 5.5 },
  sedan: { width: 3, length: 6.75 },
  truck: { width: 3.1, length: 8.3 },
  sport: { width: 1.9, length: 4.2 },
  suv: { width: 2.9, length: 7.6 },
};

// Measured, normalized bounds after applying the renderer's uniform fit.
// These are conservative AABBs, including source mirrors and spoilers, rather
// than the larger rectangles the models were merely required to fit inside.
export const VEHICLE_DIMENSIONS = {
  player: { width: 1.8, length: 5.018034 },
  sedan: { width: 2.633297, length: 6.75 },
  truck: { width: 3.1, length: 5.406025 },
  sport: { width: 1.9, length: 3.816281 },
  suv: { width: 2.354468, length: 7.6 },
};

const PLAYER_DIMENSIONS = {
  default: VEHICLE_DIMENSIONS.player,
  gt: { width: 1.8, length: 4.613987 },
  apex: { width: 1.8, length: 3.615425 },
  rally: { width: 1.8, length: 3.982186 },
  street: { width: 1.8, length: 4.104111 },
  formula: { width: 1.8, length: 3.908048 },
};

export function getPlayerDimensions(carId) {
  return Object.hasOwn(PLAYER_DIMENSIONS, carId) ? PLAYER_DIMENSIONS[carId] : PLAYER_DIMENSIONS.default;
}
