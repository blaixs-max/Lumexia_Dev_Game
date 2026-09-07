import { create } from 'zustand';
import { MOCK_WALLET_ADDRESS, MOCK_CREDITS } from './devMode';
import {
  SIMULATION_STEP, ROAD_LIMIT, clamp, applyPickup,
  awardNearMiss, makeParticles, stepGameplay,
} from './utils/gameplay.js';

class AudioSystem {
  constructor() {
    this.context = null;
    this.enabled = true;
  }

  init() {
    if (!this.enabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!this.context && AudioContext) this.context = new AudioContext();
      if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
    } catch {
      // An unavailable audio device must never prevent starting a race.
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled) this.init();
    else if (this.context?.state === 'running') this.context.suspend().catch(() => {});
  }

  tone(frequency, endFrequency, duration, type = 'sine', volume = 0.12) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  playCrash() {
    this.tone(110, 24, 0.45, 'sawtooth', 0.18);
    if (this.enabled && typeof navigator !== 'undefined') navigator.vibrate?.([70, 40, 110]);
  }

  playNearMiss() {
    this.tone(800, 1200, 0.18);
    if (this.enabled && typeof navigator !== 'undefined') navigator.vibrate?.(25);
  }

  playCoin() { this.tone(988, 1319, 0.22, 'sine', 0.1); }
}

export const audioSystem = new AudioSystem();

function readSoundPreference() {
  try { return globalThis.localStorage?.getItem('lumexia:sound') !== 'off'; }
  catch { return true; }
}

const initialRun = () => ({
  gameState: 'loading',
  pausedFrom: null,
  countdown: 3,
  countdownRemaining: 3.35,
  countdownTimer: null,
  sessionType: 'practice',
  isPractice: true,
  speed: 0,
  crashSpeed: 0,
  targetSpeed: 110,
  currentX: 0,
  targetX: 0,
  steeringInput: 0,
  steeringVelocity: 0,
  score: 0,
  combo: 1,
  gameOver: false,
  enemies: [],
  coins: [],
  particles: [],
  message: '',
  messageRemaining: 0,
  cameraShake: 0,
  totalDistance: 0,
  elapsedTime: 0,
  nearMissCount: 0,
  coinsCollected: 0,
  startTime: 0,
  currentLevel: 1,
  lastLevelUpDistance: 0,
  reachedLevel5: false,
  nitro: 100,
  maxNitro: 100,
  isNitroActive: false,
  nitroRegenRate: 5,
  magnetActive: false,
  magnetRemaining: 0,
  magnetEndTime: 0,
  magnetDuration: 10000,
  currentLevelMagnetsSpawned: 0,
  magnetLevelTracker: 1,
  rocketActive: false,
  rocketRemaining: 0,
  rocketEndTime: 0,
  rocketDuration: 12000,
  rocketTargetSpeed: 210,
  currentLevelRocketsSpawned: 0,
  rocketLevelTracker: 1,
  updateCounter: 0,
  nextEntityId: 1,
  nextTrafficDistance: 7,
  nextPickupDistance: 4,
  lastSpawnZ: -400,
});

