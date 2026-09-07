import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { audioSystem, createGameStore } from './store.js';

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

describe('collisions and rewards', () => {
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
    const store = makePlaying({ speed: 110, enemies: [enemy({ x: 3.4, z: 2, ownSpeed: 50, lane: 1, targetLane: 1 })] });
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
    store.setState({ nextTrafficDistance: 0 });
    advance(store, 0.1);
    expect(store.getState().enemies).toHaveLength(1);
    expect(store.getState().enemies.every(car => car.z < -180)).toBe(true);
  });

  it('preserves the level-five Double or Nothing unlock', () => {
    const store = makePlaying({ gameMode: 'doubleOrNothing', totalDistance: 3999.5, currentLevel: 4, speed: 110 });
    advance(store, 0.1);
    expect(store.getState()).toMatchObject({ currentLevel: 5, reachedLevel5: true });
    expect(store.getState().message).toContain('2X BONUS');
  });
});
