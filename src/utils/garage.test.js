import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARS, GARAGE_KEY, MAX_GOLD, STARTER_GOLD, calculateRunGold, getCarStats, getUpgradeCost, readGarage, sanitizeGarage } from './garage';
import { audioSystem, createGameStore } from '../store';

let data;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
  vi.spyOn(audioSystem, 'setEnabled').mockImplementation(() => {});
  vi.spyOn(audioSystem, 'playCrash').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function buyStages(store, part, count) {
  for (let stage = 0; stage < count; stage++) expect(store.getState().purchaseUpgrade(part).success).toBe(true);
}

const existingCarIds = ['default', 'gt', 'apex'];
const newCars = CARS.filter(car => !existingCarIds.includes(car.id));

describe('local garage and race loadouts', () => {
  it('migrates old builds without losing equipped levels and recovers corrupt saves', () => {
    expect(readGarage({ getItem: () => '{broken' })).toMatchObject({ selectedCar: 'default', ownedCars: ['default'], gold: STARTER_GOLD, schemaVersion: 3 });
    const safe = sanitizeGarage({ selectedCar: 'missing', upgrades: { apex: { engine: 99, nitro: -1, handling: '3' } } });
    expect(safe.upgrades.apex).toEqual({ engine: 3, nitro: 0, handling: 0 });
    expect(Object.keys(safe.upgrades)).toHaveLength(CARS.length);
    data.set(GARAGE_KEY, JSON.stringify({ selectedCar: 'apex', upgrades: { apex: { engine: 2, handling: 1, nitro: 3 } } }));
    const store = createGameStore();
    expect(store.getState()).toMatchObject({ selectedCar: 'apex', garageOwnedCars: ['default', 'apex'], garageGold: STARTER_GOLD, garageUpgrades: { apex: { engine: 2, handling: 1, nitro: 3 } } });
    store.getState().openGarage();
    store.getState().selectCar('default');
    expect(JSON.parse(data.get(GARAGE_KEY))).toMatchObject({ schemaVersion: 3, ownedCars: ['default', 'apex'], gold: STARTER_GOLD, upgrades: { apex: { engine: 2, handling: 1, nitro: 3 } } });
    store.getState().selectCar('gt');
    expect(store.getState().selectedCar).toBe('default');
  });

  it.each([undefined, 1, 2])('preserves selected and tuned vehicles when migrating legacy schema %s', schemaVersion => {
    const migrated = sanitizeGarage({ schemaVersion, selectedCar: 'gt', gold: 72, upgrades: { apex: { nitro: 1 } } });
    expect(migrated).toMatchObject({ schemaVersion: 3, selectedCar: 'gt', gold: 72, ownedCars: ['default', 'gt', 'apex'], upgrades: { apex: { nitro: 1 } } });
    expect(sanitizeGarage({ schemaVersion, selectedCar: 'default' }).ownedCars).toEqual(['default']);
  });

  it('normalizes current ownership and refuses an unowned selection or equipped build', () => {
    const safe = sanitizeGarage({ schemaVersion: 3, ownedCars: ['gt', 'missing', 'gt', '__proto__'], selectedCar: 'apex', upgrades: { apex: { engine: 3 }, gt: { nitro: 2 } } });
    expect(safe).toMatchObject({ selectedCar: 'default', ownedCars: ['default', 'gt'], upgrades: { apex: { engine: 0 }, gt: { nitro: 2 } } });
    expect(sanitizeGarage({ schemaVersion: 3, ownedCars: 'apex', selectedCar: 'apex' }).ownedCars).toEqual(['default']);
    expect(sanitizeGarage({ schemaVersion: 99, ownedCars: ['apex'], selectedCar: 'apex' }).selectedCar).toBe('default');
  });

  it('extends a current save with locked stock cars while preserving existing purchases, builds and gold', () => {
    const previousSave = {
      schemaVersion: 3,
      gold: 158,
      selectedCar: 'apex',
      ownedCars: ['default', 'apex'],
      upgrades: {
        default: { engine: 1, handling: 0, nitro: 1 },
        apex: { engine: 3, handling: 1, nitro: 3 },
      },
    };
    data.set(GARAGE_KEY, JSON.stringify(previousSave));
    const restored = createGameStore();
    expect(restored.getState()).toMatchObject({
      selectedCar: 'apex', garageGold: 158, garageOwnedCars: ['default', 'apex'],
      garageUpgrades: previousSave.upgrades,
    });
    expect(newCars).toHaveLength(3);
    restored.getState().openGarage();
    for (const car of newCars) {
      expect(restored.getState().garageUpgrades[car.id]).toEqual({ engine: 0, handling: 0, nitro: 0 });
      restored.getState().selectCar(car.id);
      expect(restored.getState().selectedCar).toBe('apex');
      expect(restored.getState().purchaseCar(car.id)).toEqual({ success: false, reason: 'insufficient-gold', cost: car.price });
    }
    expect(restored.getState().garageGold).toBe(158);
    expect(data.get(GARAGE_KEY)).toBe(JSON.stringify(previousSave));
  });

  it('keeps all replacement vehicle purchases and individual builds under their original save IDs', () => {
    const builds = {
      rally: { engine: 1, handling: 3, nitro: 2 },
      street: { engine: 2, handling: 1, nitro: 3 },
      formula: { engine: 3, handling: 2, nitro: 1 },
    };
    data.set(GARAGE_KEY, JSON.stringify({
      schemaVersion: 3, gold: 47, selectedCar: 'formula',
      ownedCars: ['default', 'rally', 'street', 'formula'], upgrades: builds,
    }));
    const store = createGameStore();
    expect(store.getState()).toMatchObject({
      selectedCar: 'formula', garageGold: 47,
      garageOwnedCars: ['default', 'rally', 'street', 'formula'], garageUpgrades: builds,
    });
    for (const id of ['rally', 'street', 'formula']) {
      store.getState().openGarage();
      expect(store.getState().purchaseCar(id)).toEqual({ success: false, reason: 'already-owned' });
      store.getState().selectCar(id);
      store.getState().startGame();
      expect(store.getState()).toMatchObject({ runCar: id, runStats: builds[id], garageGold: 47 });
    }
    expect(JSON.parse(data.get(GARAGE_KEY))).toMatchObject({
      selectedCar: 'formula', gold: 47, upgrades: builds,
      ownedCars: ['default', 'rally', 'street', 'formula'],
    });
  });

  it.each(newCars)('buys $name with earned gold once and races its independently upgraded loadout after reload', car => {
    const originalBuild = { engine: 2, handling: 1, nitro: 0 };
    data.set(GARAGE_KEY, JSON.stringify({
      schemaVersion: 3, gold: car.price - 1, selectedCar: 'default', ownedCars: ['default'],
      upgrades: { default: originalBuild },
    }));
    const store = createGameStore();
    store.getState().openGarage();
    expect(store.getState().purchaseCar(car.id)).toEqual({ success: false, reason: 'insufficient-gold', cost: car.price });
    expect(store.getState().garageGold).toBe(car.price - 1);

    // One completed ten-meter run earns the missing gold through the real reward action.
    store.getState().startGame();
    store.setState({ gameState: 'playing', totalDistance: 10 });
    store.getState().setGameOver();
    store.getState().openGarage();
    expect(store.getState().purchaseCar(car.id)).toEqual({ success: true, cost: car.price });
    expect(store.getState()).toMatchObject({ selectedCar: car.id, garageGold: 0, garageOwnedCars: ['default', car.id] });
    const purchaseSave = data.get(GARAGE_KEY);
    expect(store.getState().purchaseCar(car.id)).toEqual({ success: false, reason: 'already-owned' });
    expect(data.get(GARAGE_KEY)).toBe(purchaseSave);

    // Earn the upgrade budget, keeping the existing car's tune separate.
    store.getState().startGame();
    store.setState({ gameState: 'playing', coinsCollected: 36 });
    store.getState().setGameOver();
    store.getState().openGarage();
    buyStages(store, 'engine', 1);
    buyStages(store, 'handling', 1);
    buyStages(store, 'nitro', 1);
    const restored = createGameStore();
    expect(restored.getState()).toMatchObject({
      selectedCar: car.id, garageGold: 0, garageOwnedCars: ['default', car.id],
      garageUpgrades: { default: originalBuild, [car.id]: { engine: 1, handling: 1, nitro: 1 } },
    });
    restored.getState().startGame();
    expect(restored.getState()).toMatchObject({
      runCar: car.id,
      runStats: {
        cruiseSpeed: car.cruise + 4, boostSpeed: car.boost + 5,
        acceleration: car.acceleration + 0.2, steeringRate: car.steering + 0.8,
        steeringResponse: car.response + 1, maxNitro: car.capacity + 15,
        nitroRegenRate: car.regen + 0.75, engine: 1, handling: 1, nitro: 1,
      },
      nitro: car.capacity + 15, maxNitro: car.capacity + 15,
    });
    restored.getState().selectCar('default');
    expect(restored.getState().purchaseCar('gt')).toEqual({ success: false, reason: 'not-in-garage' });
    expect(restored.getState().purchaseUpgrade('engine')).toEqual({ success: false, reason: 'not-in-garage' });
    expect(restored.getState().runCar).toBe(car.id);
    expect(restored.getState().runStats.engine).toBe(1);
    restored.getState().openGarage();
    restored.getState().selectCar('default');
    restored.getState().startGame();
    expect(restored.getState()).toMatchObject({ runCar: 'default', runStats: { engine: 2, handling: 1, nitro: 0 } });
    expect(restored.getState().garageUpgrades[car.id]).toEqual({ engine: 1, handling: 1, nitro: 1 });
  });

  it('starts with one owned vehicle and charges once when buying and selecting a new car', () => {
    const store = createGameStore();
    expect(store.getState()).toMatchObject({ selectedCar: 'default', garageOwnedCars: ['default'], garageGold: STARTER_GOLD });
    expect(store.getState().purchaseCar('gt')).toEqual({ success: false, reason: 'not-in-garage' });
    store.getState().openGarage();
    store.getState().selectCar('gt');
    store.getState().selectCar('__proto__');
    expect(store.getState().selectedCar).toBe('default');
    expect(store.getState().purchaseCar('missing')).toEqual({ success: false, reason: 'invalid-car' });
    expect(store.getState().purchaseCar('apex')).toEqual({ success: false, reason: 'insufficient-gold', cost: 3000 });
    expect(store.getState().garageGold).toBe(STARTER_GOLD);
    expect(store.getState().purchaseCar('gt')).toEqual({ success: true, cost: 1250 });
    expect(store.getState()).toMatchObject({ selectedCar: 'gt', garageOwnedCars: ['default', 'gt'], garageGold: 250 });
    const saved = data.get(GARAGE_KEY);
    expect(store.getState().purchaseCar('gt')).toEqual({ success: false, reason: 'already-owned' });
    expect(store.getState().purchaseCar('default')).toEqual({ success: false, reason: 'already-owned' });
    expect(data.get(GARAGE_KEY)).toBe(saved);
    const restored = createGameStore();
    expect(restored.getState()).toMatchObject({ selectedCar: 'gt', garageOwnedCars: ['default', 'gt'], garageGold: 250 });
    restored.getState().openGarage();
    restored.setState({ garageGold: 3000 });
    expect(restored.getState().purchaseCar('apex')).toEqual({ success: true, cost: 3000 });
    expect(restored.getState().garageGold).toBe(0);
    expect(createGameStore().getState().garageOwnedCars).toEqual(['default', 'gt', 'apex']);
  });

  it('can buy a car without replacing the selected build until the player explicitly selects it', () => {
    data.set(GARAGE_KEY, JSON.stringify({
      schemaVersion: 3, gold: 2000, selectedCar: 'default', ownedCars: ['default'],
      upgrades: { default: { engine: 2, handling: 1, nitro: 3 } },
    }));
    const store = createGameStore();
    store.getState().openGarage();
    const beforePurchase = store.getState();
    expect(store.getState().purchaseCar('gt', { selectOnPurchase: false })).toEqual({ success: true, cost: 1250 });
    expect(store.getState()).toMatchObject({ selectedCar: 'default', garageGold: 750, garageOwnedCars: ['default', 'gt'] });
    expect(beforePurchase.garageGold).toBe(2000);
    expect(beforePurchase.garageOwnedCars).toEqual(['default']);
    expect(store.getState().garageUpgrades).toBe(beforePurchase.garageUpgrades);
    const purchaseSave = data.get(GARAGE_KEY);
    expect(store.getState().purchaseCar('gt', { selectOnPurchase: false })).toEqual({ success: false, reason: 'already-owned' });
    expect(data.get(GARAGE_KEY)).toBe(purchaseSave);

    const restored = createGameStore();
    expect(restored.getState()).toMatchObject({ selectedCar: 'default', garageGold: 750, garageOwnedCars: ['default', 'gt'] });
    restored.getState().startGame();
    expect(restored.getState()).toMatchObject({ runCar: 'default', runStats: { engine: 2, handling: 1, nitro: 3 } });
    restored.getState().openGarage();
    restored.getState().selectCar('gt');
    restored.getState().startGame();
    expect(restored.getState()).toMatchObject({ runCar: 'gt', garageGold: 750, runStats: { engine: 0, handling: 0, nitro: 0 } });
    expect(restored.getState().garageUpgrades.default).toEqual({ engine: 2, handling: 1, nitro: 3 });
    expect(createGameStore().getState().selectedCar).toBe('gt');
  });

  it('keeps purchase-only attempts atomic when funds are insufficient or a race is active', () => {
    const store = createGameStore();
    store.getState().openGarage();
    store.setState({ garageGold: 1249 });
    const beforeFailure = store.getState();
    expect(store.getState().purchaseCar('gt', { selectOnPurchase: false })).toEqual({ success: false, reason: 'insufficient-gold', cost: 1250 });
    expect(store.getState()).toBe(beforeFailure);
    expect(data.has(GARAGE_KEY)).toBe(false);
    store.setState({ garageGold: 5000 });
    store.getState().startGame();
    for (const gameState of ['countdown', 'playing', 'paused', 'gameover', 'launcher']) {
      store.setState({ gameState });
      const locked = store.getState();
      expect(store.getState().purchaseCar('gt', { selectOnPurchase: false })).toEqual({ success: false, reason: 'not-in-garage' });
      expect(store.getState()).toBe(locked);
    }
    expect(store.getState()).toMatchObject({ selectedCar: 'default', runCar: 'default', garageGold: 5000, garageOwnedCars: ['default'] });
    expect(data.has(GARAGE_KEY)).toBe(false);
  });

  it('bounds saved gold to finite nonnegative integers while preserving an empty wallet', () => {
    expect(sanitizeGarage({ gold: 0 }).gold).toBe(0);
    expect(sanitizeGarage({ gold: -100 }).gold).toBe(0);
    expect(sanitizeGarage({ gold: 123.9 }).gold).toBe(123);
    expect(sanitizeGarage({ gold: Number.MAX_VALUE }).gold).toBe(MAX_GOLD);
    for (const gold of [NaN, Infinity, '4000', null, undefined]) expect(sanitizeGarage({ gold }).gold).toBe(STARTER_GOLD);
  });

  it('charges the next stage, auto-equips it and persists separate car builds and balance', () => {
    data.set(GARAGE_KEY, JSON.stringify({ schemaVersion: 3, selectedCar: 'apex', ownedCars: ['default', 'gt', 'apex'], gold: STARTER_GOLD }));
    const store = createGameStore();
    store.getState().openGarage();
    const snapshots = [];
    store.subscribe(state => snapshots.push({ gold: state.garageGold, level: state.garageUpgrades.apex.nitro }));
    store.getState().selectCar('apex');
    expect(store.getState().purchaseUpgrade('nitro')).toEqual({ success: true, cost: 350, level: 1 });
    expect(snapshots.at(-1)).toEqual({ gold: 1150, level: 1 });
    store.getState().selectCar('gt');
    buyStages(store, 'engine', 2);
    const restored = createGameStore();
    expect(restored.getState()).toMatchObject({ selectedCar: 'gt', garageGold: 200, garageUpgrades: { apex: { nitro: 1 }, gt: { engine: 2 } } });
    expect(JSON.parse(data.get(GARAGE_KEY))).toMatchObject({ gold: 200, schemaVersion: 3, ownedCars: ['default', 'gt', 'apex'] });
    restored.getState().startGame();
    expect(restored.getState()).toMatchObject({ runCar: 'gt', runStats: { cruiseSpeed: 113, engine: 2 }, nitro: 125 });
    restored.getState().selectCar('apex');
    expect(restored.getState().purchaseUpgrade('engine')).toMatchObject({ success: false, reason: 'not-in-garage' });
    expect(restored.getState().selectedCar).toBe('gt');
    expect(restored.getState().garageGold).toBe(200);
    expect(restored.getState().runStats.engine).toBe(2);
  });

  it('refuses insufficient funds, invalid parts and upgrades beyond stage three', () => {
    const store = createGameStore();
    store.getState().openGarage();
    store.setState({ garageGold: 300 });
    expect(store.getState().purchaseUpgrade('engine')).toEqual({ success: true, cost: 300, level: 1 });
    const saved = data.get(GARAGE_KEY);
    expect(store.getState().purchaseUpgrade('engine')).toMatchObject({ success: false, reason: 'insufficient-gold', cost: 650 });
    expect(store.getState().purchaseUpgrade('__proto__')).toMatchObject({ success: false, reason: 'invalid-part' });
    expect(store.getState()).toMatchObject({ garageGold: 0, garageUpgrades: { default: { engine: 1 } } });
    expect(data.get(GARAGE_KEY)).toBe(saved);
    store.setState({ garageGold: 5000 });
    buyStages(store, 'engine', 2);
    const gold = store.getState().garageGold;
    expect(store.getState().purchaseUpgrade('engine')).toMatchObject({ success: false, reason: 'max-level' });
    expect(store.getState().garageGold).toBe(gold);
    expect(store.getState().garageUpgrades.default.engine).toBe(3);
  });

  it('restricts selection and purchases to the garage and prevents tuning or racing an unowned car', () => {
    const store = createGameStore();
    store.getState().quitGame();
    expect(store.getState().purchaseUpgrade('engine')).toEqual({ success: false, reason: 'not-in-garage' });
    store.getState().selectCar('gt');
    expect(store.getState().selectedCar).toBe('default');
    store.getState().openGarage();
    store.setState({ selectedCar: 'apex' });
    expect(store.getState().purchaseUpgrade('engine')).toEqual({ success: false, reason: 'car-not-owned' });
    expect(store.getState().garageGold).toBe(STARTER_GOLD);
    store.getState().startGame();
    expect(store.getState()).toMatchObject({ selectedCar: 'default', runCar: 'default', runStats: { engine: 0, cruiseSpeed: 110 } });
    expect(store.getState().purchaseCar('gt')).toEqual({ success: false, reason: 'not-in-garage' });
    store.getState().openGarage();
    store.setState({ selectedCar: 'missing' });
    expect(store.getState().purchaseUpgrade('engine')).toEqual({ success: false, reason: 'invalid-car' });
    store.getState().startGame();
    expect(store.getState().runCar).toBe('default');
  });

  it('uses the published stage prices and never offers a price for invalid levels', () => {
    expect([0, 1, 2].map(stage => getUpgradeCost('engine', stage))).toEqual([300, 650, 1100]);
    expect([0, 1, 2].map(stage => getUpgradeCost('handling', stage))).toEqual([250, 550, 950]);
    expect([0, 1, 2].map(stage => getUpgradeCost('nitro', stage))).toEqual([350, 750, 1250]);
    for (const stage of [-1, 3, 4, 0.5, '0', undefined]) expect(getUpgradeCost('engine', stage)).toBeNull();
    expect(getUpgradeCost('missing', 0)).toBeNull();
    expect(getUpgradeCost('__proto__', 0)).toBeNull();
  });

  it('applies actual engine, steering and boost effects while preserving stock behavior', () => {
    const simulate = (levels, boost = false) => {
      data.delete(GARAGE_KEY);
      const store = createGameStore();
      store.getState().openGarage();
      store.setState({ garageGold: 10000 });
      for (const [part, level] of Object.entries(levels)) buyStages(store, part, level);
      store.getState().startGame();
      store.setState({ gameState: 'playing', nextTrafficDistance: Infinity, nextPickupDistance: Infinity });
      store.getState().setSteeringInput(1);
      if (boost) store.getState().activateNitro();
      for (let frame = 0; frame < 20; frame++) store.getState().updateGame(1 / 60);
      return store.getState();
    };
    const stock = simulate({});
    const tuned = simulate({ engine: 3, handling: 3, nitro: 3 });
    expect(tuned.speed).toBeGreaterThan(stock.speed);
    expect(tuned.currentX).toBeGreaterThan(stock.currentX);
    expect(simulate({ nitro: 3 }, true).speed).toBeGreaterThan(simulate({}, true).speed);
    expect(getCarStats('default').cruiseSpeed).toBe(110);
    for (const car of CARS) expect(getCarStats(car.id, { nitro: 3 }).rocketSpeed).toBeGreaterThan(getCarStats(car.id, { nitro: 3 }).boostSpeed);
  });

  it('keeps purchases usable if browser storage is blocked without silently refunding gold', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } });
    const store = createGameStore();
    store.getState().openGarage();
    store.setState({ garageGold: 5000 });
    expect(store.getState().purchaseCar('apex')).toEqual({ success: true, cost: 3000 });
    buyStages(store, 'engine', 1);
    store.getState().startGame();
    expect(store.getState()).toMatchObject({ runCar: 'apex', garageOwnedCars: ['default', 'apex'], runStats: { cruiseSpeed: 120 }, garageSaved: false, garageGold: 1700 });
  });
});

