import { Component, Suspense, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import { usePageVisible } from '../hooks/usePageVisible';
import './RaceUI.css';

useGLTF.setDecoderPath('/draco/');

const MODES = [
  { id: 'classic', number: '01', name: 'CLASSIC RUN', detail: 'Find your line. Go the distance.', tag: 'ENDLESS' },
  { id: 'doubleOrNothing', number: '02', name: 'DOUBLE OR NOTHING', detail: 'Reach level 5 for a 2× score. Otherwise, zero.', tag: 'CHALLENGE' },
];

class ShowroomBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div className="lx-showroom-fallback">L / X</div> : this.props.children;
  }
}

function ShowroomCar() {
  // The compact model uses the bundled Draco decoder; no third-party CDN is needed.
  const { scene } = useGLTF('/models/sport_car_compact.glb');
  const group = useRef();
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const { model, scale, position } = useMemo(() => {
    const model = scene.clone(true);
    const bounds = new Box3().setFromObject(model);
    const size = bounds.getSize(new Vector3());
    const center = bounds.getCenter(new Vector3());
    const scale = 5.2 / Math.max(size.x, size.z, 1);
    return { model, scale, position: [-center.x * scale, -bounds.min.y * scale, -center.z * scale] };
  }, [scene]);
  useFrame(({ clock }) => {
    if (group.current && !reducedMotion) group.current.rotation.y = -0.4 + Math.sin(clock.elapsedTime * 0.18) * 0.12;
  });
  return <group ref={group} rotation={[0, -0.4, 0]}><primitive object={model} scale={scale} position={position} dispose={null} /></group>;
}

function Showroom({ quality }) {
  const pageVisible = usePageVisible();
  return (
    <div className="lx-showroom" aria-label="Your sports car in the garage" role="img">
      <div className="lx-showroom-grid" aria-hidden="true" />
      <div className="lx-showroom-word" aria-hidden="true">L / X</div>
      <ShowroomBoundary>
        <Canvas frameloop={pageVisible ? 'always' : 'never'} camera={{ position: [6, 3, 7], fov: 34 }} dpr={quality === 'performance' ? 1 : [1, 1.5]} gl={{ alpha: true, antialias: true }}>
          <ambientLight intensity={1.7} />
          <directionalLight position={[4, 7, 5]} intensity={4} color="#fff1d3" />
          <directionalLight position={[-4, 3, -4]} intensity={3} color="#a6d3dd" />
          <pointLight position={[0, 2, -3]} intensity={18} color="#e3ff6e" />
          <Suspense fallback={null}>
            <ShowroomCar />
            {quality !== 'performance' ? <ContactShadows position={[0, -0.015, 0]} opacity={0.65} scale={8} blur={2.6} far={4} resolution={256} frames={1} color="#000000" /> : null}
          </Suspense>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}><circleGeometry args={[3.35, 64]} /><meshStandardMaterial color="#1a2023" metalness={0.6} roughness={0.45} /></mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}><ringGeometry args={[3.25, 3.28, 64]} /><meshBasicMaterial color="#dfff72" transparent opacity={0.5} /></mesh>
        </Canvas>
      </ShowroomBoundary>
      <div className="lx-car-caption"><span><i /> READY TO ROLL</span><span>SPORT / NITRO EQUIPPED</span></div>
    </div>
  );
}

function readBest(mode) {
  try {
    const value = Number(localStorage.getItem(`lumexia.best.v1.${mode}`));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  } catch { return 0; }
}

