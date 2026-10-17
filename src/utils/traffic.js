import { VEHICLE_DIMENSIONS } from './vehicleDimensions.js';

export const PLAYER_Z = -2;
export const LANE_WIDTH = 4.5;
export const LANES = [-1, 0, 1];
export const WORLD_SPEED_SCALE = 0.5;
export const SIGNAL_DURATION = 0.65;
export const LANE_CHANGE_DURATION = 1.35;

const MIN_BODY_GAP = 4;
const SPAWN_GAP = 45;
const FOLLOWING_TIME = 0.95;
const ACCELERATION = 5;
const BRAKING = 24;
const SPACING = [48, 35, 27, 19, 13, 10, 8, 7];
const dimensions = car => VEHICLE_DIMENSIONS[car.type] || VEHICLE_DIMENSIONS.sedan;
const actualSpeed = car => Math.max(0, car.actualSpeed ?? car.ownSpeed);
export const occupiedLanes = car => car.targetLane !== car.lane && (car.isChanging || car.indicator || car.laneChangePlanned)
  ? [car.lane, car.targetLane] : [car.lane];
const sharedLane = (a, b) => occupiedLanes(a).some(lane => occupiedLanes(b).includes(lane));
const bodyLength = (a, b) => (dimensions(a).length + dimensions(b).length) / 2;
const playerSpeeds = state => [state.runStats?.cruiseSpeed ?? 110, state.runStats?.boostSpeed ?? 200, state.rocketTargetSpeed ?? 210];

// Enough longitudinal room to react and cross both lane boundaries, even
// under boost. A maneuver reserves its origin and destination for its whole
// duration, so its apparent open lane cannot be counted as an escape route.
export const passingWindow = speeds => Math.max(48, Math.max(...speeds) * WORLD_SPEED_SCALE * 0.9 + 12);

function corridorAt(enemies, speeds, seconds) {
  const active = enemies.filter(car => car.z < PLAYER_Z + 12 && car.z > -600)
    .map(car => ({ car, z: car.z - actualSpeed(car) * WORLD_SPEED_SCALE * seconds }))
    .sort((a, b) => a.z - b.z);
  const window = passingWindow(speeds);
  for (let i = 0; i < active.length; i++) {
    const lanes = new Set();
    for (let j = i; j < active.length && active[j].z - active[i].z < window; j++) {
      occupiedLanes(active[j].car).forEach(lane => lanes.add(lane));
      if (lanes.size === LANES.length) return false;
    }
  }
  return true;
}

export function hasPassingCorridor(enemies, speeds = [110, 200, 210]) {
  return corridorAt(enemies, speeds, 0);
}

export function isTrafficPlacementSafe(candidate, enemies, speeds = [110, 200, 210]) {
  const others = enemies.filter(car => car.id !== candidate.id && car.z < PLAYER_Z + 12 && car.z > -600);
  const maneuver = candidate.targetLane !== candidate.lane && (candidate.indicator || candidate.isChanging || candidate.laneChangePlanned);
  const horizon = SIGNAL_DURATION + LANE_CHANGE_DURATION;
  for (const other of others) {
    if (!sharedLane(candidate, other)) continue;
    const initial = other.z - candidate.z;
    const closing = (actualSpeed(candidate) - actualSpeed(other)) * WORLD_SPEED_SCALE;
    const future = initial + closing * horizon;
    const gap = maneuver ? bodyLength(candidate, other) + 9 : SPAWN_GAP;
    // The relative position is linear across this reservation; a sign change
    // means one NPC would pass through another before the maneuver finished.
    if (Math.abs(initial) < gap || Math.abs(future) < gap || initial * future <= 0) return false;
  }
  const proposed = [...others, candidate];
  return [0, horizon, 4].every(time => corridorAt(proposed, speeds, time));
}

