import { describe, expect, it } from 'vitest';
import { VEHICLE_DIMENSIONS } from './vehicleDimensions.js';
import { hasPassingCorridor, isTrafficPlacementSafe, LANE_CHANGE_DURATION, occupiedLanes, passingWindow, PLAYER_Z, SIGNAL_DURATION, updateTraffic } from './traffic.js';

const car = (id, lane, z, ownSpeed = 55, extras = {}) => ({
  id, lane, targetLane: lane, x: lane * 4.5, z, ownSpeed, type: 'sedan',
  isChanging: false, indicator: 0, changeProgress: 0, signalRemaining: 0,
  laneDecisionRemaining: 100, ...extras,
});
function randomFrom(seed) {
  let value = seed;
  return () => { value = value * 16807 % 2147483647; return (value - 1) / 2147483646; };
}
function fixture(overrides = {}) {
  return {
    enemies: [], speed: 110, elapsedTime: 3, totalDistance: 7000,
    currentLevel: 8, nextTrafficDistance: Infinity, nextEntityId: 1,
    rocketActive: false, rocketTargetSpeed: 235,
    runStats: { cruiseSpeed: 110, boostSpeed: 225 }, ...overrides,
  };
}
function tick(state, dt, random) {
  const travel = state.speed * dt;
  state.elapsedTime += dt;
  state.totalDistance += travel * 0.1;
  updateTraffic(state, dt, travel, random);
}
function arrivalWall(enemies, speed) {
  const approaching = enemies.filter(item => item.z < PLAYER_Z - 10).map(item => ({
    car: item, eta: (PLAYER_Z - item.z) / Math.max(10, (speed - (item.actualSpeed ?? item.ownSpeed)) * 0.5),
  })).sort((a, b) => a.eta - b.eta);
  for (let i = 0; i < approaching.length; i++) {
    const blocked = new Set();
    for (let j = i; j < approaching.length && approaching[j].eta - approaching[i].eta < 1.15; j++) {
      occupiedLanes(approaching[j].car).forEach(lane => blocked.add(lane));
      if (blocked.size === 3) return true;
    }
  }
  return false;
}
function validateTraffic(state) {
  for (let i = 0; i < state.enemies.length; i++) for (let j = i + 1; j < state.enemies.length; j++) {
    const a = state.enemies[i], b = state.enemies[j];
    const ad = VEHICLE_DIMENSIONS[a.type], bd = VEHICLE_DIMENSIONS[b.type];
    if (Math.abs(a.x - b.x) < (ad.width + bd.width) / 2 && Math.abs(a.z - b.z) < (ad.length + bd.length) / 2) {
      throw new Error(`NPC body overlap: ${JSON.stringify({ a, b })}`);
    }
  }
  const speeds = [110, 225, 235];
  if (!hasPassingCorridor(state.enemies, speeds)) throw new Error(`Spatial wall: ${JSON.stringify(state.enemies)}`);
  for (const speed of speeds) if (arrivalWall(state.enemies, speed)) throw new Error(`Arrival wall at ${speed}: ${JSON.stringify(state.enemies)}`);
}