export default function RealLauncherUI({ onStartGame, quality = 'auto', onQualityChange }) {
  const [gameMode, setGameMode] = useState('classic');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [bestScores] = useState(() => ({ classic: readBest('classic'), doubleOrNothing: readBest('doubleOrNothing') }));

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setStartError('');
    try { await onStartGame({ gameMode, isPractice: true, sessionType: 'practice' }); }
    catch {
      setStartError('The race could not start. Please try again.');
      setStarting(false);
    }
  };

  return (
    <main className="lx-ui lx-launcher">
      <div className="lx-shell">
        <header className="lx-header">
          <div className="lx-brand"><span className="lx-brand-mark" aria-hidden="true">L<span>↗</span></span><span>LUMEXIA<small>HIGHWAY DIVISION</small></span></div>
          <div className="lx-header-right"><span className="lx-status"><i /> FREE PRACTICE</span><span className="lx-edition">VOL. 01 / ENDLESS HIGHWAY</span></div>
        </header>
        <section className="lx-hero" aria-labelledby="lx-hero-title">
          <div className="lx-hero-copy">
            <p className="lx-eyebrow"><span /> THE ROAD IS YOURS.</p>
            <h1 id="lx-hero-title">FIND YOUR<br /><em>LIMIT.</em></h1>
            <p className="lx-intro">Thread the traffic. Chase the perfect run.<br />One highway. A little nerve. No finish line.</p>
            <div className="lx-hero-stats"><div><strong>03</strong><span>LANES TO MASTER</span></div><div><strong>∞</strong><span>ROOM TO IMPROVE</span></div><div><strong>2×</strong><span>THE CHALLENGE</span></div></div>
          </div>
          <Showroom quality={quality} />
        </section>
        <div className="lx-launch-grid">
          <section className="lx-race-panel" aria-labelledby="lx-mode-title">
            <div className="lx-section-heading"><h2 id="lx-mode-title"><span>01 /</span> CHOOSE YOUR RUN</h2><span>NO WALLET REQUIRED</span></div>
            <div className="lx-mode-list" role="group" aria-label="Race mode">
              {MODES.map(mode => <button key={mode.id} type="button" className={`lx-mode ${gameMode === mode.id ? 'is-selected' : ''}`} aria-pressed={gameMode === mode.id} onClick={() => setGameMode(mode.id)} disabled={starting}><span className="lx-mode-number">{mode.number}</span><span className="lx-mode-copy"><strong>{mode.name}</strong><span>{mode.detail}</span></span><span className="lx-mode-tag">{mode.tag}</span><span className="lx-radio" aria-hidden="true" /></button>)}
            </div>
            <div className="lx-launch-actions"><button type="button" className="lx-button lx-button-primary lx-start" onClick={handleStart} disabled={starting}><span>{starting ? 'PREPARING YOUR RUN' : 'START YOUR ENGINE'}</span><span aria-hidden="true">↗</span></button><div className="lx-personal-best"><span>YOUR LOCAL BEST</span><strong>{bestScores[gameMode] > 0 ? bestScores[gameMode].toLocaleString() : '—'}<small> PTS</small></strong></div></div>
            {startError ? <p className="lx-error" role="alert">{startError}</p> : null}
            <p className="lx-practice-note">Unlimited practice. Your best stays on this device.</p>
          </section>
          <section className="lx-controls-panel" aria-labelledby="lx-controls-title">
            <div className="lx-section-heading"><h2 id="lx-controls-title"><span>02 /</span> KNOW YOUR CONTROLS</h2><span>DRIVER BRIEFING</span></div>
            <div className="lx-controls-row"><span><kbd>←</kbd><kbd>→</kbd><small> / </small><kbd>A</kbd><kbd>D</kbd></span><strong>HOLD TO STEER</strong></div>
            <div className="lx-controls-row"><span><kbd className="lx-key-wide">SPACE</kbd></span><strong>HOLD FOR NITRO</strong></div>
            <div className="lx-controls-row"><span><kbd>ESC</kbd><small> / </small><kbd>P</kbd></span><strong>PAUSE YOUR RUN</strong></div>
            <p className="lx-driving-tip"><span aria-hidden="true">↗</span><span>Close passes earn bonus points. Collect coins, magnets and rockets. Keep an open lane ahead.</span></p>
            <p className="lx-touch-hint">On a touch screen? Hold the steering arrows and boost button.</p>
          </section>
        </div>
        <footer className="lx-footer"><span>PRECISION BEATS PURE SPEED.</span>{onQualityChange ? <label className="lx-quality">GRAPHICS<select value={quality} onChange={event => onQualityChange(event.target.value)} aria-label="Graphics quality"><option value="auto">Auto</option><option value="performance">Performance</option><option value="high">High</option></select></label> : null}<span>LOCAL PRACTICE / NO ONLINE SCORE SUBMISSION</span></footer>
      </div>
    </main>
  );
}
