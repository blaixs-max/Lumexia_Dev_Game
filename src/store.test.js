import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioSystem, createGameStore } from './store.js';
import { isTrafficPlacementSafe } from './utils/gameplay.js';

function seededRandom(seed = 3) {
  let value = seed;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function makePlaying(overrides = {}) {
  const store = createGameStore({ random: seededRandom(), now: () => 1_000_000 });
  store.setState({ gameState: 'playing', nextTrafficDistance: Infinity, nextPickupDistance: Infinity, ...overrides });
  return store;
}

function advance(store, seconds, fps = 60) {
  for (let i = 0; i < Math.round(seconds * fps); i++) store.getState().updateGame(1 / fps);
}

const enemy = (overrides = {}) => ({
  id: 'traffic-test', lane: 0, targetLane: 0, x: 0, z: -100,
  ownSpeed: 50, type: 'sedan', passed: false, isChanging: false,
  changeProgress: 0, indicator: 0, laneDecisionRemaining: 100, ...overrides,
});

beforeEach(() => {
  vi.spyOn(audioSystem, 'setEnabled').mockImplementation(() => {});
  vi.spyOn(audioSystem, 'playCrash').mockImplementation(() => {});
  vi.spyOn(audioSystem, 'playCoin').mockImplementation(() => {});
  vi.spyOn(audioSystem, 'playNearMiss').mockImplementation(() => {});
});

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('race lifecycle', () => {
  it('starts free practice with no wallet or credit requirement and keeps the chosen rules', () => {
    const store = createGameStore();
    store.getState().setWalletData(null, 0);
    store.getState().startGame({ gameMode: 'doubleOrNothing', sessionType: 'ranked' });
    expect(store.getState()).toMatchObject({
      gameState: 'countdown', countdown: 3, sessionType: 'practice', isPractice: true,
      gameMode: 'doubleOrNothing', walletAddress: null, credits: 0,
    });
    advance(store, 3);
    expect(store.getState().countdown).toBe('GO!');
    advance(store, 0.35);
    expect(store.getState()).toMatchObject({ gameState: 'playing', countdown: null, elapsedTime: 0, credits: 0 });
  });

  it('cannot restart a quit race through an orphaned countdown callback', () => {
    vi.useFakeTimers();
    const store = createGameStore();
    store.getState().startGame();
    advance(store, 2);
    store.getState().quitGame();
    vi.advanceTimersByTime(30_000);
    advance(store, 10);
    expect(store.getState()).toMatchObject({ gameState: 'launcher', elapsedTime: 0, score: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses and resumes the countdown without skipping it', () => {
    const store = createGameStore();
    store.getState().startGame();
    advance(store, 1);
    const remaining = store.getState().countdownRemaining;
    store.getState().pauseGame();
    advance(store, 15);
    expect(store.getState().countdownRemaining).toBe(remaining);
    store.getState().resumeGame();
    expect(store.getState().gameState).toBe('countdown');
    advance(store, 2.35);
    expect(store.getState().gameState).toBe('playing');
  });

  it('freezes gameplay, notifications and powerups while paused and releases held input', () => {
    const store = makePlaying({ speed: 110, magnetRemaining: 8, magnetActive: true, rocketRemaining: 9, rocketActive: true, message: 'test', messageRemaining: 1 });
    store.getState().setSteeringInput(1);
    advance(store, 0.5);
    store.getState().pauseGame();
    const paused = store.getState();
    advance(store, 20);
    expect(store.getState()).toBe(paused);
    expect(paused).toMatchObject({ steeringInput: 0, isNitroActive: false });
    store.getState().resumeGame();
    advance(store, 0.5);
    expect(store.getState().elapsedTime).toBeCloseTo(1);
    expect(store.getState().rocketRemaining).toBeCloseTo(8);
    expect(store.getState().magnetRemaining).toBeCloseTo(7);
  });

  it('restarts with clean world state while retaining settings and selected mode', () => {
    const store = makePlaying({ score: 1000, currentX: 4, nitro: 2, magnetRemaining: 8, magnetActive: true, gameMode: 'doubleOrNothing', soundEnabled: false });
    store.getState().setGameOver();
    store.getState().startGame({ type: 'click' });
    expect(store.getState()).toMatchObject({ gameState: 'countdown', score: 0, currentX: 0, nitro: 100, magnetRemaining: 0, gameMode: 'doubleOrNothing', soundEnabled: false });
  });

  it('opens the garage with a clean world and returns to the main menu while retaining the build', () => {
    const store = makePlaying({ score: 1000, currentX: 4, coinsCollected: 10, magnetActive: true, magnetRemaining: 8, steeringInput: 1 });
    const { garageGold, selectedCar, garageOwnedCars, garageUpgrades } = store.getState();
    store.getState().openGarage();
    expect(store.getState()).toMatchObject({ gameState: 'garage', score: 0, currentX: 0, steeringInput: 0, coinsCollected: 0, magnetActive: false, garageGold, selectedCar, garageOwnedCars, garageUpgrades });
    advance(store, 10);
    expect(store.getState().gameState).toBe('garage');
    store.getState().quitGame();
    expect(store.getState().gameState).toBe('launcher');
    store.getState().quitGame('garage');
    expect(store.getState().gameState).toBe('garage');
    store.getState().quitGame({ type: 'click' });
    expect(store.getState().gameState).toBe('launcher');
  });
});

describe('fixed simulation', () => {
  it('matches steering, nitro, distance and scoring at 30, 60 and 144 fps', () => {
    const runs = [30, 60, 144].map(fps => {
      const store = makePlaying();
      store.getState().setSteeringInput(1);
      store.getState().activateNitro();
      advance(store, 1, fps);
      store.getState().setSteeringInput(-1);
      advance(store, 1, fps);
      return store.getState();
    });
    for (const key of ['speed', 'targetX', 'currentX', 'score', 'totalDistance', 'nitro', 'elapsedTime']) {
      expect(runs[0][key]).toBeCloseTo(runs[1][key], 10);
      expect(runs[2][key]).toBeCloseTo(runs[1][key], 10);
    }
    expect(runs[0].score).toBeCloseTo(runs[0].totalDistance * 2, 10);
  });

  it('produces identical traffic and pickups across frame rates with the same seed', () => {
    const runs = [30, 144].map(fps => {
      const store = makePlaying({ nextTrafficDistance: 7, nextPickupDistance: 4 });
      advance(store, 4, fps);
      return store.getState();
    });
    expect(runs[0].enemies).toEqual(runs[1].enemies);
    expect(runs[0].coins).toEqual(runs[1].coins);
    expect(runs[0].enemies.length).toBeGreaterThan(0);
  });

  it('ignores invalid deltas and clamps a returning-tab time spike', () => {
    const store = makePlaying();
    for (const delta of [NaN, Infinity, -1, 0]) store.getState().updateGame(delta);
    expect(store.getState().elapsedTime).toBe(0);
    store.getState().updateGame(300);
    expect(store.getState().elapsedTime).toBeCloseTo(0.1);
    expect(store.getState().currentX).toBe(0);
  });

  it('does not mutate prior snapshots when moving traffic and particles', () => {
    const store = makePlaying({ enemies: [enemy()], particles: [{ id: 'spark', type: 'spark', x: 0, y: 1, z: 0, vx: 1, vy: 2, vz: 0, life: 1 }] });
    const before = store.getState();
    store.getState().updateGame(1 / 60);
    expect(before.enemies[0].z).toBe(-100);
    expect(before.particles[0].life).toBe(1);
    expect(store.getState().enemies[0]).not.toBe(before.enemies[0]);
  });
});

describe('level traffic progression', () => {
  function simulateTraffic(level, seed, seconds = 60) {
    const distance = (level - 1) * 1000;
    const store = createGameStore({ random: seededRandom(seed), now: () => 1_000_000 });
    store.setState({
      gameState: 'playing', speed: 110, elapsedTime: 3,
      totalDistance: distance, currentLevel: level,
      nextTrafficDistance: distance, nextPickupDistance: Infinity,
    });
    let spawned = 0;
    let activeSamples = 0;
    let peak = 0;
    let samples = 0;
    const placedIds = new Set();
    for (let frame = 0; frame < seconds * 120; frame++) {
      // Measure approaching traffic without an artificial crash ending the
      // sample. Remove vehicles only after they leave the observation area;
      // keep spawn placement, movement and lane decisions fully simulated.
      store.setState(state => ({ enemies: state.enemies.filter(car => car.z < -20) }));
      store.getState().updateGame(1 / 120);
      const state = store.getState();
      expect(state.gameOver).toBe(false);
      for (const car of state.enemies) {
        if (placedIds.has(car.id)) continue;
        placedIds.add(car.id);
        spawned++;
        expect(isTrafficPlacementSafe(car, state.enemies, [110, 200, state.rocketTargetSpeed])).toBe(true);
      }
      peak = Math.max(peak, state.enemies.length);
      if (frame >= 10 * 120) {
        activeSamples += state.enemies.length;
        samples++;
      }
    }
    return { spawned, peak, active: activeSamples / samples };
  }

  it('makes levels three and five visibly busier while retaining safe passing gaps across seeds', () => {
    for (const seed of [3, 17, 101, 2026]) {
      const easy = simulateTraffic(1, seed);
      const medium = simulateTraffic(3, seed);
      const hard = simulateTraffic(5, seed);
      expect(medium.spawned).toBeGreaterThan(easy.spawned * 1.5);
      expect(hard.spawned).toBeGreaterThan(medium.spawned * 1.4);
      expect(medium.active).toBeGreaterThan(easy.active * 1.5);
      expect(hard.active).toBeGreaterThan(medium.active * 1.4);
      expect(hard.peak).toBeLessThanOrEqual(12);
    }
  });

  it('bounds late-game density instead of growing without limit', () => {
    for (const seed of [3, 101]) {
      const busy = simulateTraffic(8, seed);
      const late = simulateTraffic(80, seed);
      expect(late.spawned).toBeGreaterThanOrEqual(busy.spawned - 1);
      expect(late.spawned).toBeLessThanOrEqual(busy.spawned + 1);
      expect(late.active).toBeCloseTo(busy.active, 1);
      expect(late.peak).toBeLessThanOrEqual(12);
    }
  });

  it('produces the same dense traffic at 30, 60 and 144 fps', () => {
    const runs = [30, 60, 144].map(fps => {
      const store = makePlaying({
        speed: 110, elapsedTime: 3, currentLevel: 5,
        totalDistance: 4000, nextTrafficDistance: 4000,
      });
      advance(store, 8, fps);
      return store.getState();
    });
    expect(runs[0].enemies.length).toBeGreaterThanOrEqual(4);
    expect(runs[0].enemies).toEqual(runs[1].enemies);
    expect(runs[2].enemies).toEqual(runs[1].enemies);
    expect(runs[0].nextTrafficDistance).toBeCloseTo(runs[2].nextTrafficDistance, 10);
  });

  it('retries a blocked spawn after the obstruction clears without violating lane reservations', () => {
    const store = makePlaying({
      speed: 110, elapsedTime: 3, nextTrafficDistance: 0,
      enemies: [enemy({ id: 'left', lane: -1, targetLane: -1, x: -4.5, z: -300 }), enemy({ id: 'right', lane: 1, targetLane: 1, x: 4.5, z: -300 })],
    });
    advance(store, 0.1);
    expect(store.getState().enemies).toHaveLength(2);
    store.setState({ enemies: [] });
    advance(store, 0.1);
    expect(store.getState().enemies).toHaveLength(1);
    expect(store.getState().totalDistance).toBeLessThan(29);
  });
});

describe('collisions and rewards', () => {
  it('does not sweep an exiting NPC into a different distant NPC after filtering', () => {
    const store = makePlaying({ speed: 110, enemies: [enemy({ id: 'exiting', z: 44.99 }), enemy({ id: 'distant', z: -80 })] });
    store.getState().updateGame(1 / 120);
    expect(store.getState()).toMatchObject({ gameState: 'playing', gameOver: false });
    expect(store.getState().enemies.map(car => car.id)).toEqual(['distant']);
  });

  it('matches cars by id when a passed NPC is removed before an approaching collision', () => {
    const store = makePlaying({
      speed: 200,
      enemies: [enemy({ id: 'removed', x: 4.5, lane: 1, targetLane: 1, z: 44.9 }), enemy({ id: 'contact', z: -7.8 })],
    });
    store.getState().updateGame(1 / 30);
    expect(store.getState()).toMatchObject({ gameState: 'gameover' });
    expect(store.getState().enemies.map(car => car.id)).toEqual(['contact']);
  });

  it('uses the car locked into the race rather than a shared full-length player box', () => {
    const approachingTruck = enemy({ type: 'truck', z: -7.1, ownSpeed: 110 });
    const apex = makePlaying({ runCar: 'apex', selectedCar: 'default', speed: 110, enemies: [approachingTruck] });
    const sport = makePlaying({ runCar: 'default', selectedCar: 'apex', speed: 110, enemies: [approachingTruck] });
    apex.getState().updateGame(1 / 120);
    sport.getState().updateGame(1 / 120);
    expect(apex.getState().gameState).toBe('playing');
    expect(sport.getState().gameState).toBe('gameover');
  });

  it('leaves visible side clearance safe throughout a boosted pass at every frame rate', () => {
    for (const fps of [30, 60, 144]) {
      const store = makePlaying({
        runCar: 'apex', speed: 225, isNitroActive: true,
        runStats: { cruiseSpeed: 128, boostSpeed: 225, acceleration: 2.5 },
        enemies: [enemy({ type: 'suv', x: 2.5, z: -24, ownSpeed: 51 })],
      });
      advance(store, 0.5, fps);
      expect(store.getState().gameState).toBe('playing');
      expect(store.getState().enemies[0].z).toBeGreaterThan(4);
    }
    expect(audioSystem.playCrash).not.toHaveBeenCalled();
  });

  it('still catches a real boosted collision at the same instant at 30, 60 and 144 fps', () => {
    const runs = [30, 60, 144].map(fps => {
      const store = makePlaying({
        runCar: 'apex', speed: 225, isNitroActive: true,
        runStats: { cruiseSpeed: 128, boostSpeed: 225, acceleration: 2.5 },
        enemies: [enemy({ type: 'truck', z: -24, ownSpeed: 42 })],
      });
      advance(store, 0.5, fps);
      return store.getState();
    });
    for (const run of runs) {
      expect(run.gameState).toBe('gameover');
      expect(run.crashSpeed).toBeCloseTo(225, 10);
      expect(run.elapsedTime).toBeCloseTo(runs[0].elapsedTime, 10);
      expect(run.score).toBeCloseTo(runs[0].score, 10);
    }
    expect(audioSystem.playCrash).toHaveBeenCalledTimes(3);
  });

  it('emits a single crash and never awards a simultaneous pickup', () => {
    const store = makePlaying({ speed: 200, enemies: [enemy({ z: -8 })], coins: [{ id: 'gold', x: 0, z: -2, kind: 'coin' }] });
    store.getState().updateGame(0.1);
    expect(store.getState()).toMatchObject({ gameState: 'gameover', coinsCollected: 0, nearMissCount: 0 });
    const finalScore = store.getState().score;
    store.getState().setGameOver();
    store.getState().collectCoin('gold');
    advance(store, 1);
    expect(store.getState().score).toBe(finalScore);
    expect(audioSystem.playCrash).toHaveBeenCalledTimes(1);
  });

  it('awards a close pass only once, after the whole car has cleared', () => {
    const store = makePlaying({ speed: 110, enemies: [enemy({ x: 3.3, z: 2, ownSpeed: 50, lane: 1, targetLane: 1 })] });
    advance(store, 0.1);
    expect(store.getState()).toMatchObject({ nearMissCount: 1, combo: 2, gameState: 'playing' });
    advance(store, 0.5);
    expect(store.getState().nearMissCount).toBe(1);
    expect(store.getState().score - store.getState().totalDistance * 2).toBeCloseTo(500);
  });

  it('collects a gold coin once and refuses nonexistent or wrong-kind pickups', () => {
    const store = makePlaying({ coins: [{ id: 'gold', kind: 'coin', x: 0, z: -2 }] });
    store.getState().collectRocket('gold');
    expect(store.getState().rocketActive).toBe(false);
    store.getState().collectCoin('gold');
    store.getState().collectCoin('gold');
    store.getState().collectCoin('missing');
    expect(store.getState()).toMatchObject({ score: 100, coinsCollected: 1, coins: [] });
    expect(audioSystem.playCoin).toHaveBeenCalledTimes(1);
  });

  it('attracts visible gold without pulling a rocket or magnet off its lane', () => {
    const store = makePlaying({ speed: 110, magnetActive: true, magnetRemaining: 8, coins: [
      { id: 'gold', kind: 'coin', x: 4.5, z: -50 },
      { id: 'rocket', kind: 'rocket', x: 4.5, z: -50 },
      { id: 'magnet', kind: 'magnet', x: 4.5, z: -50 },
    ] });
    store.getState().updateGame(0.1);
    expect(store.getState().coins.find(coin => coin.id === 'gold').x).toBeLessThan(4.5);
    expect(store.getState().coins.find(coin => coin.id === 'rocket').x).toBe(4.5);
    expect(store.getState().coins.find(coin => coin.id === 'magnet').x).toBe(4.5);
  });

  it('clears traffic during rocket and gives a visible approach after it expires', () => {
    const store = makePlaying({ speed: 110, nextTrafficDistance: 0, enemies: [enemy()], coins: [{ id: 'rocket', kind: 'rocket', x: 0, z: -2 }] });
    store.getState().collectRocket('rocket');
    expect(store.getState().enemies).toEqual([]);
    advance(store, 1);
    expect(store.getState().enemies).toEqual([]);
    store.setState({ rocketRemaining: 0.01, nextTrafficDistance: 0 });
    advance(store, 0.1);
    expect(store.getState().rocketActive).toBe(false);
    expect(store.getState().enemies).toHaveLength(1);
    expect(store.getState().enemies.every(car => car.z < -180)).toBe(true);
  });

  it('preserves the level-five Double or Nothing unlock', () => {
    const store = makePlaying({ gameMode: 'doubleOrNothing', totalDistance: 3999.5, currentLevel: 4, speed: 110 });
    advance(store, 0.1);
    expect(store.getState()).toMatchObject({ currentLevel: 5, reachedLevel5: true });
    expect(store.getState().message).toContain('2×');
  });
});
