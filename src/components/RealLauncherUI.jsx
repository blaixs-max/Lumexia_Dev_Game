import { useState } from 'react';
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
const CAR_CLASSES = { BALANCED: 'Dengeli', 'GRAND TOURER': 'Uzun yol', SPRINT: 'Atak' };

function ModeSymbol({ mode }) {
  const [status, setStatus] = useState('loading');
  return <span className="lx-format-mark" aria-hidden="true">
    {status !== 'loaded' ? <span className="lx-format-fallback"><UIIcon name={mode.fallback} size={30} /></span> : null}
    {status !== 'error' ? <img src={mode.icon} width="56" height="56" alt="" decoding="async" className={status === 'loaded' ? 'is-loaded' : ''} onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} /> : null}
  </span>;
}

export default function RealLauncherUI({ onStartGame, quality = 'auto', onQualityChange }) {
  const selectedCar = useGameStore(s => s.selectedCar);
  const upgrades = useGameStore(s => s.garageUpgrades);
  const gameMode = useGameStore(s => s.gameMode);
  const setGameMode = useGameStore(s => s.setGameMode);
  const openGarage = useGameStore(s => s.openGarage);
  const [starting, setStarting] = useState(false), [error, setError] = useState('');
  const car = getCar(selectedCar), stats = getCarStats(selectedCar, upgrades[selectedCar]);
  const start = async () => {
    if (starting) return;
    setStarting(true); setError('');
    try { await onStartGame({ gameMode }); }
    catch { setStarting(false); setError('Yarış başlatılamadı. Lütfen tekrar dene.'); }
  };
  const modeName = MODES.find(mode => mode.id === gameMode)?.name || MODES[0].name;
  return <main className="lx-ui lx-menu-page" aria-label="Lumexia ana menü"><div className="lx-menu-shell">
    <MenuHeader />
    <div className="lx-menu-hero">
      <section className="lx-menu-intro" aria-labelledby="main-menu-title"><p className="lx-eyebrow">SONSUZ OTOYOL. YENİ BİR REKOR.</p><h1 id="main-menu-title">YOLA<br /><em>ÇIK.</em></h1><p className="lx-menu-description">Trafiği aş. Altın kazan.<br />Aracını geliştir, rekorunu yükselt.</p>
        <div className="lx-menu-actions"><button type="button" className="lx-menu-play" disabled={starting} onClick={start}><span><strong>{starting ? 'Hazırlanıyor…' : 'Yarışa başla'}</strong><small>{modeName}</small></span><UIIcon name="play" size={28} /></button><button type="button" className="lx-menu-garage" disabled={starting} onClick={openGarage}><span><strong>Garaj</strong><small>Araç seç ve geliştir</small></span><UIIcon name="garage" size={28} /></button></div>
        {error ? <p role="alert" className="lx-error">{error}</p> : null}
      </section>
      <section className="lx-menu-showcase" aria-label="Seçili araç"><div className="lx-preview-topline"><span><UIIcon name="car" size={16} /> Seçili araç</span><span><UIIcon name="check" size={14} /> Yarışa hazır</span></div><VehicleShowroom carId={selectedCar} quality={quality} /><div className="lx-active-car"><div><small>{CAR_CLASSES[car.className] || car.className}</small><h2>{car.name}</h2></div><dl><div><dt><UIIcon name="speed" size={15} /> Normal hız</dt><dd>{stats.cruiseSpeed}<small>oyun hızı</small></dd></div><div><dt><UIIcon name="nitro" size={15} /> Nitro kapasitesi</dt><dd>{stats.maxNitro}<small>birim</small></dd></div></dl></div></section>
    </div>
    <section className="lx-menu-modes" aria-labelledby="menu-mode-title"><div className="lx-menu-modes-label"><span>OYUN MODU</span><h2 id="menu-mode-title">Nasıl yarışacaksın?</h2></div><div className="lx-menu-mode-options" role="group" aria-label="Oyun modu">{MODES.map(mode => <button type="button" key={mode.id} disabled={starting} aria-pressed={mode.id === gameMode} onClick={() => setGameMode(mode.id)} className={mode.id === gameMode ? 'is-selected' : ''}><ModeSymbol mode={mode} /><span className="lx-format-copy"><strong>{mode.name}</strong><span>{mode.label}</span><small>{mode.detail}</small></span><span className="lx-format-selection" aria-hidden="true">{mode.id === gameMode ? <UIIcon name="check" size={13} /> : null}</span></button>)}</div></section>
    <details className="lx-menu-controls"><summary><UIIcon name="handling" size={18} /> Nasıl oynanır?</summary><div className="lx-control-tips"><p><UIIcon name="handling" size={20} /><span><strong>Yön ver</strong><span className="lx-tip-keyboard">← → veya A / D tuşlarını basılı tut.</span><span className="lx-tip-touch">Ekranın solunu veya sağını basılı tut.</span></span></p><p><UIIcon name="nitro" size={20} /><span><strong>Nitro kullan</strong><span className="lx-tip-keyboard">Boşluk tuşunu basılı tut. Nitro zamanla dolar.</span><span className="lx-tip-touch">Nitro düğmesini basılı tut. İki parmakla yön ve nitro birlikte kullanılır.</span></span></p><p><UIIcon name="pause" size={20} /><span><strong>Ara ver</strong><span className="lx-tip-keyboard">Esc veya P ile duraklat, M ile sesi aç / kapat.</span><span className="lx-tip-touch">Sağ üstteki duraklatma ve ses düğmelerini kullan.</span></span></p></div></details>
    <MenuFooter quality={quality} onQualityChange={onQualityChange} />
  </div></main>;
}