// Factory permits isolated, deterministic simulations in tests. Runtime uses
// one store; no game action imports a wallet, payment or score submission API.
export function createGameStore({ random = Math.random, now = Date.now } = {}) {
  let accumulator = 0;
  return create((set, get) => ({
    ...initialRun(),
    selectedCar: 'default',
    walletAddress: MOCK_WALLET_ADDRESS,
    credits: MOCK_CREDITS,
    gameMode: 'classic',
    soundEnabled: readSoundPreference(),

    setGameState: gameState => {
      if (gameState === 'launcher') { get().quitGame(); return; }
      if (gameState === 'paused') { get().pauseGame(); return; }
      if (gameState === 'playing' && get().gameState === 'paused') { get().resumeGame(); return; }
      if (gameState === 'loading') set({ gameState });
    },

    setWalletData: (walletAddress, credits) => set({ walletAddress, credits }),
    setGameMode: gameMode => {
      if (['classic', 'doubleOrNothing'].includes(gameMode)) set({ gameMode, reachedLevel5: false });
    },

    setSoundEnabled: enabled => {
      const soundEnabled = Boolean(enabled);
      audioSystem.setEnabled(soundEnabled);
      try { globalThis.localStorage?.setItem('lumexia:sound', soundEnabled ? 'on' : 'off'); }
      catch { /* Storage can be disabled in private browsing. */ }
      set({ soundEnabled });
    },
    toggleSound: () => get().setSoundEnabled(!get().soundEnabled),

    startGame: (options = {}) => {
      accumulator = 0;
      const gameMode = ['classic', 'doubleOrNothing'].includes(options?.gameMode)
        ? options.gameMode : get().gameMode;
      audioSystem.setEnabled(get().soundEnabled);
      set({ ...initialRun(), gameMode, gameState: 'countdown' });
    },

    quitGame: () => {
      accumulator = 0;
      set({ ...initialRun(), gameState: 'launcher' });
    },

    cleanupTimer: () => {
      // Countdown and notifications use simulation time, with no delayed
      // callbacks able to resurrect a game after quitting or restarting.
      accumulator = 0;
      set({ steeringInput: 0, isNitroActive: false });
    },

    pauseGame: () => {
      const state = get();
      if (!['playing', 'countdown'].includes(state.gameState)) return;
      accumulator = 0;
      set({
        gameState: 'paused', pausedFrom: state.gameState,
        steeringInput: 0, steeringVelocity: 0,
        targetX: state.currentX, isNitroActive: false,
      });
    },

    resumeGame: () => {
      const state = get();
      if (state.gameState !== 'paused') return;
      accumulator = 0;
      audioSystem.setEnabled(state.soundEnabled);
      set({
        gameState: state.pausedFrom === 'countdown' ? 'countdown' : 'playing',
        pausedFrom: null, steeringInput: 0, isNitroActive: false,
        magnetEndTime: state.magnetActive ? now() + state.magnetRemaining * 1000 : 0,
        rocketEndTime: state.rocketActive ? now() + state.rocketRemaining * 1000 : 0,
      });
    },

    togglePause: () => get().gameState === 'paused' ? get().resumeGame() : get().pauseGame(),

    setSteeringInput: direction => {
      if (!Number.isFinite(direction)) return;
      set({ steeringInput: get().gameState === 'playing' ? clamp(direction, -1, 1) : 0 });
    },

    // Retain a discrete action for accessibility controls and single taps.
    steer: direction => {
      const state = get();
      if (state.gameState !== 'playing' || !Number.isFinite(direction)) return;
      set({ targetX: clamp(state.targetX + Math.sign(direction) * 1.25, -ROAD_LIMIT, ROAD_LIMIT) });
    },

    activateNitro: () => {
      const state = get();
      if (state.gameState === 'playing' && state.nitro > 0 && !state.rocketActive) set({ isNitroActive: true });
    },
    deactivateNitro: () => set({ isNitroActive: false }),

    updateEnemyPassed: enemyId => set(state => ({
      enemies: state.enemies.map(enemy => enemy.id === enemyId ? { ...enemy, passed: true } : enemy),
    })),

    collectCoin: id => get().collectPickup(id, 'coin'),
    collectMagnet: id => get().collectPickup(id, 'magnet'),
    collectRocket: id => get().collectPickup(id, 'rocket'),
    collectPickup: (id, kind) => {
      const state = get();
      const pickup = state.coins.find(coin => coin.id === id && (coin.kind || 'coin') === kind);
      if (state.gameState !== 'playing' || !pickup) return;
      const next = { ...state };
      applyPickup(next, pickup);
      next.magnetEndTime = next.magnetActive ? now() + next.magnetRemaining * 1000 : 0;
      next.rocketEndTime = next.rocketActive ? now() + next.rocketRemaining * 1000 : 0;
      set(next);
      audioSystem.playCoin();
    },

    triggerNearMiss: position => {
      const state = get();
      if (state.gameState !== 'playing') return;
      const next = { ...state, particles: [...state.particles] };
      awardNearMiss(next, position, random);
      set(next);
      audioSystem.playNearMiss();
    },

    addExplosion: (x, y, z) => set(state => ({
      particles: [...state.particles, ...makeParticles(x, y, z, 'explosion', random)].slice(-70),
    })),

    updateGame: delta => {
      const state = get();
      if (!['playing', 'countdown'].includes(state.gameState) || !Number.isFinite(delta) || delta <= 0) return;
      // A tab returning from the background must not simulate minutes of
      // traffic in one frame. Visibility/blur also pause through the UI.
      accumulator += Math.min(delta, 0.1);
      if (accumulator + 1e-10 < SIMULATION_STEP) return;
      const next = { ...state, enemies: [...state.enemies], coins: [...state.coins], particles: [...state.particles] };
      const effects = [];
      while (accumulator + 1e-10 >= SIMULATION_STEP) {
        accumulator = Math.max(0, accumulator - SIMULATION_STEP);
        if (next.gameState === 'countdown') {
          next.countdownRemaining = Math.max(0, next.countdownRemaining - SIMULATION_STEP);
          next.countdown = next.countdownRemaining > 0.35 + 1e-9
            ? Math.ceil(next.countdownRemaining - 0.35 - 1e-9) : 'GO!';
          if (next.countdownRemaining < 1e-9) {
            next.gameState = 'playing';
            next.countdown = null;
            next.startTime = now();
          }
        } else if (next.gameState === 'playing') {
          stepGameplay(next, SIMULATION_STEP, random, effects);
        }
        if (next.gameOver) { accumulator = 0; break; }
      }
      next.magnetEndTime = next.magnetActive ? now() + next.magnetRemaining * 1000 : 0;
      next.rocketEndTime = next.rocketActive ? now() + next.rocketRemaining * 1000 : 0;
      set(next);
      // Multiple pickups in one rendered frame need only one sound.
      new Set(effects).forEach(effect => {
        if (effect === 'crash') audioSystem.playCrash();
        else if (effect === 'nearMiss') audioSystem.playNearMiss();
        else audioSystem.playCoin();
      });
    },

    setGameOver: () => {
      const state = get();
      if (state.gameState !== 'playing' || state.gameOver) return;
      accumulator = 0;
      set({
        gameOver: true, gameState: 'gameover', crashSpeed: state.speed,
        speed: 0, targetSpeed: 0, cameraShake: 3,
        steeringInput: 0, isNitroActive: false,
        particles: [...state.particles, ...makeParticles(state.currentX, 1, -2, 'explosion', random)].slice(-70),
      });
      audioSystem.playCrash();
    },
  }));
}

export const useGameStore = createGameStore();
