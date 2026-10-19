import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import '../src/App.css';

// This explicit diagnostic entry replaces storage only inside this document,
// before any game module runs. It never reads or writes the browser's save.
const memory = new Map();
const storage = {
  getItem: key => memory.get(String(key)) ?? null,
  setItem: (key, value) => memory.set(String(key), String(value)),
  removeItem: key => memory.delete(String(key)),
  clear: () => memory.clear(),
  key: index => [...memory.keys()][index] ?? null,
  get length() { return memory.size; },
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
storage.setItem('lumexia:sound', 'off');

async function start() {
  const [{ useGameStore, audioSystem }, { default: GaragePage }, { GARAGE_KEY, getCarStats, sanitizeGarage }] = await Promise.all([
    import('../src/store.js'),
    import('../src/components/GaragePage.jsx'),
    import('../src/utils/garage.js'),
  ]);

  function applyProfile(tuned = false) {
    const garage = sanitizeGarage({
      schemaVersion: 3,
      gold: tuned ? 6000 : 1500,
      selectedCar: 'default',
      ownedCars: ['default'],
      upgrades: tuned ? { default: { engine: 3, handling: 3, nitro: 3 } } : {},
    });
    storage.setItem(GARAGE_KEY, JSON.stringify(garage));
    audioSystem.setEnabled(false);
    useGameStore.setState({
      gameState: 'garage',
      selectedCar: garage.selectedCar,
      garageOwnedCars: garage.ownedCars,
      garageUpgrades: garage.upgrades,
      garageGold: garage.gold,
      garageSaved: true,
      soundEnabled: false,
      runCar: garage.selectedCar,
      runStats: getCarStats(garage.selectedCar, garage.upgrades[garage.selectedCar]),
    });
  }

  function GarageCheck() {
    const [generation, setGeneration] = useState(0);
    const [quality, setQuality] = useState('auto');
    const reset = tuned => {
      applyProfile(tuned);
      setGeneration(value => value + 1);
    };
    return <>
      <div className="garage-check-toolbar" role="region" aria-label="Temporary garage test">
        <strong>Garage Test — temporary progress</strong>
        <button type="button" onClick={() => reset(false)}>Reset Starter · 1,500 Gold</button>
        <button type="button" onClick={() => reset(true)}>Maxed Build · 6,000 Gold</button>
      </div>
      <GaragePage key={generation} quality={quality} onQualityChange={setQuality} />
    </>;
  }

  applyProfile();
  createRoot(document.getElementById('root')).render(<GarageCheck />);
}

start().catch(error => {
  document.getElementById('root').textContent = `Unable to load the garage test: ${error.message}`;
});
