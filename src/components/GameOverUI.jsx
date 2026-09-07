import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { calculateFinalScore } from '../utils/gameplay';
import './RaceUI.css';

const displayNumber = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString();

export default function GameOverUI({ score = 0, totalDistance = 0, nearMissCount = 0, coinsCollected = 0, onRestart, onMainMenu }) {
  const gameMode = useGameStore(state => state.gameMode);
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
    retryRef.current?.focus();
    if (finalScore > previousBest) {
      try { localStorage.setItem(storageKey, String(finalScore)); } catch { /* Private browsing can disable storage. */ }
    }
  }, [finalScore, previousBest, storageKey]);

  const minutes = String(Math.floor(elapsedTime / 60)).padStart(2, '0');
  const seconds = String(elapsedTime % 60).padStart(2, '0');

  return (
    <main className="lx-ui lx-results" aria-labelledby="lx-result-title">
      <div className="lx-result-shell">
        <div className="lx-result-topline"><span className="lx-wordmark">LUMEXIA /</span><span className="lx-status"><i /> PRACTICE SESSION</span></div>
        <p className="lx-eyebrow">RUN COMPLETE / {gameMode === 'doubleOrNothing' ? 'DOUBLE OR NOTHING' : 'CLASSIC'}</p>
        <h1 id="lx-result-title">ONE MORE<em> RUN?</em></h1>
        <p className="lx-result-intro">Every close call sharpens your instinct. Find your next line.</p>
        <section className="lx-result-score" aria-label="Final score">
          <div className="lx-section-heading"><h2>FINAL SCORE</h2>{isNewBest ? <span className="lx-best-badge">↗ NEW PERSONAL BEST</span> : <span>LEVEL {String(currentLevel).padStart(2, '0')}</span>}</div>
          <p><strong>{displayNumber(finalScore)}</strong><span>PTS</span></p>
          <div className="lx-score-baseline"><span>LOCAL BEST <b>{displayNumber(best)}</b></span><span>{isNewBest && previousBest > 0 ? `+${displayNumber(finalScore - previousBest)} IMPROVEMENT` : 'CHASE YOUR NEXT RECORD'}</span></div>
        </section>
        {gameMode === 'doubleOrNothing' ? <p className={`lx-challenge-result ${reachedLevel5 ? 'is-won' : ''}`}>{reachedLevel5 ? `Level 5 reached. ${displayNumber(score)} × 2 = ${displayNumber(finalScore)} points.` : `Level 5 was not reached. Your ${displayNumber(score)} run points become 0 in this challenge.`}</p> : null}
        <dl className="lx-result-stats"><div><dt>DISTANCE</dt><dd>{displayNumber(totalDistance)}<small> m</small></dd></div><div><dt>NEAR MISSES</dt><dd>{displayNumber(nearMissCount)}</dd></div><div><dt>COINS</dt><dd>{displayNumber(coinsCollected)}</dd></div><div><dt>DRIVE TIME</dt><dd>{minutes}<small>:</small>{seconds}</dd></div></dl>
        <div className="lx-result-actions"><button ref={retryRef} type="button" className="lx-button lx-button-primary" onClick={onRestart}>RACE AGAIN <span aria-hidden="true">↗</span></button><button type="button" className="lx-button lx-button-secondary" onClick={onMainMenu}>BACK TO GARAGE</button></div>
        <p className="lx-result-note">Free practice • No credits used • Scores are local to this device</p>
      </div>
    </main>
  );
}
