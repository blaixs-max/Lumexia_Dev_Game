import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import RealLauncherUI from './components/RealLauncherUI';
import GameOverUI from './components/GameOverUI';
import RaceHUD from './components/RaceHUD';
import RaceControls from './components/RaceControls';
import { audioSystem, useGameStore } from './store';
import { usePageVisible } from './hooks/usePageVisible';
import './App.css';

const RaceScene = lazy(() => import('./components/RaceScene'));

class GameBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { console.error('Unable to load race scene:', error); }
  render() {
    if (this.state.failed) return <div className="lx-ui lx-load-error" role="alert">
      <p className="lx-eyebrow">PIT STOP</p><h1>LET’S TRY THAT AGAIN.</h1>
      <p>The 3D scene could not load. Check your connection or try Performance graphics.</p>
      <button className="lx-button lx-button-primary" onClick={this.props.onBack}>BACK TO GARAGE</button>
      <button className="lx-button lx-button-secondary" onClick={() => window.location.reload()}>RELOAD GAME</button>
    </div>;
    return this.props.children;
  }
}

function RaceAudio({ ready }) {
  const gameState = useGameStore(s => s.gameState);
  const soundEnabled = useGameStore(s => s.soundEnabled);
  const countdown = useGameStore(s => s.countdown);
  const music = useRef(null);
  useEffect(() => {
    const audio = new Audio('/audio/bgm.mp4');
    audio.loop = true; audio.volume = 0.13; music.current = audio;
    return () => { audio.pause(); audio.removeAttribute('src'); audio.load(); music.current = null; };
  }, []);
  useEffect(() => {
    if (gameState === 'playing' && soundEnabled) music.current?.play().catch(() => {});
    else music.current?.pause();
  }, [gameState, soundEnabled]);
  useEffect(() => {
    if (ready && gameState === 'countdown' && soundEnabled) audioSystem.tone(countdown === 'GO!' ? 880 : 440, countdown === 'GO!' ? 1320 : 440, 0.09, 'sine', 0.06);
  }, [countdown, gameState, ready, soundEnabled]);
  useEffect(() => {
    if (gameState !== 'playing' || !soundEnabled) return;
    const context = audioSystem.context;
    if (!context) return;
    const engine = context.createOscillator();
    const harmonic = context.createOscillator();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    engine.type = 'sawtooth'; harmonic.type = 'triangle';
    filter.type = 'lowpass'; filter.frequency.value = 480;
    gain.gain.value = 0.022;
    engine.connect(filter); harmonic.connect(filter); filter.connect(gain); gain.connect(context.destination);
    const tune = () => {
      const state = useGameStore.getState();
      const frequency = 32 + state.speed * 0.32;
      engine.frequency.setTargetAtTime(frequency, context.currentTime, 0.09);
      harmonic.frequency.setTargetAtTime(frequency * 2.02, context.currentTime, 0.09);
      filter.frequency.setTargetAtTime(state.isNitroActive ? 850 : 480, context.currentTime, 0.1);
    };
    tune(); engine.start(); harmonic.start();
    const timer = window.setInterval(tune, 80);
    return () => { clearInterval(timer); engine.stop(); harmonic.stop(); engine.disconnect(); harmonic.disconnect(); filter.disconnect(); gain.disconnect(); };
  }, [gameState, soundEnabled]);
  return null;
}

function Race({ quality }) {
  const gameState = useGameStore(s => s.gameState);
  const [ready, setReady] = useState(false);
  // Auto changes only resolution: keep the world and lighting stable at speed.
  const [low] = useState(() => quality === 'performance' || (quality === 'auto' && Math.min(window.innerWidth, window.innerHeight) < 768));
  const [renderDpr, setRenderDpr] = useState(() => quality === 'high'
    ? Math.min(window.devicePixelRatio, 1.5)
    : Math.min(window.devicePixelRatio, 1, Math.sqrt(2304000 / (window.innerWidth * window.innerHeight))));
  const pageVisible = usePageVisible();
  const quitGame = useGameStore(s => s.quitGame);
  return <main className="lx-race" aria-label="Lumexia highway race">
    <GameBoundary onBack={quitGame}>
      <Canvas dpr={renderDpr} shadows={!low} frameloop={!pageVisible ? 'never' : ready && gameState === 'paused' ? 'demand' : 'always'} camera={{ position: [0, 5.2, 11.5], fov: 54, near: 0.5, far: 750 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}>
        <color attach="background" args={['#070e20']} />
        <Suspense fallback={null}>
          <RaceScene low={low} adaptive={quality === 'auto'} onReady={() => setReady(true)} onReduceQuality={() => setRenderDpr(value => Math.max(Math.min(value, 0.65), value * 0.85))} />
        </Suspense>
      </Canvas>
      {ready ? <RaceHUD onMainMenu={quitGame} /> : <div className="lx-ui lx-track-loading" role="status"><span className="lx-loading-spinner" /><p>PREPARING YOUR RUN</p><small>Preparing the highway and your car…</small><button className="lx-button lx-button-secondary" onClick={quitGame}>BACK TO GARAGE</button></div>}
      <RaceControls touchVisible={ready && gameState === 'playing'} />
      <RaceAudio ready={ready} />
    </GameBoundary>
    <div className="lx-track-vignette" aria-hidden="true" />
  </main>;
}

function readQuality() {
  try {
    const value = localStorage.getItem('lumexia:graphics');
    return ['auto', 'performance', 'high'].includes(value) ? value : 'auto';
  } catch { return 'auto'; }
}

export default function App() {
  const gameState = useGameStore(s => s.gameState);
  const [quality, setQuality] = useState(readQuality);
  useEffect(() => {
    if (useGameStore.getState().gameState === 'loading') useGameStore.getState().quitGame();
  }, []);
  const changeQuality = value => {
    setQuality(value);
    try { localStorage.setItem('lumexia:graphics', value); } catch { /* Optional preference. */ }
  };
  return <>
    {['loading', 'launcher'].includes(gameState) ? <RealLauncherUI quality={quality} onQualityChange={changeQuality} onStartGame={options => useGameStore.getState().startGame(options)} /> : null}
    {['countdown', 'playing', 'paused'].includes(gameState) ? <Race quality={quality} /> : null}
    {gameState === 'gameover' ? <GameOverUI score={useGameStore.getState().score} totalDistance={useGameStore.getState().totalDistance} nearMissCount={useGameStore.getState().nearMissCount} coinsCollected={useGameStore.getState().coinsCollected} onRestart={() => useGameStore.getState().startGame()} onMainMenu={() => useGameStore.getState().quitGame()} /> : null}
  </>;
}
