import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store';
import { getCar, getCarStats } from '../utils/garage';
import VehicleShowroom from './VehicleShowroom';
import { MenuHeader, MenuFooter } from './MenuChrome';
import UIIcon from './UIIcon';
import './RaceUI.css';
import './MenuUI.css';

const MODES = [
  { id: 'classic', name: 'Classic Run', label: 'Sonsuz sürüş', detail: 'Trafiği aş, en yüksek skoruna ulaş.', icon: '/modes/classic-run.png', fallback: 'road' },
  { id: 'doubleOrNothing', name: 'Double or Nothing', label: 'İki katı ya da sıfır', detail: '5. seviyeye ulaş: skor ×2. Ulaşamazsan: 0.', icon: '/modes/double-or-nothing.png', fallback: 'flag' },
];

function ModeSymbol({ mode }) {
  const [status, setStatus] = useState('loading');
  return <span className="lx-format-mark" aria-hidden="true">
    {status !== 'loaded' ? <span className="lx-format-fallback"><UIIcon name={mode.fallback} size={30} /></span> : null}
    {status !== 'error' ? <img src={mode.icon} width="56" height="56" alt="" decoding="async" className={status === 'loaded' ? 'is-loaded' : ''} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} /> : null}
  </span>;
}

function RaceModeDialog({ initialMode, onStartGame, onDismiss }) {
  const dialogRef = useRef(null);
  const selectedInputRef = useRef(null);
  const inFlight = useRef(false);
  const [selectedMode, setSelectedMode] = useState(() => MODES.some(mode => mode.id === initialMode) ? initialMode : MODES[0].id);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = document.activeElement;
    dialog.showModal();
    selectedInputRef.current?.focus();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, []);

  const dismiss = () => {
    if (!inFlight.current) onDismiss();
  };
  const start = async event => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setStarting(true);
    setError('');
    try {
      await onStartGame({ gameMode: selectedMode });
    } catch {
      inFlight.current = false;
      setStarting(false);
      setError('Yarış başlatılamadı. Lütfen tekrar dene.');
    }
  };

  return <dialog
    id="race-mode-dialog"
    ref={dialogRef}
    className="lx-mode-dialog"
    aria-labelledby="race-mode-title"
    aria-describedby="race-mode-description"
    aria-modal="true"
    aria-busy={starting}
    onCancel={event => { event.preventDefault(); dismiss(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = event.currentTarget.querySelectorAll('button:not(:disabled)');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dismiss();
    }}
  >
    <form className="lx-mode-dialog-content" onSubmit={start}>
      <div className="lx-mode-dialog-topline">
        <span>YARIŞA HAZIRLAN</span>
        <button type="button" className="lx-mode-close" aria-label="Mod seçimini kapat" disabled={starting} onClick={dismiss}><UIIcon name="close" size={21} /></button>
      </div>
      <h2 id="race-mode-title">Yarış modunu seç</h2>
      <p id="race-mode-description">Nasıl yarışmak istersin? Modunu seç ve yola çık.</p>
      <fieldset className="lx-menu-mode-options" aria-label="Oyun modu" disabled={starting}>
        {MODES.map(mode => <label key={mode.id} className={mode.id === selectedMode ? 'is-selected' : ''}>
          <input ref={mode.id === selectedMode ? selectedInputRef : null} type="radio" name="race-mode" value={mode.id} checked={mode.id === selectedMode} onChange={() => setSelectedMode(mode.id)} />
          <ModeSymbol mode={mode} />
          <span className="lx-format-copy"><strong>{mode.name}</strong><span>{mode.label}</span><small>{mode.detail}</small></span>
          <span className="lx-format-selection" aria-hidden="true">{mode.id === selectedMode ? <UIIcon name="check" size={13} /> : null}</span>
        </label>)}
      </fieldset>
      {error ? <p role="alert" className="lx-error">{error}</p> : null}
      <div className="lx-mode-dialog-actions">
        <button type="button" className="lx-mode-back" disabled={starting} onClick={dismiss}>Geri dön</button>
        <button type="submit" className="lx-mode-start" disabled={starting}><span>{starting ? 'Hazırlanıyor…' : 'Yarışa başla'}</span><UIIcon name="arrowRight" size={20} /></button>
      </div>
    </form>
  </dialog>;
}