describe('offline run gold', () => {
  it('pays 25 per collected coin and one per ten meters with safe inputs', () => {
    expect(calculateRunGold({ coinsCollected: 3, totalDistance: 109.9 })).toBe(85);
    expect(calculateRunGold({ coinsCollected: -3, totalDistance: -100 })).toBe(0);
    expect(calculateRunGold({ coinsCollected: Infinity, totalDistance: NaN })).toBe(0);
    expect(calculateRunGold({ coinsCollected: Number.MAX_VALUE, totalDistance: Number.MAX_VALUE })).toBe(MAX_GOLD);
    expect(calculateRunGold()).toBe(0);
  });

  it('credits an explicit gameover only once and retains earnings through restart and car selection', () => {
    const store = createGameStore();
    store.getState().openGarage();
    store.getState().purchaseCar('gt');
    store.getState().startGame();
    store.setState({ gameState: 'playing', coinsCollected: 2, totalDistance: 123 });
    store.getState().setGameOver();
    expect(store.getState()).toMatchObject({ garageGold: 312, lastRunGold: 62 });
    store.getState().setGameOver();
    store.getState().updateGame(1);
    expect(store.getState().garageGold).toBe(312);
    expect(audioSystem.playCrash).toHaveBeenCalledTimes(1);
    const restored = createGameStore();
    expect(restored.getState()).toMatchObject({ garageGold: 312, lastRunGold: 0, garageOwnedCars: ['default', 'gt'] });
    store.getState().openGarage();
    store.getState().selectCar('default');
    expect(JSON.parse(data.get(GARAGE_KEY))).toMatchObject({ gold: 312, ownedCars: ['default', 'gt'] });
    store.getState().startGame();
    expect(store.getState()).toMatchObject({ garageGold: 312, lastRunGold: 0, coinsCollected: 0 });
    store.setState({ gameState: 'playing', coinsCollected: 1, totalDistance: 50 });
    store.getState().setGameOver();
    expect(store.getState()).toMatchObject({ garageGold: 342, lastRunGold: 30 });
  });

  it('credits an automatic crash using the final frame snapshot without duplicate pickup earnings', () => {
    const store = createGameStore({ random: () => 0.5 });
    store.getState().startGame();
    store.setState({ gameState: 'playing', speed: 200, coinsCollected: 2, totalDistance: 123,
      nextTrafficDistance: Infinity, nextPickupDistance: Infinity,
      enemies: [{ id: 'crash', lane: 0, targetLane: 0, x: 0, z: -8, ownSpeed: 50,
        type: 'sedan', passed: false, isChanging: false, laneDecisionRemaining: 100 }],
      coins: [{ id: 'same-tick-gold', kind: 'coin', x: 0, z: -2 }],
    });
    store.getState().updateGame(0.1);
    expect(store.getState()).toMatchObject({ gameState: 'gameover', garageGold: 1562, lastRunGold: 62, coinsCollected: 2 });
    store.getState().setGameOver();
    store.getState().updateGame(0.1);
    expect(store.getState().garageGold).toBe(1562);
    expect(JSON.parse(data.get(GARAGE_KEY)).gold).toBe(1562);
    expect(audioSystem.playCrash).toHaveBeenCalledTimes(1);
  });

  it('awards only the available wallet capacity and does not credit an abandoned run', () => {
    const store = createGameStore();
    store.getState().startGame();
    store.setState({ gameState: 'playing', garageGold: MAX_GOLD - 10, coinsCollected: 1 });
    store.getState().setGameOver();
    expect(store.getState()).toMatchObject({ garageGold: MAX_GOLD, lastRunGold: 10 });
    store.getState().quitGame();
    expect(store.getState().lastRunGold).toBe(0);
    store.getState().startGame();
    store.setState({ gameState: 'playing', garageGold: 100, coinsCollected: 20, totalDistance: 1000 });
    store.getState().quitGame();
    expect(store.getState()).toMatchObject({ garageGold: 100, lastRunGold: 0 });
  });
});
