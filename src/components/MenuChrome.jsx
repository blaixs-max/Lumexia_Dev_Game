import { useGameStore } from '../store';
import UIIcon from './UIIcon';

export function MenuHeader({ section = 'MAIN MENU', onBack }) {
  const gold = useGameStore(s => s.garageGold);
  const sound = useGameStore(s => s.soundEnabled);
  const toggleSound = useGameStore(s => s.toggleSound);
  const sectionLabel = section === 'GARAGE' ? 'Garaj' : section === 'MAIN MENU' ? 'Ana menü' : section;
  return <header className="lx-menu-header">
    <div className="lx-menu-brand"><span className="lx-menu-brand-symbol" aria-hidden="true"><UIIcon name="road" size={29} /></span><div><strong>LUMEXIA</strong><small>OTOYOL YARIŞI</small></div></div>
    <nav className="lx-menu-location" aria-label="Bulunduğun ekran">{onBack ? <button type="button" onClick={onBack} aria-label="Ana menüye dön"><UIIcon name="arrowLeft" size={17} /><span>Ana menü</span></button> : <span>Ana menü</span>}{onBack ? <span>/ {sectionLabel}</span> : null}</nav>
    <div className="lx-menu-account"><div className="lx-menu-gold" aria-label={`${gold.toLocaleString('tr-TR')} altın`}><UIIcon name="coin" size={20} /><strong>{gold.toLocaleString('tr-TR')}</strong><small>Altın</small></div><button type="button" className="lx-menu-sound" onClick={toggleSound} title={sound ? 'Sesi kapat' : 'Sesi aç'} aria-label={sound ? 'Sesi kapat' : 'Sesi aç'} aria-pressed={!sound}><UIIcon name={sound ? 'volume' : 'muted'} size={20} /></button></div>
  </header>;
}

export function MenuFooter({ quality, onQualityChange }) {
  const saved = useGameStore(s => s.garageSaved);
  return <footer className="lx-menu-footer"><div className="lx-menu-footer-notes"><span role={saved ? undefined : 'status'}><UIIcon name={saved ? 'save' : 'info'} size={16} />{saved ? 'İlerlemen bu cihazda saklanır.' : 'İlerleme kaydedilemedi. Tarayıcı depolamasını kontrol et.'}</span><a href="/models/realistic/credits.html" target="_blank" rel="noopener noreferrer">Model katkıları</a></div><label><UIIcon name="settings" size={16} /><span>Grafik</span><select aria-label="Grafik kalitesi" value={quality} onChange={event => onQualityChange(event.target.value)}><option value="auto">Otomatik</option><option value="performance">Performans</option><option value="high">Yüksek</option></select></label></footer>;
}
