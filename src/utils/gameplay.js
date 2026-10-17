import { getPlayerDimensions, VEHICLE_DIMENSIONS } from './vehicleDimensions.js';
import { LANE_WIDTH, LANES, PLAYER_Z, updateTraffic } from './traffic.js';

export { VEHICLE_DIMENSIONS } from './vehicleDimensions.js';
export { LANE_WIDTH, LANES, PLAYER_Z, updateTraffic, isTrafficPlacementSafe } from './traffic.js';

// Gameplay runs at a fixed tick so steering, traffic and pickups behave the
// same on a 30 Hz phone and a 144 Hz display. Rendering can run independently.
export const SIMULATION_STEP = 1 / 120;
export const ROAD_LIMIT = 5;

// A small inward tolerance avoids counting a visible sliver of clearance as
// a hit. Collision, passing clearance and near-miss checks share this value.
const CONTACT_INSET = 0.03;
const contactHalfExtent = (playerSize, trafficSize) => (playerSize + trafficSize) / 2 - CONTACT_INSET;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const damp = (from, to, rate, delta) => to + (from - to) * Math.exp(-rate * delta);

export function calculateFinalScore(score, gameMode = 'classic', reachedLevel5 = false) {
  if (!Number.isFinite(score) || score < 0) return 0;
  if (gameMode === 'doubleOrNothing' && !reachedLevel5) return 0;
  const finalScore = gameMode === 'doubleOrNothing' ? score * 2 : score;
  return Number.isFinite(finalScore) ? Math.floor(finalScore) : 0;
}

// Segment against an expanded rectangle. Unlike a point overlap, this also
// catches an obstacle crossing the whole player between two rendered frames.
export function sweptOverlap(fromX, fromZ, toX, toZ, halfWidth, halfLength) {
  let entry = 0;
  let exit = 1;
  for (const [from, to, radius] of [[fromX, toX, halfWidth], [fromZ, toZ, halfLength]]) {
    const travel = to - from;
    if (Math.abs(travel) < 1e-9) {
      if (Math.abs(from) > radius) return false;
    } else {
      const a = (-radius - from) / travel;
      const b = (radius - from) / travel;
      entry = Math.max(entry, Math.min(a, b));
      exit = Math.min(exit, Math.max(a, b));
      if (entry > exit) return false;
    }
  }
  return true;
}

export function collisionWithPlayer(enemy, nextEnemy, playerX, nextPlayerX, playerDimensions = VEHICLE_DIMENSIONS.player) {
  const dimensions = VEHICLE_DIMENSIONS[enemy.type] || VEHICLE_DIMENSIONS.sedan;
  return sweptOverlap(
    enemy.x - playerX, enemy.z - PLAYER_Z,
    nextEnemy.x - nextPlayerX, nextEnemy.z - PLAYER_Z,
    contactHalfExtent(playerDimensions.width, dimensions.width),
    contactHalfExtent(playerDimensions.length, dimensions.length),
  );
}

function spawnPickup(state, random) {
  if (state.coins.length >= 18) return;
  const offset = Math.floor(random() * LANES.length);
  const z = -270;
  for (let i = 0; i < LANES.length; i++) {
    const lane = LANES[(offset + i) % LANES.length];
    const x = lane * LANE_WIDTH;
    if (state.enemies.some(enemy => Math.abs(enemy.x - x) < 3 && Math.abs(enemy.z - z) < 50)
      || state.coins.some(coin => Math.abs(coin.x - x) < 2 && Math.abs(coin.z - z) < 32)) continue;
    let kind = 'coin';
    const progress = state.totalDistance % 1000;
    const remainingSlots = Math.max(1, Math.floor((1000 - progress) / 16));
    if (state.currentLevelRocketsSpawned < 1 && progress > 120 && random() < 1 / remainingSlots) {
      kind = 'rocket';
      state.currentLevelRocketsSpawned++;
    } else if (state.currentLevelMagnetsSpawned < 2 && random() < (2 - state.currentLevelMagnetsSpawned) / remainingSlots) {
      kind = 'magnet';
      state.currentLevelMagnetsSpawned++;
    }
    state.coins.push({ id: `pickup-${state.nextEntityId++}`, x, z, kind });
    return;
  }
}

