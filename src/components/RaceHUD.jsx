import { memo, useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import './RaceUI.css';

function SoundIcon({ enabled }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" />{enabled ? <><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></> : <path d="m16 9 6 6m0-6-6 6" />}</svg>;
}

const RaceScore = memo(function RaceScore() {
  // Select the visible integers so fractional simulation ticks do not render UI.
  const score = useGameStore(state => Math.floor(state.score));
  const distance = useGameStore(state => Math.floor(state.totalDistance));
  const coins = useGameStore(state => state.coinsCollected);
  const nearMisses = useGameStore(state => state.nearMissCount);
  return <div className="lx-race-score"><span className="lx-hud-label">RUN SCORE</span><strong>{score.toLocaleString().padStart(3, '0')}</strong><div className="lx-race-counters"><span>{distance.toLocaleString()} <small>M</small></span><span title="Coins collected"><i className="lx-coin-symbol" aria-hidden="true" />{coins}<span className="lx-sr-only"> coins</span></span><span className="lx-near-count" title="Near misses">↗ {nearMisses}<span className="lx-sr-only"> near misses</span></span></div></div>;
});

const RaceProgress = memo(function RaceProgress() {
  const level = useGameStore(state => state.currentLevel);
  const progress = useGameStore(state => Math.floor(state.totalDistance % 1000 / 10));
  const challenge = useGameStore(state => state.gameMode === 'doubleOrNothing');
  const reachedLevel5 = useGameStore(state => state.reachedLevel5);
  return <div className="lx-race-progress"><div><span>HIGHWAY / <b>{String(level).padStart(2, '0')}</b></span><span>{challenge ? reachedLevel5 ? '2× UNLOCKED' : 'TARGET: LEVEL 5' : 'FREE PRACTICE'}</span></div><div className="lx-level-track" role="progressbar" aria-label={`Level ${level} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div><p>LEVEL {String(level).padStart(2, '0')}<span>{1000 - progress * 10} M TO NEXT LEVEL</span></p></div>;
});

const RaceTelemetry = memo(function RaceTelemetry() {
  const speed = useGameStore(state => Math.round(state.speed));
  const nitro = useGameStore(state => Math.round(state.nitro / Math.max(1, state.maxNitro) * 100));
  const boosting = useGameStore(state => state.isNitroActive);
  const rocketActive = useGameStore(state => state.rocketActive);
  const magnetActive = useGameStore(state => state.magnetActive);
  const rocketSeconds = useGameStore(state => Math.ceil(state.rocketRemaining || 0));
  const magnetSeconds = useGameStore(state => Math.ceil(state.magnetRemaining || 0));
  const speedProgress = Math.min(100, speed / 240 * 100);
  return <div className={`lx-telemetry ${boosting || rocketActive ? 'is-boosting' : ''}`}>
    <div className="lx-speed"><div className="lx-speed-heading"><span className="lx-hud-label">SPEED</span><span className="lx-gear">AUTO</span></div><div className="lx-speed-value"><strong>{String(speed).padStart(3, '0')}</strong><span>PACE</span></div><div className="lx-speed-track"><span style={{ width: `${speedProgress}%` }} /></div><p>{rocketActive ? 'ROCKET OVERDRIVE' : boosting ? 'NITRO ENGAGED' : 'STAY IN THE FLOW'}</p></div>
    <div className="lx-boost"><div className="lx-powerups" aria-live="polite">{magnetActive ? <span className="lx-powerup lx-magnet">⊂ MAGNET <b>{magnetSeconds}s</b></span> : null}{rocketActive ? <span className="lx-powerup lx-rocket">↑ ROCKET <b>{rocketSeconds}s</b></span> : null}</div><div className="lx-nitro-heading"><span className="lx-hud-label">{boosting ? 'BOOST ACTIVE' : 'NITRO RESERVE'}</span><strong>{nitro}<small>%</small></strong></div><div className="lx-nitro-track" role="progressbar" aria-label="Nitro reserve" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nitro}><span style={{ width: `${nitro}%` }} /></div><p><kbd>SPACE</kbd><span>HOLD TO BOOST</span></p></div>
  </div>;
});

const RaceMessage = memo(function RaceMessage() {
  const message = useGameStore(state => state.message);
  const visible = useGameStore(state => state.gameState === 'playing');
  return visible && message ? <div className="lx-race-message" role="status"><span>{message}</span></div> : null;
});

function PauseDialog({ onMainMenu, onRestart }) {
  const panelRef = useRef();
  const resumeRef = useRef();
  const restoreFocus = useRef(true);
  const resumeGame = useGameStore(state => state.resumeGame);
  const elapsedTime = useGameStore(state => Math.floor(state.elapsedTime || 0));

  useEffect(() => {
    const previousFocus = document.activeElement;
    resumeRef.current?.focus();
    return () => { if (restoreFocus.current && previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  const runAction = (event, action) => {
    // Pointer users return directly to driving; keyboard users retain their
    // dialog trigger as the focus destination when closing the dialog.
    if (event.detail > 0) {
      restoreFocus.current = false;
      event.currentTarget.blur();
    }
    action();
  };

  const trapFocus = event => {
    if (event.key !== 'Tab') return;
    const controls = panelRef.current?.querySelectorAll('button:not(:disabled)');
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className="lx-pause-scrim"><section ref={panelRef} className="lx-pause-card" role="dialog" aria-modal="true" aria-labelledby="lx-pause-title" onKeyDown={trapFocus}><p className="lx-eyebrow">TAKE A BREATHER.</p><h1 id="lx-pause-title">RUN<em> PAUSED.</em></h1><p>Your run is right where you left it.</p><div className="lx-pause-session"><span>DRIVE TIME</span><strong>{String(Math.floor(elapsedTime / 60)).padStart(2, '0')}:{String(elapsedTime % 60).padStart(2, '0')}</strong><span>FREE PRACTICE</span></div><button ref={resumeRef} type="button" className="lx-button lx-button-primary" onClick={event => runAction(event, resumeGame)}>BACK ON THE ROAD <span aria-hidden="true">↗</span></button><div className="lx-pause-secondary"><button type="button" className="lx-button lx-button-secondary" onClick={event => runAction(event, onRestart)}>RESTART RUN</button><button type="button" className="lx-button lx-button-secondary" onClick={event => runAction(event, onMainMenu)}>GARAGE</button></div><small>Press ESC or P to resume.</small></section></div>;
}

export default function RaceHUD({ onMainMenu, onRestart }) {
  const gameState = useGameStore(state => state.gameState);
  const countdown = useGameStore(state => state.countdown);
  const soundEnabled = useGameStore(state => state.soundEnabled);
  const setSoundEnabled = useGameStore(state => state.setSoundEnabled);
  const togglePause = useGameStore(state => state.togglePause);
  const startGame = useGameStore(state => state.startGame);
  const setGameState = useGameStore(state => state.setGameState);
  const paused = gameState === 'paused';

  const runHudAction = (event, action) => {
    if (event.detail > 0) event.currentTarget.blur();
    action();
  };

  return <div className="lx-ui lx-hud">
    <div className="lx-hud-chrome" aria-hidden={paused ? true : undefined} inert={paused ? true : undefined}>
      <div className="lx-hud-top"><RaceScore /><RaceProgress /><div className="lx-hud-actions"><button type="button" className="lx-icon-button" onClick={event => runHudAction(event, () => setSoundEnabled(!soundEnabled))} aria-label={soundEnabled ? 'Mute audio' : 'Enable audio'} aria-pressed={!soundEnabled}><SoundIcon enabled={soundEnabled} /></button><button type="button" className="lx-icon-button" onClick={event => runHudAction(event, togglePause)} aria-label="Pause race" title="Pause (Esc / P)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg></button></div></div>
      <RaceTelemetry /><RaceMessage />
      {gameState === 'countdown' ? <div className="lx-countdown" role="status" aria-live="assertive"><p>GET IN THE ZONE.</p><strong key={countdown}>{countdown}</strong><span className="lx-countdown-keyboard">HOLD ← → / A D TO STEER <i /> HOLD SPACE FOR NITRO</span><span className="lx-countdown-touch">HOLD LEFT / RIGHT SIDE TO STEER <i /> HOLD NITRO TO BOOST</span></div> : null}
    </div>
    {paused ? <PauseDialog onMainMenu={onMainMenu || (() => setGameState('launcher'))} onRestart={onRestart || (() => startGame())} /> : null}
  </div>;
}
