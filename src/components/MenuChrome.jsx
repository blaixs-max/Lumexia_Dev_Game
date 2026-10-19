import { useGameStore } from '../store';
import UIIcon from './UIIcon';

export function MenuHeader({ section = 'MAIN MENU', onBack }) {
  const gold = useGameStore(s => s.garageGold);
  const sound = useGameStore(s => s.soundEnabled);
  const toggleSound = useGameStore(s => s.toggleSound);
  const sectionLabel = section === 'GARAGE' ? 'Garage' : section === 'MAIN MENU' ? 'Main Menu' : section;
  return <header className="lx-menu-header">
    <div className="lx-menu-brand"><span className="lx-menu-brand-symbol" aria-hidden="true"><UIIcon name="road" size={29} /></span><div><strong>LUMEXIA</strong><small>HIGHWAY RACING</small></div></div>
    <nav className="lx-menu-location" aria-label="Current screen">{onBack ? <button type="button" onClick={onBack} aria-label="Return to Main Menu"><UIIcon name="arrowLeft" size={17} /><span>Main Menu</span></button> : <span>Main Menu</span>}{onBack ? <span>/ {sectionLabel}</span> : null}</nav>
    <div className="lx-menu-account"><div className="lx-menu-gold" aria-label={`${gold.toLocaleString('en-US')} Gold`}><UIIcon name="coin" size={20} /><strong>{gold.toLocaleString('en-US')}</strong><small>Gold</small></div><button type="button" className="lx-menu-sound" onClick={toggleSound} title={sound ? 'Mute sound' : 'Unmute sound'} aria-label={sound ? 'Mute sound' : 'Unmute sound'} aria-pressed={!sound}><UIIcon name={sound ? 'volume' : 'muted'} size={20} /></button></div>
  </header>;
}

export function MenuFooter({ quality, onQualityChange }) {
  const saved = useGameStore(s => s.garageSaved);
  return <footer className="lx-menu-footer"><div className="lx-menu-footer-notes"><span role={saved ? undefined : 'status'}><UIIcon name={saved ? 'save' : 'info'} size={16} />{saved ? 'Progress saved on this device.' : 'Could not save progress. Check your browser storage.'}</span><a href="/models/realistic/credits.html" target="_blank" rel="noopener noreferrer">Model Credits</a></div><label title="Your selected graphics quality stays fixed throughout the race."><UIIcon name="settings" size={16} /><span>Graphics</span><select aria-label="Graphics quality" value={quality} onChange={event => onQualityChange(event.target.value)}><option value="auto">Standard</option><option value="performance">Performance</option><option value="high">High</option></select></label></footer>;
}