function constraintsFor(car, front, speeds) {
  const constraints = [];
  for (const leader of front) {
    if (sharedLane(car, leader)) constraints.push({ leader, gap: bodyLength(car, leader) + MIN_BODY_GAP });
  }
  if (car.z >= PLAYER_Z + 12) return constraints;
  const window = passingWindow(speeds);
  const active = front.filter(leader => leader.z < PLAYER_Z + 12);
  const carLanes = occupiedLanes(car);
  for (let i = 0; i < active.length; i++) {
    const first = active[i];
    const firstLanes = occupiedLanes(first);
    if (new Set([...carLanes, ...firstLanes]).size === LANES.length) {
      constraints.push({ leader: first, gap: window });
    }
    for (let j = i + 1; j < active.length; j++) {
      const second = active[j];
      if (Math.abs(first.z - second.z) >= window) continue;
      if (new Set([...carLanes, ...firstLanes, ...occupiedLanes(second)]).size === LANES.length) {
        // This rear vehicle must not catch a cluster that would close its
        // final passing lane. Treat the leading edge as a virtual leader.
        constraints.push({ leader: first.z < second.z ? first : second, gap: window });
      }
    }
  }
  return constraints;
}

function approachClearance(car, state) {
  const speed = actualSpeed(car);
  const currentClosing = Math.max(0, state.speed - speed) * WORLD_SPEED_SCALE;
  const boostClosing = Math.max(0, Math.max(...playerSpeeds(state)) - speed) * WORLD_SPEED_SCALE;
  // Current speed determines full-maneuver clearance. An independent worst-
  // boost margin leaves time to see the signal and reach the reserved escape
  // lane, without forcing all cruise maneuvers into the distant horizon.
  return Math.max(70, currentClosing * (SIGNAL_DURATION + LANE_CHANGE_DURATION + 0.45) + 10,
    boostClosing * (SIGNAL_DURATION + 0.65) + 12);
}

function planLaneChanges(cars, state, delta, random) {
  const speeds = playerSpeeds(state);
  for (const car of [...cars].sort((a, b) => a.z - b.z)) {
    car.laneDecisionRemaining = (car.laneDecisionRemaining ?? 3) - delta;
    if (car.laneChangePlanned) {
      const triggerDistance = Math.max(car.maneuverSignalDistance, approachClearance(car, state) + 12);
      if (PLAYER_Z - car.z <= triggerDistance) {
        car.laneChangePlanned = false;
        car.indicator = Math.sign(car.targetLane - car.lane);
        car.signalRemaining = SIGNAL_DURATION;
      }
      continue;
    }
    if (car.indicator && !car.isChanging) {
      car.signalRemaining = Math.max(0, (car.signalRemaining ?? SIGNAL_DURATION) - delta);
      if (!car.signalRemaining) car.isChanging = true;
    }
    if (car.isChanging) {
      car.changeProgress = Math.min(1, (car.changeProgress || 0) + delta / LANE_CHANGE_DURATION);
      const blend = car.changeProgress ** 2 * (3 - 2 * car.changeProgress);
      car.x = (car.lane + (car.targetLane - car.lane) * blend) * LANE_WIDTH;
      if (car.changeProgress >= 1) {
        car.lane = car.targetLane;
        car.isChanging = false;
        car.indicator = 0;
        car.laneDecisionRemaining = 3 + random() * 3;
      }
      continue;
    }
    if (car.indicator || car.laneDecisionRemaining > 0 || car.laneChangeIntent === false) continue;
    // Retry while the approach is still visible. Waiting several seconds
    // after a denied first attempt used to leave boosted traffic permanently
    // locked in two parallel streams with no remaining maneuver window.
    car.laneDecisionRemaining = 0.35 + random() * 0.65;
    const safeApproach = approachClearance(car, state);
    if (PLAYER_Z - car.z <= safeApproach || random() > 0.7) continue;
    const adjacent = LANES.filter(lane => Math.abs(lane - car.lane) === 1);
    const offset = Math.floor(random() * adjacent.length);
    for (let i = 0; i < adjacent.length; i++) {
      const targetLane = adjacent[(offset + i) % adjacent.length];
      const candidate = { ...car, targetLane, indicator: Math.sign(targetLane - car.lane), signalRemaining: SIGNAL_DURATION, changeProgress: 0 };
      if (!isTrafficPlacementSafe(candidate, cars, speeds)) continue;
      // Commit immediately: the next decision in this tick sees this whole
      // reservation, preventing simultaneous swaps or competing merges.
      Object.assign(car, candidate);
      break;
    }
  }
}

