import { useGameStore } from '../store';
import GaragePanel from './GaragePanel';
import { MenuHeader, MenuFooter } from './MenuChrome';
import './MenuUI.css';

export default function GaragePage({ quality, onQualityChange }) {
  const quitGame = useGameStore(s => s.quitGame);
  return <main className="lx-ui lx-menu-page lx-workshop-page" aria-label="Lumexia garaj"><div className="lx-menu-shell lx-workshop-shell">
    <MenuHeader section="GARAJ" onBack={quitGame} />
    <GaragePanel quality={quality} onDone={quitGame} />
    <MenuFooter quality={quality} onQualityChange={onQualityChange} />
  </div></main>;
}