describe('moving traffic', () => {
  it('advances an NPC against the moving road instead of leaving it parked in world space', () => {
    const state = fixture({ enemies: [car('moving', 0, -100)] });
    const before = state.enemies;
    tick(state, 0.1, () => 0.5);
    const relativeTravel = state.enemies[0].z + 100;
    const roadTravel = 110 * 0.1 * 0.5;
    expect(relativeTravel).toBeCloseTo(2.75);
    expect(roadTravel - relativeTravel).toBeCloseTo(55 * 0.1 * 0.5);
    expect(before[0].z).toBe(-100);
  });

  it('brakes behind a slower leader without passing through its body', () => {
    const state = fixture({ enemies: [car('leader', 0, -90, 43), car('follower', 0, -60, 73)] });
    let closest = Infinity;
    let slowestFollower = 73;
    for (let frame = 0; frame < 8 * 120; frame++) {
      tick(state, 1 / 120, () => 0.9);
      const [leader, follower] = state.enemies;
      if (!leader || !follower) break;
      closest = Math.min(closest, follower.z - leader.z);
      slowestFollower = Math.min(slowestFollower, follower.actualSpeed);
      expect(follower.ownSpeed).toBe(73);
      expect(follower.actualSpeed).toBeLessThanOrEqual(73);
    }
    expect(closest).toBeGreaterThan(10);
    expect(slowestFollower).toBeLessThan(50);
  });

  it('signals before a smooth adjacent change at level one and keeps both lanes reserved', () => {
    const state = fixture({ currentLevel: 1, enemies: [car('change', 0, -260, 55, { laneDecisionRemaining: 0 })] });
    tick(state, 1 / 120, () => 0.1);
    expect(state.enemies[0]).toMatchObject({ indicator: -1, targetLane: -1, isChanging: false, x: 0 });
    for (let frame = 0; frame < Math.floor(SIGNAL_DURATION * 120) - 2; frame++) tick(state, 1 / 120, () => 0.1);
    expect(state.enemies[0].x).toBe(0);
    for (let frame = 0; frame < Math.ceil(LANE_CHANGE_DURATION * 120 / 2); frame++) tick(state, 1 / 120, () => 0.1);
    expect(state.enemies[0].x).toBeGreaterThan(-4.5);
    expect(state.enemies[0].x).toBeLessThan(-0.2);
    expect(occupiedLanes(state.enemies[0])).toEqual([0, -1]);
    for (let frame = 0; frame < 180; frame++) tick(state, 1 / 120, () => 0.1);
    expect(state.enemies[0]).toMatchObject({ lane: -1, indicator: 0, isChanging: false, x: -4.5 });
  });

  it('rejects a merge into a closing rear vehicle and a change that seals the final passing lane', () => {
    const candidate = car('changing', 0, -260, 43, { targetLane: -1, indicator: -1 });
    expect(isTrafficPlacementSafe(candidate, [car('rear', -1, -230, 90)])).toBe(false);
    expect(isTrafficPlacementSafe(candidate, [car('last-lane', 1, -245)])).toBe(false);
  });

  it('does not grant simultaneous competing lane reservations', () => {
    const state = fixture({ enemies: [car('first', -1, -280, 55, { laneDecisionRemaining: 0 }), car('second', 1, -280, 55, { laneDecisionRemaining: 0 })] });
    tick(state, 1 / 120, () => 0.1);
    expect(state.enemies.filter(item => item.indicator)).toHaveLength(0);
    validateTraffic(state);
  });

  it('rejects a mixed-speed future arrival wall that is spatially open right now', () => {
    const candidate = car('rear-fast', 1, -100, 73);
    const others = [car('front-slow', -1, -220, 40), car('middle', 0, -170, 55)];
    expect(hasPassingCorridor([...others, candidate], [110, 225, 235])).toBe(true);
    expect(arrivalWall([...others, candidate], 110)).toBe(true);
    expect(isTrafficPlacementSafe(candidate, others, [110, 225, 235])).toBe(false);
  });

  it('reserves enough road to move between successive opposite passing gaps', () => {
    const first = [car('first-left', -1, -300), car('first-center', 0, -300)];
    const second = [car('second-center', 0, -200), car('second-right', 1, -200)];
    expect(hasPassingCorridor([...first, ...second], [110, 225, 235])).toBe(false);
    expect(hasPassingCorridor([...first.map(npc => ({ ...npc, z: -450 })), ...second], [110, 225, 235])).toBe(true);
  });

  it('checks the boosted passing-window boundary rather than just three equal-z cars', () => {
    const speeds = [110, 225];
    const window = passingWindow(speeds);
    const others = [car('left', -1, -300), car('center', 0, -260)];
    expect(isTrafficPlacementSafe(car('too-close', 1, -300 + window - 0.01), others, speeds)).toBe(false);
    expect(isTrafficPlacementSafe(car('spaced', 1, -300 + window + 0.01), others, speeds)).toBe(true);
  });

  it('keeps long high-level traffic separated and passable across seeds and boost speeds', () => {
    let maneuvers = 0;
    let maximum = 0;
    for (const level of [1, 8, 80]) for (const seed of [3, 17, 101, 2026]) for (const speed of [110, 225, 235]) {
      const state = fixture({ speed, currentLevel: level, totalDistance: (level - 1) * 1000, nextTrafficDistance: 0 });
      const random = randomFrom(seed);
      const signaled = new Set();
      const completed = new Set();
      const visibleCompletions = new Set();
      for (let frame = 0; frame < 120 * 120; frame++) {
        tick(state, 1 / 120, random);
        validateTraffic(state);
        maximum = Math.max(maximum, state.enemies.length);
        for (const npc of state.enemies) if (npc.indicator && !signaled.has(npc.id)) { signaled.add(npc.id); maneuvers++; }
        for (const npc of state.enemies) if (signaled.has(npc.id) && !npc.indicator && !completed.has(npc.id)) {
          completed.add(npc.id);
          const distance = PLAYER_Z - npc.z;
          if (distance >= 70 && distance <= 160 && npc.changeProgress === 1) visibleCompletions.add(npc.id);
        }
      }
      expect(completed.size, `level ${level}, seed ${seed}, player ${speed}: recurring completed lane changes`).toBeGreaterThanOrEqual(4);
      if (speed === 110) expect(visibleCompletions.size, `level ${level}, seed ${seed}: cruise maneuvers visible at70–160 road distance`).toBeGreaterThanOrEqual(4);
    }
    expect(maneuvers).toBeGreaterThan(20);
    expect(maximum).toBeLessThanOrEqual(12);
  }, 30000);
});
