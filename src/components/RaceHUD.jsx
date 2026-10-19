import { memo, useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { getCar } from '../utils/garage';
import UIIcon from './UIIcon';
import './RaceUI.css';

const number = value => value.toLocaleString('en-US');

const RunBuild = memo(function RunBuild() {
  const runCar = useGameStore(s => s.runCar);
  const stats = useGameStore(s => s.runStats);
  return <div className="lx-run-build" aria-label="Race car and upgrade stages"><strong>{getCar(runCar).name}</strong><div className="lx-run-parts">{[['engine', 'Engine'], ['handling', 'Handling'], ['nitro', 'Nitro']].map(([part, label]) => <span key={part} aria-label={`${label}: Stage ${stats?.[part] ?? 0}`} title={`${label}: Stage ${stats?.[part] ?? 0}`}><UIIcon name={part} size={14} /><b>{stats?.[part] ?? 0}</b></span>)}</div></div>;
});

const RaceScore = memo(function RaceScore() {
  // Select the visible integers so fractional simulation ticks do not render UI.
  const score = useGameStore(state => Math.floor(state.score));
  const distance = useGameStore(state => Math.floor(state.totalDistance));
  const coins = useGameStore(state => state.coinsCollected);
  const nearMisses = useGameStore(state => state.nearMissCount);
  return <div className="lx-race-score"><span className="lx-hud-label"><UIIcon name="trophy" size={14} /> SCORE</span><strong>{number(score).padStart(3, '0')}</strong><div className="lx-race-counters"><span aria-label={`Distance: ${number(distance)} meters`} title="Distance traveled"><UIIcon name="distance" size={15} />{number(distance)} <small>m</small></span><span className="lx-coin-count" aria-label={`Coins collected: ${number(coins)}`} title="Coins collected · 25 Gold each"><UIIcon name="coin" size={15} />{number(coins)}<small>COINS</small></span><span className="lx-near-count" aria-label={`Near Misses: ${number(nearMisses)}`} title="Near Miss"><UIIcon name="nearMiss" size={15} />{number(nearMisses)}</span></div></div>;
});

const RaceProgress = memo(function RaceProgress() {
  const level = useGameStore(state => state.currentLevel);
  const progress = useGameStore(state => Math.floor(state.totalDistance % 1000 / 10));
  const challenge = useGameStore(state => state.gameMode === 'doubleOrNothing');
  const reachedLevel5 = useGameStore(state => state.reachedLevel5);
  return <div className="lx-race-progress"><div><span>LEVEL <b>{String(level).padStart(2, '0')}</b></span><span>{challenge ? reachedLevel5 ? <><UIIcon name="check" size={13} /> SCORE ×2</> : 'TARGET: LEVEL 5' : 'Classic Run'}</span></div><div className="lx-level-track" role="progressbar" aria-label={`Level ${level} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={`${1000 - progress * 10} meters to the next level`}><span style={{ width: `${progress}%` }} /></div><p>{challenge ? reachedLevel5 ? 'Target reached' : 'Crash before Level 5: 0 points' : 'Push for a new best.'}<span>{number(1000 - progress * 10)} m to go</span></p></div>;
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
    <div className="lx-speed" aria-label={`Speed: ${speed} units`}><div className="lx-speed-heading"><span className="lx-hud-label"><UIIcon name="speed" size={14} /> SPEED</span><span className="lx-gear">AUTO</span></div><div className="lx-speed-value"><strong>{String(speed).padStart(3, '0')}</strong><span>UNITS</span></div><div className="lx-speed-track"><span style={{ width: `${speedProgress}%` }} /></div><p>{rocketActive ? 'Rocket Boost active' : boosting ? 'Nitro active' : 'Auto acceleration'}</p></div>
    <div className="lx-boost"><div className="lx-powerups" aria-live="polite">{magnetActive ? <span className="lx-powerup lx-magnet"><UIIcon name="magnet" size={16} /><span>MAGNET</span><b>{magnetSeconds} s</b></span> : null}{rocketActive ? <span className="lx-powerup lx-rocket"><UIIcon name="rocket" size={16} /><span>ROCKET BOOST</span><b>{rocketSeconds} s</b></span> : null}</div><div className="lx-nitro-heading"><span className="lx-hud-label"><UIIcon name="nitro" size={14} />{boosting ? 'NITRO ACTIVE' : 'NITRO'}</span><strong>{nitro}<small>%</small></strong></div><div className="lx-nitro-track" role="progressbar" aria-label="Nitro charge" aria-valuemin={0} aria-valuemax={100} aria-valuenow={nitro}><span style={{ width: `${nitro}%` }} /></div><p><kbd>SPACE</kbd><span>Hold for Nitro</span></p></div>
  </div>;
});

const RaceMessage = memo(function RaceMessage() {
  const message = useGameStore(state => state.message);
  const visible = useGameStore(state => state.gameState === 'playing');
  return visible && message ? <div className="lx-race-message" role="status"><span>{message}</span></div> : null;
});

function PauseDialog({ onMainMenu, onRestart, onGarage }) {
  const panelRef = useRef();
  const resumeRef = useRef();
  const restoreFocus = useRef(true);
  const resumeGame = useGameStore(state => state.resumeGame);
  const elapsedTime = useGameStore(state => Math.floor(state.elapsedTime || 0));
  const challenge = useGameStore(state => state.gameMode === 'doubleOrNothing');

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

  return <div className="lx-pause-scrim"><section ref={panelRef} className="lx-pause-card" role="dialog" aria-modal="true" aria-labelledby="lx-pause-title" onKeyDown={trapFocus}><p className="lx-eyebrow"><UIIcon name="pause" size={17} /> PAUSED</p><h1 id="lx-pause-title">Race <em>Paused</em></h1><p>Resume when you’re ready to get back on the road.</p><div className="lx-pause-session"><span><UIIcon name="clock" size={15} /> TIME</span><strong>{String(Math.floor(elapsedTime / 60)).padStart(2, '0')}:{String(elapsedTime % 60).padStart(2, '0')}</strong><span>{challenge ? 'Double or Nothing' : 'Classic Run'}</span></div><button ref={resumeRef} type="button" className="lx-button lx-button-primary" onClick={event => runAction(event, resumeGame)}>Resume <UIIcon name="play" /></button><div className="lx-pause-secondary"><button type="button" className="lx-button lx-button-secondary" onClick={event => runAction(event, onRestart)}><UIIcon name="restart" size={17} /> Restart Race</button><button type="button" className="lx-button lx-button-secondary" onClick={event => runAction(event, onGarage)}><UIIcon name="garage" size={17} /> Garage</button></div><button type="button" className="lx-button lx-button-secondary lx-pause-menu" onClick={event => runAction(event, onMainMenu)}><UIIcon name="arrowLeft" size={17} /> Main Menu</button><small><kbd>Esc</kbd> or <kbd>P</kbd> to resume</small></section></div>;
}

export default function RaceHUD({ onMainMenu, onRestart, onGarage }) {
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
      <div className="lx-hud-top"><RaceScore /><RaceProgress /><div className="lx-hud-actions"><button type="button" data-action="audio" className="lx-icon-button" onClick={event => runHudAction(event, () => setSoundEnabled(!soundEnabled))} aria-label={soundEnabled ? 'Mute sound' : 'Unmute sound'} title={soundEnabled ? 'Mute sound (M)' : 'Unmute sound (M)'} aria-pressed={!soundEnabled}><UIIcon name={soundEnabled ? 'volume' : 'muted'} /></button><button type="button" data-action="pause" className="lx-icon-button" onClick={event => runHudAction(event, togglePause)} aria-label="Pause Race" title="Pause (Esc / P)"><UIIcon name="pause" /></button></div></div>
      <RunBuild /><RaceTelemetry /><RaceMessage />
      {gameState === 'countdown' ? <div className="lx-countdown" role="status" aria-live="assertive"><p>GET READY</p><strong key={countdown} className={countdown === 'GO!' ? 'is-start' : undefined}>{countdown}</strong><span className="lx-countdown-keyboard"><span><UIIcon name="handling" size={17} /> Steer: ← → / A D</span><i /><span><UIIcon name="nitro" size={17} /> Nitro: hold SPACE</span></span><span className="lx-countdown-touch"><span><UIIcon name="handling" size={17} /> Steer: hold the left / right side of the screen</span><i /><span><UIIcon name="nitro" size={17} /> Nitro: hold the button</span></span></div> : null}
    </div>
    {paused ? <PauseDialog onMainMenu={onMainMenu || (() => setGameState('launcher'))} onGarage={onGarage || (() => useGameStore.getState().openGarage())} onRestart={onRestart || (() => startGame())} /> : null}
  </div>;
}