function spawnTraffic(state, random) {
  if (state.rocketActive || state.enemies.length >= 12) return false;
  const types = ['sedan', 'sport', 'suv', 'truck'];
  const type = types[Math.floor(random() * types.length)];
  const ownSpeed = (type === 'truck' ? 42 : type === 'sport' ? 64 : 51) + random() * 9;
  const z = state.elapsedTime < 2 ? -210 : -300;
  const offset = Math.floor(random() * LANES.length);
  // A bounded recurring maneuver slot prevents two steady parallel streams
  // from starving lane changes indefinitely. If this slot cannot reserve a
  // safe move yet, wait for the approaching cluster to open a real gap.
  const wantsManeuver = state.nextEntityId % 4 === 0 || random() < 0.2;
  for (let i = 0; i < LANES.length; i++) {
    const lane = LANES[(offset + i) % LANES.length];
    const candidate = {
      id: `traffic-${state.nextEntityId}`, x: lane * LANE_WIDTH, z, lane,
      ownSpeed, actualSpeed: ownSpeed, type, speed: 1, passed: false, isChanging: false,
      targetLane: lane, changeProgress: 0, indicator: 0, signalRemaining: 0,
      laneDecisionRemaining: 0.05 + random() * 0.1,
      laneChangeIntent: wantsManeuver,
    };
    if (wantsManeuver) {
      if (PLAYER_Z - z <= approachClearance(candidate, state) + 12) continue;
      const adjacent = LANES.filter(target => Math.abs(target - lane) === 1);
      const first = Math.floor(random() * adjacent.length);
      let reserved = false;
      for (let n = 0; n < adjacent.length; n++) {
        const targetLane = adjacent[(first + n) % adjacent.length];
        const turning = { ...candidate, targetLane, laneChangePlanned: true, maneuverSignalDistance: 145 + random() * 35 };
        if (!isTrafficPlacementSafe(turning, state.enemies, playerSpeeds(state))) continue;
        Object.assign(candidate, turning);
        reserved = true;
        break;
      }
      if (!reserved) continue;
    }
    if (!isTrafficPlacementSafe(candidate, state.enemies, playerSpeeds(state))) continue;
    state.enemies.push(candidate);
    state.nextEntityId++;
    return true;
  }
  return false;
}

// Shared with the visual QA fixture. Caller advances elapsedTime and HUD
// totalDistance first; travel is the unscaled integral of player speed × dt.
// Always publish fresh NPC objects so prior store snapshots remain immutable.
export function updateTraffic(state, delta, travel, random = Math.random) {
  const cars = state.rocketActive ? [] : state.enemies.map(car => ({ ...car, actualSpeed: actualSpeed(car) }));
  planLaneChanges(cars, state, delta, random);
  const front = [];
  for (const car of [...cars].sort((a, b) => a.z - b.z)) {
    const constraints = constraintsFor(car, front, playerSpeeds(state));
    let desired = car.ownSpeed;
    for (const { leader, gap } of constraints) {
      desired = Math.min(desired, actualSpeed(leader) + Math.max(0, car.z - leader.z - gap) / (WORLD_SPEED_SCALE * FOLLOWING_TIME));
    }
    const change = (desired > car.actualSpeed ? ACCELERATION : BRAKING) * delta;
    let speed = car.actualSpeed + Math.max(-change, Math.min(change, desired - car.actualSpeed));
    for (const { leader, gap } of constraints) {
      // Discrete emergency limit guarantees body separation without moving
      // an NPC backwards or teleporting it to a new road position.
      const safeSpeed = (car.z + travel * WORLD_SPEED_SCALE - leader.z - gap) / (WORLD_SPEED_SCALE * delta);
      speed = Math.min(speed, Math.max(0, safeSpeed));
    }
    car.z += (travel - speed * delta) * WORLD_SPEED_SCALE;
    car.actualSpeed = speed;
    front.push(car);
  }
  state.enemies = cars.filter(car => car.z < 45 && car.z > -600);
  if (state.totalDistance >= state.nextTrafficDistance) {
    const spawned = spawnTraffic(state, random);
    const spacing = SPACING[Math.max(0, Math.min(SPACING.length - 1, Math.floor(state.currentLevel) - 1))];
    state.nextTrafficDistance = state.totalDistance + (spawned ? spacing : 1.5);
    state.lastSpawnZ = -state.totalDistance;
  }
  return state.enemies;
}