export function makeParticles(x, y, z, type, random = Math.random) {
  return Array.from({ length: type === 'explosion' ? 20 : 5 }, () => ({
    id: random(), type, x, y, z,
    vx: (random() - 0.5) * (type === 'explosion' ? 10 : 5),
    vy: random() * 5 + 3, vz: (random() - 0.5) * 8,
    life: 1, size: 0.3 + random() * 0.5,
  }));
}

export function applyPickup(state, pickup) {
  state.coins = state.coins.filter(coin => coin.id !== pickup.id);
  if (pickup.kind === 'magnet') {
    state.magnetActive = true;
    state.magnetRemaining = state.magnetDuration / 1000;
    state.message = 'MIKNATIS · 10 sn';
    state.messageRemaining = 1.5;
  } else if (pickup.kind === 'rocket') {
    state.rocketActive = true;
    state.rocketRemaining = state.rocketDuration / 1000;
    state.enemies = [];
    state.message = 'ROKET · 12 sn';
    state.messageRemaining = 1.5;
    state.isNitroActive = false;
  } else {
    // Preserve the established scoring rules.
    state.score += 100;
    state.coinsCollected++;
    state.message = '+100 PUAN · 1 JETON';
    state.messageRemaining = 0.6;
  }
}

export function awardNearMiss(state, position, random) {
  const multiplier = state.combo;
  state.score += 500 * multiplier;
  state.combo = Math.min(multiplier + 1, 10);
  state.nearMissCount++;
  state.message = `YAKIN GEÇİŞ · ×${multiplier}`;
  state.messageRemaining = 1;
  state.particles.push(...makeParticles(position.x, 1, position.z, 'spark', random));
}

