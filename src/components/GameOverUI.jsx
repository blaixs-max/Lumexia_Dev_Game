import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { calculateFinalScore } from '../utils/gameplay';
import { getCar } from '../utils/garage';
import UIIcon from './UIIcon';
import './RaceUI.css';
import './Garage.css';

const displayNumber = value => Math.max(0, Math.floor(Number(value) || 0)).toLocaleString('tr-TR');

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
        <div className="lx-result-topline"><span className="lx-wordmark">LUMEXIA /</span><span className="lx-status"><UIIcon name="flag" size={16} /> YARIŞ SONUCU</span></div>
        <p className="lx-eyebrow">{gameMode === 'doubleOrNothing' ? 'Double or Nothing' : 'Classic Run'} · {getCar(runCar).name}</p>
        <h1 id="lx-result-title">Yarış <em>tamamlandı</em></h1>
        <p className="lx-result-intro">Yeniden yarışabilir veya kazandığın altınla garajda aracını geliştirebilirsin.</p>
        <section className="lx-result-score" aria-label="Sonuç puanı">
          <div className="lx-section-heading"><h2><UIIcon name="trophy" size={17} /> SONUÇ PUANI</h2>{isNewBest ? <span className="lx-best-badge"><UIIcon name="trophy" size={14} /> YENİ REKOR</span> : <span>SEVİYE {String(currentLevel).padStart(2, '0')}</span>}</div>
          <p><strong>{displayNumber(finalScore)}</strong><span>PUAN</span></p>
          <div className="lx-score-baseline"><span>BU CİHAZDAKİ REKOR <b>{displayNumber(best)}</b></span>{isNewBest && previousBest > 0 ? <span>+{displayNumber(finalScore - previousBest)} puan</span> : null}</div>
        </section>
        {gameMode === 'doubleOrNothing' ? <p className={`lx-challenge-result ${reachedLevel5 ? 'is-won' : ''}`}><UIIcon name={reachedLevel5 ? 'check' : 'info'} size={18} /><span>{reachedLevel5 ? `Seviye 5 hedefine ulaştın. Skorun ikiye katlandı: ${displayNumber(finalScore)} puan.` : `Seviye 5 hedefine ulaşamadın. Bu modda ${displayNumber(score)} yarış puanın sonuçta 0 olur.`}<small>Altın kazancın bu kuraldan etkilenmez.</small></span></p> : null}
        <dl className="lx-result-stats"><div><dt><UIIcon name="distance" size={16} /> MESAFE</dt><dd>{displayNumber(totalDistance)}<small> m</small></dd></div><div><dt><UIIcon name="nearMiss" size={16} /> YAKIN GEÇİŞ</dt><dd>{displayNumber(nearMissCount)}</dd></div><div><dt><UIIcon name="coin" size={16} /> TOPLANAN JETON</dt><dd>{displayNumber(coinsCollected)}</dd></div><div><dt><UIIcon name="clock" size={16} /> SÜRE</dt><dd>{minutes}<small>:</small>{seconds}</dd></div></dl>
        <div className="lx-run-reward" aria-label={`Kazanılan altın: ${displayNumber(earnedGold)}. Toplam bakiye: ${displayNumber(gold)}.`}><div><span><UIIcon name="coin" size={17} /> KAZANILAN ALTIN</span><small>Her jeton 25 altın + her 10 m için 1 altın</small></div><div><strong>+{displayNumber(earnedGold)}</strong><small>BAKİYE {displayNumber(gold)} altın</small></div></div>
        <div className="lx-result-actions"><button ref={retryRef} type="button" className="lx-button lx-button-primary" onClick={onRestart}><UIIcon name="restart" /> Yeniden yarış</button><button type="button" className="lx-button lx-button-secondary" onClick={onGarage || (() => useGameStore.getState().openGarage())}><UIIcon name="garage" /> Garaj</button><button type="button" className="lx-button lx-button-secondary" onClick={onMainMenu}><UIIcon name="arrowLeft" /> Ana menü</button></div>
        <p className="lx-result-note" role={saved ? undefined : 'status'}><UIIcon name={saved ? 'save' : 'info'} size={14} />{saved ? 'Rekorun, araçların ve altının bu cihazda saklanır.' : 'Cihaz kaydı kullanılamıyor. İlerlemen yalnızca bu oturumda saklanır.'}</p>
      </div>
    </main>
  );
}
