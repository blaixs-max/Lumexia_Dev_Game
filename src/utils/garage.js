export const GARAGE_KEY = 'lumexia.garage.v1';
export const STARTER_GOLD = 1500;
export const MAX_GOLD = 999_999_999;
export const UPGRADE_COSTS = {
  engine: [300, 650, 1100],
  handling: [250, 550, 950],
  nitro: [350, 750, 1250],
};
// IDs are persisted purchase/build keys; model and display-name changes keep them stable.
export const CARS = [
  { id: 'default', name: 'LX SPORT', price: 0, className: 'BALANCED', classLabel: 'Balanced', description: 'Balanced speed and handling. Ready for every race.', model: '/models/sport_car_runtime.glb', preview: '/models/sport_car_compact.glb', rotation: 0, cruise: 110, boost: 200, acceleration: 2, steering: 15, response: 12, capacity: 100, regen: 5 },
  { id: 'gt', name: 'LX GT', price: 1250, className: 'GRAND TOURER', classLabel: 'Grand Tourer', description: 'Smooth steering and a generous nitro reserve built for the long run.', model: '/models/Car 3/scene.gltf', preview: '/models/Car 3/scene.gltf', rotation: Math.PI, cruise: 105, boost: 190, acceleration: 1.8, steering: 13.5, response: 11, capacity: 125, regen: 6 },
  { id: 'apex', name: 'LX APEX', price: 3000, className: 'SPRINT', classLabel: 'Sprint', description: 'Punchy acceleration and sharp handling to carve through gaps in traffic.', model: '/models/ferrari_runtime.glb', preview: '/models/ferrari_runtime.glb', rotation: 0, cruise: 116, boost: 205, acceleration: 2.5, steering: 16, response: 13, capacity: 90, regen: 4.5 },
  { id: 'rally', name: 'SUBARU WRX STI', price: 900, className: 'RALLY', classLabel: 'Rally Sedan', description: 'Rally-bred performance with quick steering to thread the traffic.', model: '/models/realistic/rally.glb', preview: '/models/realistic/rally.glb', rotation: 0, showroomRotation: Math.PI, cruise: 108, boost: 190, acceleration: 2.2, steering: 16.5, response: 13, capacity: 95, regen: 5 },
  { id: 'street', name: 'BMW M3 E30', price: 2400, className: 'CLASSIC SPORT', classLabel: 'Classic Sport', description: 'Classic performance, strong cruising speed and a deep nitro reserve for long straights.', model: '/models/realistic/street.glb', preview: '/models/realistic/street.glb', rotation: 0, showroomRotation: Math.PI, cruise: 118, boost: 202, acceleration: 2.1, steering: 14.5, response: 11.5, capacity: 115, regen: 5.5 },
  { id: 'formula', name: 'NISSAN Z PROTO', price: 4800, className: 'SPORT COUPE', classLabel: 'Sports Coupe', description: 'A modern sports coupe with hard acceleration and high top speed. Make every nitro burst count.', model: '/models/realistic/formula.glb', preview: '/models/realistic/formula.glb', rotation: 0, showroomRotation: Math.PI, cruise: 122, boost: 210, acceleration: 2.65, steering: 16.2, response: 13.5, capacity: 85, regen: 4 },
];
export const EQUIPMENT = [
  { id: 'engine', name: 'ENGINE', icon: '↗', description: 'Higher top speed and quicker acceleration.' },
  { id: 'handling', name: 'HANDLING', icon: '⌁', description: 'Faster steering response and lane transitions.' },
  { id: 'nitro', name: 'NITRO SYSTEM', icon: 'ϟ', description: 'Higher nitro speed, increased capacity and faster recharge.' },
];
export const getCar = id => CARS.find(car => car.id === id) || CARS[0];
const level = value => Number.isInteger(value) ? Math.max(0, Math.min(3, value)) : 0;
const gold = value => Number.isFinite(value) ? Math.max(0, Math.min(MAX_GOLD, Math.floor(value))) : STARTER_GOLD;
export function getUpgradeCost(part, currentLevel) {
  return Object.hasOwn(UPGRADE_COSTS, part) && Number.isInteger(currentLevel)
    && currentLevel >= 0 && currentLevel < 3 ? UPGRADE_COSTS[part][currentLevel] : null;
}
export function calculateRunGold({ coinsCollected = 0, totalDistance = 0 } = {}) {
  const coins = Number.isFinite(coinsCollected) ? Math.max(0, Math.floor(coinsCollected)) : 0;
  const distance = Number.isFinite(totalDistance) ? Math.max(0, totalDistance) : 0;
  return Math.min(MAX_GOLD, coins * 25 + Math.floor(distance / 10));
}
export function sanitizeGarage(value) {
  const upgrades = Object.fromEntries(CARS.map(car => [car.id,
    Object.fromEntries(EQUIPMENT.map(part => [part.id, level(value?.upgrades?.[car.id]?.[part.id])]))]));
  const legacy = value && (value.schemaVersion === undefined || value.schemaVersion === 1 || value.schemaVersion === 2);
  // Previously all vehicles were free. Keep a player's existing chosen/tuned
  // vehicles, while unused vehicles now follow the purchase progression.
  const ownedCars = CARS.filter(car => car.id === 'default' || (legacy
    ? value.selectedCar === car.id || Object.values(upgrades[car.id]).some(stage => stage > 0)
    : value?.schemaVersion === 3 && Array.isArray(value.ownedCars) && value.ownedCars.includes(car.id)))
    .map(car => car.id);
  for (const car of CARS) {
    if (!ownedCars.includes(car.id)) upgrades[car.id] = Object.fromEntries(EQUIPMENT.map(part => [part.id, 0]));
  }
  const selectedCar = ownedCars.includes(value?.selectedCar) ? value.selectedCar : 'default';
  return { schemaVersion: 3, gold: gold(value?.gold), selectedCar, ownedCars, upgrades };
}
export function readGarage(storage) {
  try { return sanitizeGarage(JSON.parse((storage || globalThis.localStorage)?.getItem(GARAGE_KEY) || 'null')); }
  catch { return sanitizeGarage(null); }
}
export function saveGarage(value) {
  try { globalThis.localStorage?.setItem(GARAGE_KEY, JSON.stringify(sanitizeGarage(value))); return true; }
  catch { return false; }
}
export function getCarStats(carId, upgrades = {}) {
  const car = getCar(carId);
  const engine = level(upgrades.engine), handling = level(upgrades.handling), nitro = level(upgrades.nitro);
  return { cruiseSpeed: car.cruise + engine * 4, boostSpeed: car.boost + nitro * 5,
    rocketSpeed: Math.max(210, car.boost + nitro * 5 + 10),
    acceleration: car.acceleration + engine * 0.2, steeringRate: car.steering + handling * 0.8,
    steeringResponse: car.response + handling, maxNitro: car.capacity + nitro * 15,
    nitroRegenRate: car.regen + nitro * 0.75, engine, handling, nitro };
}
