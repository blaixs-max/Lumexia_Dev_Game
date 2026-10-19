import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { calculateFinalScore } from '../utils/gameplay';
import { getCar } from '../utils/garage';
import UIIcon from './UIIcon';
import './RaceUI.css';
import './Garage.css';

const displayNumber = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('en-US');

export default function GameOverUI({ score = 0, totalDistance = 0, nearMissCount = 0, coinsCollected = 0, onRestart, onMainMenu, onGarage }) {
  const gameMode = useGameStore(state => state.gameMode);
  const runCar = useGameStore(state => state.runCar);
  const earnedGold = useGameStore(state => state.lastRunGold);
  const gold = useGameStore(state => state.garageGold);
  const saved = useGameStore(state => state.garageSaved);
  const reachedLevel5 = useGameStore(state => state.reachedLevel5);
  const elapsedTime = useGameStore(state => Math.floor(state.elapsedTime || 0));
  const currentLevel = useGameStore(state => state.currentLevel);
  const retryRef = useRef();
  const finalScore = calculateFinalScore(score, gameMode, reachedLevel5);
  const storageKey = `lumexia.best.v1.${gameMode}`;
  const [previousBest] = useState(() => {
    try {
      const value = Number(localStorage.getItem(storageKey));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch { return 0; }
  });
  const isNewBest = finalScore > previousBest;
  const best = Math.max(previousBest, finalScore);

  useEffect(() => {
    retryRef.current?.focus({ preventScroll: true });
    if (finalScore > previousBest) {
      try { localStorage.setItem(storageKey, String(finalScore)); } catch { /* Private browsing can disable storage. */ }
    }
  }, [finalScore, previousBest, storageKey]);

  const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
  const seconds = String(elapsedTime % 60).padStart(2, '0');

  return (
    <main className="lx-ui lx-results" aria-labelledby="lx-result-title">
      <div className="lx-result-shell">
        <div className="lx-result-topline"><span className="lx-wordmark">LUMEXIA /</span><span className="lx-status"><UIIcon name="flag" size={16} /> RACE RESULTS</span></div>
        <p className="lx-eyebrow">{gameMode === 'doubleOrNothing' ? 'Double or Nothing' : 'Classic Run'} · {getCar(runCar).name}</p>
        <h1 id="lx-result-title">RUN <em>COMPLETE</em></h1>
        <p className="lx-result-intro">Hit the road again or spend your Gold on upgrades in the Garage.</p>
        <section className="lx-result-score" aria-label="Final score">
          <div className="lx-section-heading"><h2><UIIcon name="trophy" size={17} /> FINAL SCORE</h2>{isNewBest ? <span className="lx-best-badge"><UIIcon name="trophy" size={14} /> NEW PERSONAL BEST</span> : <span>LEVEL {String(currentLevel).padStart(2, '0')}</span>}</div>
          <p><strong>{displayNumber(finalScore)}</strong><span>POINTS</span></p>
          <div className="lx-score-baseline"><span>PERSONAL BEST <b>{displayNumber(best)}</b></span>{isNewBest && previousBest > 0 ? <span>+{displayNumber(finalScore - previousBest)} points</span> : null}</div>
        </section>
        {gameMode === 'doubleOrNothing' ? <p className={`lx-challenge-result ${reachedLevel5 ? 'is-won' : ''}`}><UIIcon name={reachedLevel5 ? 'check' : 'info'} size={18} /><span>{reachedLevel5 ? `Level 5 reached. Your score is doubled: ${displayNumber(finalScore)} points.` : `Level 5 not reached. Your ${displayNumber(score)} run points become a final score of 0.`}<small>You keep all Gold earned during the race.</small></span></p> : null}
        <dl className="lx-result-stats"><div><dt><UIIcon name="distance" size={16} /> DISTANCE</dt><dd>{displayNumber(totalDistance)}<small> m</small></dd></div><div><dt><UIIcon name="nearMiss" size={16} /> NEAR MISSES</dt><dd>{displayNumber(nearMissCount)}</dd></div><div><dt><UIIcon name="coin" size={16} /> COINS COLLECTED</dt><dd>{displayNumber(coinsCollected)}</dd></div><div><dt><UIIcon name="clock" size={16} /> TIME</dt><dd>{minutes}<small>:</small>{seconds}</dd></div></dl>
        <div className="lx-run-reward" aria-label={`Gold earned: ${displayNumber(earnedGold)}. Balance: ${displayNumber(gold)} Gold.`}><div><span><UIIcon name="coin" size={17} /> RACE EARNINGS</span><small>25 Gold per coin + 1 Gold per 10 m</small></div><div><strong>+{displayNumber(earnedGold)}</strong><small>BALANCE {displayNumber(gold)} GOLD</small></div></div>
        <div className="lx-result-actions"><button ref={retryRef} type="button" className="lx-button lx-button-primary" onClick={onRestart}><UIIcon name="restart" /> Race Again</button><button type="button" className="lx-button lx-button-secondary" onClick={onGarage || (() => useGameStore.getState().openGarage())}><UIIcon name="garage" /> Garage</button><button type="button" className="lx-button lx-button-secondary" onClick={onMainMenu}><UIIcon name="arrowLeft" /> Main Menu</button></div>
        <p className="lx-result-note" role={saved ? undefined : 'status'}><UIIcon name={saved ? 'save' : 'info'} size={14} />{saved ? 'Your personal bests, cars, and Gold are saved on this device.' : 'Device storage is unavailable. Your progress is saved for this session only.'}</p>
      </div>
    </main>
  );
}