export default function RealLauncherUI({ onStartGame, quality = 'auto', onQualityChange }) {
  const selectedCar = useGameStore(s => s.selectedCar);
  const upgrades = useGameStore(s => s.garageUpgrades);
  const gameMode = useGameStore(s => s.gameMode);
  const openGarage = useGameStore(s => s.openGarage);
  const [modePickerOpen, setModePickerOpen] = useState(false);
  const car = getCar(selectedCar), stats = getCarStats(selectedCar, upgrades[selectedCar]);
  return <main className="lx-ui lx-menu-page" aria-label="Lumexia ana menü"><div className="lx-menu-shell">
    <MenuHeader />
    <div className="lx-menu-hero">
      <section className="lx-menu-intro" aria-labelledby="main-menu-title"><p className="lx-eyebrow">SONSUZ OTOYOL. YENİ BİR REKOR.</p><h1 id="main-menu-title">YOLA<br /><em>ÇIK.</em></h1><p className="lx-menu-description">Trafiği aş. Altın kazan.<br />Aracını geliştir, rekorunu yükselt.</p>
        <div className="lx-menu-actions"><button type="button" className="lx-menu-play" aria-haspopup="dialog" aria-controls="race-mode-dialog" onClick={() => setModePickerOpen(true)}><span><strong>Yarışa başla</strong></span><UIIcon name="play" size={28} /></button><button type="button" className="lx-menu-garage" onClick={openGarage}><span><strong>Garaj</strong><small>Araç seç ve geliştir</small></span><UIIcon name="garage" size={28} /></button></div>
      </section>
      <section className="lx-menu-showcase" aria-label="Seçili araç"><div className="lx-preview-topline"><span><UIIcon name="car" size={16} /> Seçili araç</span><span><UIIcon name="check" size={14} /> Yarışa hazır</span></div><VehicleShowroom carId={selectedCar} quality={quality} /><div className="lx-active-car"><div><small>{car.classLabel}</small><h2>{car.name}</h2></div><dl><div><dt><UIIcon name="speed" size={15} /> Normal hız</dt><dd>{stats.cruiseSpeed}<small>oyun hızı</small></dd></div><div><dt><UIIcon name="nitro" size={15} /> Nitro kapasitesi</dt><dd>{stats.maxNitro}<small>birim</small></dd></div></dl></div></section>
    </div>
    <details className="lx-menu-controls"><summary><UIIcon name="handling" size={18} /> Nasıl oynanır?</summary><div className="lx-control-tips"><p><UIIcon name="handling" size={20} /><span><strong>Yön ver</strong><span className="lx-tip-keyboard">← → veya A / D tuşlarını basılı tut.</span><span className="lx-tip-touch">Ekranın solunu veya sağını basılı tut.</span></span></p><p><UIIcon name="nitro" size={20} /><span><strong>Nitro kullan</strong><span className="lx-tip-keyboard">Boşluk tuşunu basılı tut. Nitro zamanla dolar.</span><span className="lx-tip-touch">Nitro düğmesini basılı tut. İki parmakla yön ve nitro birlikte kullanılır.</span></span></p><p><UIIcon name="pause" size={20} /><span><strong>Ara ver</strong><span className="lx-tip-keyboard">Esc veya P ile duraklat, M ile sesi aç / kapat.</span><span className="lx-tip-touch">Sağ üstteki duraklatma ve ses düğmelerini kullan.</span></span></p></div></details>
    <MenuFooter quality={quality} onQualityChange={onQualityChange} />
  </div>{modePickerOpen ? <RaceModeDialog initialMode={gameMode} onStartGame={onStartGame} onDismiss={() => setModePickerOpen(false)} /> : null}</main>;
}
