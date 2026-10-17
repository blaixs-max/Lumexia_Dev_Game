import { useState } from 'react';
import { CARS, EQUIPMENT, getCar, getCarStats, getUpgradeCost } from '../utils/garage';
import { useGameStore } from '../store';
import VehicleShowroom from './VehicleShowroom';
import UIIcon from './UIIcon';
import './Garage.css';

const formatNumber = value => value.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
const PART_LABELS = { engine: 'Motor', handling: 'Yol tutuşu', nitro: 'Nitro sistemi' };
const STAT_ICONS = { cruise: 'speed', boost: 'rocket', handling: 'handling', nitro: 'nitro' };

function StatRow({ id, label, value, unit, max }) {
  return <div className="lx-bay-stat">
    <UIIcon name={STAT_ICONS[id]} size={24} />
    <div>
      <div className="lx-bay-stat-value"><span>{label}</span><strong>{formatNumber(value)}<small>{unit}</small></strong></div>
      <div className="lx-bay-stat-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${formatNumber(value)} ${unit || ''}`}><i style={{ width: `${Math.min(100, value / max * 100)}%` }} /></div>
    </div>
  </div>;
}

export default function GaragePanel({ disabled = false, quality, onDone }) {
  const selectedCar = useGameStore(s => s.selectedCar);
  const ownedCars = useGameStore(s => s.garageOwnedCars);
  const upgrades = useGameStore(s => s.garageUpgrades);
  const selectCar = useGameStore(s => s.selectCar);
  const purchaseCar = useGameStore(s => s.purchaseCar);
  const purchaseUpgrade = useGameStore(s => s.purchaseUpgrade);
  const gold = useGameStore(s => s.garageGold);
  const saved = useGameStore(s => s.garageSaved);
  const [inspectedCar, setInspectedCar] = useState(selectedCar);
  const [notice, setNotice] = useState('');
  const car = getCar(inspectedCar);
  const carIndex = CARS.findIndex(entry => entry.id === car.id);
  const isOwned = ownedCars.includes(car.id);
  const isSelected = car.id === selectedCar;
  const fitted = upgrades[car.id];
  const stats = getCarStats(car.id, fitted);

  const inspect = carId => { setInspectedCar(carId); setNotice(''); };
  const cycleCar = direction => inspect(CARS[(carIndex + direction + CARS.length) % CARS.length].id);
  const activateCar = () => {
    if (isOwned) { selectCar(car.id); setNotice(`${car.name} sonraki yarış için seçildi.`); return; }
    const result = purchaseCar(car.id);
    setNotice(result.success ? `${car.name} satın alındı ve seçildi. ${formatNumber(result.cost)} altın harcandı.`
      : result.reason === 'insufficient-gold' ? 'Altının yetersiz. Yarışları tamamlayarak altın kazanabilirsin.' : 'Bu araç şu anda satın alınamıyor.');
  };
  const buyUpgrade = part => {
    if (!isSelected || !isOwned) return;
    const result = purchaseUpgrade(part.id);
    setNotice(result.success ? `${car.name}: ${PART_LABELS[part.id]} seviye ${result.level} takıldı. ${formatNumber(result.cost)} altın harcandı.`
      : result.reason === 'insufficient-gold' ? 'Altının yetersiz. Yarışları tamamlayarak altın kazanabilirsin.' : 'Bu yükseltme şu anda yapılamıyor.');
  };
  const describeGain = part => {
    const next = getCarStats(car.id, { ...fitted, [part]: fitted[part] + 1 });
    if (part === 'engine') return `Normal hız: ${formatNumber(stats.cruiseSpeed)} → ${formatNumber(next.cruiseSpeed)}`;
    if (part === 'handling') return `Direksiyon tepkisi: ${formatNumber(stats.steeringRate)} → ${formatNumber(next.steeringRate)}`;
    return `Nitro kapasitesi: ${formatNumber(stats.maxNitro)} → ${formatNumber(next.maxNitro)} birim`;
  };

  return <section className="lx-workbench" aria-labelledby="garage-title">
    <header className="lx-workbench-heading">
      <div><p className="lx-bay-kicker">Aracını seç, yarışa hazırlan</p><h1 id="garage-title">GARAJ<em>IN.</em></h1></div>
      <span className="lx-bay-collection"><UIIcon name="car" size={20} /><span><strong>{ownedCars.length}</strong> / {CARS.length} araç sende</span></span>
    </header>
    <div className="lx-bay-layout">
      <section className="lx-bay-vehicle" aria-labelledby="garage-car-name">
        <div className="lx-bay-nameplate"><span>{car.classLabel}</span><h2 id="garage-car-name">{car.name}</h2><small>{carIndex + 1} / {CARS.length}</small></div>
        <div className="lx-bay-scene">
          <VehicleShowroom carId={car.id} quality={quality} interactive variant="workshop" />
          <button type="button" className="lx-bay-arrow is-prev" onClick={() => cycleCar(-1)} disabled={disabled} aria-label="Önceki araç"><UIIcon name="arrowLeft" size={28} /></button>
          <button type="button" className="lx-bay-arrow is-next" onClick={() => cycleCar(1)} disabled={disabled} aria-label="Sonraki araç"><UIIcon name="arrowRight" size={28} /></button>
          <span className="lx-bay-drag"><UIIcon name="handling" size={16} />Aracı döndürmek için sürükle</span>
        </div>
        <div className="lx-bay-vehicle-controls">
          <div className="lx-bay-car-tabs" role="group" aria-label="Araçlara göz at">{CARS.map(entry => <button type="button" key={entry.id} disabled={disabled} aria-pressed={entry.id === car.id} aria-label={`${entry.name} aracını incele`} onClick={() => inspect(entry.id)}><UIIcon name={entry.id === selectedCar ? 'check' : ownedCars.includes(entry.id) ? 'car' : 'lock'} size={15} />{entry.name}<span>{entry.id === selectedCar ? 'Yarış için seçili' : ownedCars.includes(entry.id) ? 'Satın alındı' : `${formatNumber(entry.price)} altın`}</span></button>)}</div>
          <button type="button" className={`lx-bay-select ${isSelected ? 'is-current' : ''}`} disabled={disabled || isSelected || (!isOwned && gold < car.price)} onClick={activateCar} aria-label={isSelected ? `${car.name} yarış için seçili` : isOwned ? `${car.name} aracını seç` : `${car.name} aracını ${formatNumber(car.price)} altına satın al ve seç`}>
            <span><UIIcon name={isSelected ? 'check' : isOwned ? 'car' : 'coin'} size={18} />{isSelected ? 'Yarış için seçili' : isOwned ? 'Bu aracı seç' : 'Satın al ve seç'}</span>
            {!isOwned ? <strong>{formatNumber(car.price)} <small>altın</small></strong> : null}
          </button>
          {!isOwned && gold < car.price ? <p className="lx-bay-shortfall">{formatNumber(car.price - gold)} altın daha gerekli</p> : null}
        </div>
      </section>
      <aside className="lx-bay-specs" aria-labelledby="garage-specs-title">
        <header><h2 id="garage-specs-title">Performans</h2><span className={`lx-bay-ownership ${isSelected ? 'is-active' : ''}`}><UIIcon name={isSelected ? 'check' : isOwned ? 'car' : 'lock'} size={15} />{isSelected ? 'Yarış için seçili' : isOwned ? 'Satın alındı' : 'Satın alınabilir'}</span></header>
        <p className="lx-bay-car-description">{car.description}</p>
        <StatRow id="cruise" label="Normal hız" value={stats.cruiseSpeed} max={140} />
        <StatRow id="boost" label="Nitro ile hız" value={stats.boostSpeed} max={230} />
        <StatRow id="handling" label="Direksiyon tepkisi" value={stats.steeringRate} max={20} />
        <StatRow id="nitro" label="Nitro kapasitesi" value={stats.maxNitro} unit="birim" max={170} />
        <p className="lx-bay-spec-note"><UIIcon name="info" size={16} />Hız değerleri oyun ölçeğidir. Çubuk doldukça ilgili özellik güçlenir.</p>
      </aside>
      <section className="lx-bay-equipment" aria-labelledby="garage-equipment-title">
        <header><div><p className="lx-bay-kicker">Aracının özelliklerini geliştir</p><h2 id="garage-equipment-title">Ekipman ve yükseltmeler</h2></div><span>{isSelected ? `${EQUIPMENT.reduce((total, part) => total + fitted[part.id], 0)} / 9 seviye takılı` : 'Araç önizlemesi'}</span></header>
        {!isSelected ? <p className="lx-bay-fit-note">{isOwned ? `Yükseltmek için önce ${car.name} aracını seç.` : `Yükseltmeleri açmak için önce ${car.name} aracını satın al.`} Yarış için seçili araç: <strong>{getCar(selectedCar).name}</strong>.</p> : <p className="lx-bay-fit-note">Yükseltmeler seçili <strong>{car.name}</strong> aracına hemen takılır. Her ekipman 3 seviyeye kadar geliştirilebilir.</p>}
        <div className="lx-bay-parts">{EQUIPMENT.map(part => {
          const stage = fitted[part.id], cost = getUpgradeCost(part.id, stage), maxed = cost === null;
          const locked = !isSelected || !isOwned;
          const label = PART_LABELS[part.id];
          return <article className={`lx-bay-part ${stage ? 'is-fitted' : ''}`} key={part.id}>
            <div className="lx-bay-part-image"><img src={`/equipment/${part.id}.png`} alt="" width="112" height="112" /><span>{stage ? `Seviye ${stage} / 3` : 'Standart parça'}</span></div>
            <div className="lx-bay-part-content">
              <div className="lx-bay-part-title"><h3><UIIcon name={part.id} size={18} />{label}</h3><span aria-label={`${label}: 3 seviyenin ${stage} tanesi takılı`}>{[1, 2, 3].map(tier => <i key={tier} className={stage >= tier ? 'is-filled' : ''} />)}</span></div>
              <p>{maxed ? 'En yüksek seviye takılı' : describeGain(part.id)}</p>
              <button type="button" className="lx-bay-upgrade" disabled={disabled || locked || maxed || gold < cost} onClick={() => buyUpgrade(part)} aria-label={locked ? `${label} yükseltmek için ${car.name} aracını satın al veya seç` : maxed ? `${label} en yüksek seviyede` : `${label} ekipmanını ${formatNumber(cost)} altına seviye ${stage + 1} yap`}>
                <span><UIIcon name={locked ? 'lock' : maxed ? 'check' : 'upgrade'} size={16} />{locked ? isOwned ? 'Önce aracı seç' : 'Önce satın al' : maxed ? 'Tamamlandı' : `Seviye ${stage + 1} yap`}</span>
                {!maxed ? <strong><UIIcon name="coin" size={15} />{formatNumber(cost)} altın</strong> : null}
              </button>
              {!locked && !maxed && gold < cost ? <small className="lx-bay-part-shortfall">{formatNumber(cost - gold)} altın daha gerekli</small> : null}
            </div>
          </article>;
        })}</div>
      </section>
      <div className="lx-bay-ready"><p>Seçili yarış aracın<br /><strong>{getCar(selectedCar).name}</strong></p><button type="button" onClick={onDone} className="lx-bay-done"><UIIcon name="arrowLeft" size={20} />Ana menüye dön</button><span>Seçimin otomatik kaydedilir</span></div>
    </div>
    <p className="lx-bay-notice" role="status" aria-live="polite">{notice}</p>
    <div className="lx-bay-save"><span><UIIcon name={saved ? 'save' : 'info'} size={16} />{saved ? 'Araçlar ve yükseltmeler bu cihazda kaydedildi.' : 'Cihaz kaydı kullanılamıyor. İlerlemen yalnızca bu oturumda saklanır.'}</span><span><UIIcon name="coin" size={16} />Tamamlanan yarışlarda: her jeton 25 altın, her 10 metre 1 altın.</span></div>
  </section>;
}