// This function mutates only the newly-created snapshot supplied by the store.
// Arrays/objects shared with the previous Zustand snapshot are never mutated.
export function stepGameplay(state, delta, random, effects) {
  state.elapsedTime += delta;
  state.updateCounter++;
  state.messageRemaining = Math.max(0, state.messageRemaining - delta);
  if (!state.messageRemaining) state.message = '';
  state.cameraShake = Math.max(0, state.cameraShake - delta * 5);
  state.magnetRemaining = Math.max(0, state.magnetRemaining - delta);
  state.rocketRemaining = Math.max(0, state.rocketRemaining - delta);
  state.magnetActive = state.magnetRemaining > 0;
  state.rocketActive = state.rocketRemaining > 0;

  const tuning = state.runStats;
  const acceleration = tuning?.acceleration ?? 2;
  let targetSpeed = tuning?.cruiseSpeed ?? 110;
  if (state.isNitroActive && state.nitro > 0 && !state.rocketActive) {
    state.nitro = Math.max(0, state.nitro - delta * 25);
    targetSpeed = tuning?.boostSpeed ?? 200;
    if (!state.nitro) state.isNitroActive = false;
  } else {
    state.nitro = Math.min(state.maxNitro, state.nitro + delta * state.nitroRegenRate);
  }
  if (state.rocketActive) targetSpeed = state.rocketTargetSpeed;
  const oldSpeed = state.speed;
  state.targetSpeed = targetSpeed;
  state.speed = damp(oldSpeed, targetSpeed, acceleration, delta);
  const travel = targetSpeed * delta + (oldSpeed - targetSpeed) * (1 - Math.exp(-acceleration * delta)) / acceleration;
  state.score += travel * 0.2;
  state.totalDistance += travel * 0.1;

  const oldX = state.currentX;
  state.targetX = clamp(state.targetX + state.steeringInput * (tuning?.steeringRate ?? 15) * delta, -ROAD_LIMIT, ROAD_LIMIT);
  state.currentX = damp(oldX, state.targetX, tuning?.steeringResponse ?? 12, delta);
  state.steeringVelocity = (state.currentX - oldX) / delta;
  const nextLevel = Math.floor(state.totalDistance / 1000) + 1;
  if (nextLevel > state.currentLevel) {
    state.currentLevel = nextLevel;
    state.lastLevelUpDistance = state.totalDistance;
    state.currentLevelMagnetsSpawned = 0;
    state.currentLevelRocketsSpawned = 0;
    state.magnetLevelTracker = nextLevel;
    state.rocketLevelTracker = nextLevel;
    state.reachedLevel5 ||= nextLevel >= 5;
    state.message = nextLevel === 5 && state.gameMode === 'doubleOrNothing'
      ? 'SEVİYE 5 · SKOR ÇARPANI 2×' : `SEVİYE ${nextLevel}`;
    state.messageRemaining = 1.5;
  }

  state.particles = state.particles.filter(particle => particle.life > delta * 2).map(particle => ({
    ...particle, x: particle.x + particle.vx * delta,
    y: particle.y + particle.vy * delta, z: particle.z + particle.vz * delta,
    vy: particle.vy - 9.8 * delta, life: particle.life - delta * 2,
  })).slice(-70);

  const previousEnemies = state.rocketActive ? [] : state.enemies;
  const previousById = new Map(previousEnemies.map(enemy => [enemy.id, enemy]));
  const movedEnemies = updateTraffic(state, delta, travel, random);

  // Resolve a crash before rewards; a collision can never grant pickups or
  // a near-miss bonus in the same tick, and is emitted once per run.
  const playerDimensions = getPlayerDimensions(state.runCar);
  const crashIndex = movedEnemies.findIndex(enemy => {
    const previous = previousById.get(enemy.id);
    return previous && collisionWithPlayer(previous, enemy, oldX, state.currentX, playerDimensions);
  });
  if (crashIndex !== -1) {
    state.enemies = movedEnemies;
    state.gameState = 'gameover';
    state.gameOver = true;
    state.isNitroActive = false;
    state.steeringInput = 0;
    state.crashSpeed = state.speed;
    state.speed = 0;
    state.targetSpeed = 0;
    state.cameraShake = 3;
    state.particles.push(...makeParticles(state.currentX, 1, PLAYER_Z, 'explosion', random));
    effects.push('crash');
    return;
  }
  movedEnemies.forEach(enemy => {
    const previous = previousById.get(enemy.id);
    if (!previous) return;
    const dimensions = VEHICLE_DIMENSIONS[enemy.type] || VEHICLE_DIMENSIONS.sedan;
    const clearanceZ = PLAYER_Z + contactHalfExtent(playerDimensions.length, dimensions.length);
    const crashWidth = contactHalfExtent(playerDimensions.width, dimensions.width);
    const lateralDistance = Math.abs(enemy.x - state.currentX);
    if (!enemy.passed && previous.z <= clearanceZ && enemy.z > clearanceZ) {
      enemy.passed = true;
      if (lateralDistance >= crashWidth + 0.3 && lateralDistance < crashWidth + 1.2) {
        awardNearMiss(state, enemy, random);
        effects.push('nearMiss');
      }
    }
  });
  state.enemies = movedEnemies.filter(enemy => enemy.z < 45 && enemy.z > -600);

  const collected = [];
  state.coins = state.coins.map(coin => {
    let x = coin.x;
    let z = coin.z + travel * 0.5;
    // Magnet attracts gold only, within visible reach. Powerups stay on-road.
    if (state.magnetActive && (!coin.kind || coin.kind === 'coin') && coin.z > -100 && coin.z < PLAYER_Z) {
      x = damp(x, state.currentX, 8, delta);
      z = damp(z, PLAYER_Z, 7, delta);
    }
    const next = { ...coin, x, z };
    if (sweptOverlap(coin.x - oldX, coin.z - PLAYER_Z, x - state.currentX, z - PLAYER_Z, 2, 2.5)) collected.push(next);
    return next;
  }).filter(coin => coin.z < 45);
  collected.forEach(coin => {
    applyPickup(state, coin);
    effects.push('coin');
  });

  if (state.totalDistance >= state.nextPickupDistance) {
    spawnPickup(state, random);
    state.nextPickupDistance = state.totalDistance + 16;
  }
}
