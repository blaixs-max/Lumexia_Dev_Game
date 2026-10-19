import { useEffect, useRef, useState } from 'react';
import { CARS, EQUIPMENT, getCar, getCarStats, getUpgradeCost } from '../utils/garage';
import { compareCarStats } from '../utils/garage-comparison';
import { useGameStore } from '../store';
import VehicleShowroom from './VehicleShowroom';
import UIIcon from './UIIcon';
import './Garage.css';

const formatNumber = value => value.toLocaleString('en-US', { maximumFractionDigits: 1 });
const PART_LABELS = { engine: 'Engine', handling: 'Handling', nitro: 'Nitro System' };
const formatStat = (value, precision) => value.toLocaleString('en-US', { maximumFractionDigits: precision });

function ComparisonRow({ stat, carName, selectedName }) {
  const { label, value, selectedValue, difference, relation, precision, unit, max, icon } = stat;
  const differenceLabel = relation === 'equal' ? 'Equal' : `${difference > 0 ? '+' : '−'}${formatStat(Math.abs(difference), precision)} ${relation === 'better' ? 'better' : 'lower'}`;
  return <div className={`lx-compare-stat is-${relation}`} role="group" aria-label={label}>
    <div className="lx-compare-stat-heading"><span><UIIcon name={icon} size={17} />{label}</span><span className="lx-compare-difference">{differenceLabel}</span></div>
    <div className="lx-compare-stat-values">
      {[{ name: carName, value, kind: 'inspected' }, { name: selectedName, value: selectedValue, kind: 'selected' }].map(entry => <div className={`lx-compare-value is-${entry.kind}`} key={entry.kind}>
        <strong>{formatStat(entry.value, precision)}</strong><small>{unit}</small>
        <div className="lx-compare-track" role="meter" aria-label={`${entry.name} ${label}${entry.kind === 'selected' ? ', equipped car' : ', browsing'}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={entry.value} aria-valuetext={`${formatStat(entry.value, precision)} ${unit}`}><i style={{ width: `${Math.min(100, entry.value / max * 100)}%` }} /></div>
      </div>)}
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
  const selectButton = useRef(null);
  const focusAfterPurchase = useRef(false);
  const car = getCar(inspectedCar);
  const carIndex = CARS.findIndex(entry => entry.id === car.id);
  const isOwned = ownedCars.includes(car.id);
  const isSelected = car.id === selectedCar;
  const fitted = upgrades[car.id];
  const stats = getCarStats(car.id, fitted);
  const selected = getCar(selectedCar);
  const comparison = compareCarStats(car.id, fitted, selectedCar, upgrades[selectedCar]);
  const betterCount = comparison.filter(stat => stat.relation === 'better').length;
  const worseCount = comparison.filter(stat => stat.relation === 'worse').length;
  const shortfall = Math.max(0, car.price - gold);

  useEffect(() => {
    if (isOwned && focusAfterPurchase.current) {
      selectButton.current?.focus({ preventScroll: true });
      focusAfterPurchase.current = false;
    }
  }, [isOwned]);

  const inspect = carId => { setInspectedCar(carId); setNotice(''); };
  const cycleCar = direction => inspect(CARS[(carIndex + direction + CARS.length) % CARS.length].id);
  const activateCar = () => {
    if (disabled || !isOwned || isSelected) return;
    selectCar(car.id);
    setNotice(`${car.name} selected for your next race.`);
  };
  const buyCar = () => {
    const result = purchaseCar(car.id, { selectOnPurchase: false });
    if (result.success) focusAfterPurchase.current = true;
    setNotice(result.success ? `${car.name} purchased for ${formatNumber(result.cost)} Gold. Hit Select to take it racing.`
      : result.reason === 'insufficient-gold' ? 'Not enough Gold. Complete races to earn more.' : 'This car is currently unavailable for purchase.');
  };
  const buyUpgrade = part => {
    if (!isSelected || !isOwned) return;
    const result = purchaseUpgrade(part.id);
    setNotice(result.success ? `${car.name}: Stage ${result.level} ${PART_LABELS[part.id]} installed for ${formatNumber(result.cost)} Gold.`
      : result.reason === 'insufficient-gold' ? 'Not enough Gold. Complete races to earn more.' : 'This upgrade is currently unavailable.');
  };
  const describeGain = part => {
    const next = getCarStats(car.id, { ...fitted, [part]: fitted[part] + 1 });
    if (part === 'engine') return `Top Speed: ${formatNumber(stats.cruiseSpeed)} → ${formatNumber(next.cruiseSpeed)} units`;
    if (part === 'handling') return `Handling: ${formatNumber(stats.steeringRate)} → ${formatNumber(next.steeringRate)} rating`;
    return `Nitro Capacity: ${formatNumber(stats.maxNitro)} → ${formatNumber(next.maxNitro)} units`;
  };

  return <section className="lx-workbench" aria-labelledby="garage-title">
    <header className="lx-workbench-heading">
      <div><p className="lx-bay-kicker">Choose your car. Gear up for the race.</p><h1 id="garage-title">YOUR <em>GARAGE.</em></h1></div>
      <span className="lx-bay-collection"><UIIcon name="car" size={20} /><span><strong>{ownedCars.length}</strong> / {CARS.length} cars owned</span></span>
    </header>
    <div className="lx-bay-layout">
      <section className="lx-bay-vehicle" aria-labelledby="garage-car-name">
        <div className="lx-bay-nameplate"><span>{car.classLabel}</span><h2 id="garage-car-name">{car.name}</h2><small>{carIndex + 1} / {CARS.length}</small></div>
        <div className="lx-bay-scene">
          <VehicleShowroom carId={car.id} quality={quality} interactive variant="workshop" />
          <button type="button" className="lx-bay-arrow is-prev" onClick={() => cycleCar(-1)} disabled={disabled} aria-label="Previous car"><UIIcon name="arrowLeft" size={28} /></button>
          <button type="button" className="lx-bay-arrow is-next" onClick={() => cycleCar(1)} disabled={disabled} aria-label="Next car"><UIIcon name="arrowRight" size={28} /></button>
          <span className="lx-bay-drag"><UIIcon name="handling" size={16} />Drag to rotate</span>
          <div className="lx-bay-scene-actions" role="group" aria-label={`${car.name} car actions`}>
            <button ref={selectButton} type="button" className={`lx-bay-action lx-bay-select ${isSelected ? 'is-current' : ''}`} disabled={disabled || !isOwned || isSelected} onClick={activateCar} aria-label={isSelected ? `${car.name} selected for racing` : `Select ${car.name}`} aria-describedby="garage-action-hint">
              <span><UIIcon name={isSelected ? 'check' : 'car'} size={19} />{isSelected ? 'Selected' : 'Select'}</span><small>{isSelected ? 'Race-ready' : isOwned ? 'Take it racing' : 'Purchase first'}</small>
            </button>
            <button type="button" className="lx-bay-action lx-bay-purchase" disabled={disabled || isOwned || shortfall > 0} onClick={buyCar} aria-label={isOwned ? `${car.name} owned` : `Purchase ${car.name} for ${formatNumber(car.price)} Gold`} aria-describedby="garage-action-hint">
              <span><UIIcon name={isOwned ? 'check' : 'coin'} size={19} />{isOwned ? 'Owned' : 'Purchase'}</span><small>{isOwned ? 'In your garage' : `${formatNumber(car.price)} Gold`}</small>
            </button>
          </div>
        </div>
        <div className="lx-bay-vehicle-controls">
          <p id="garage-action-hint" className={`lx-bay-action-hint ${!isOwned && shortfall > 0 ? 'is-shortfall' : ''}`} role="status" aria-live="polite"><UIIcon name={isSelected ? 'check' : !isOwned && shortfall > 0 ? 'coin' : 'info'} size={15} />{notice || (isSelected ? 'This car is selected for your next race.' : isOwned ? 'Hit Select to take this car racing.' : shortfall > 0 ? `${formatNumber(shortfall)} more Gold needed. Complete races to earn more.` : 'Purchase to add this car to your garage, then select it to race.')}</p>
          <div className="lx-bay-car-tabs" role="group" aria-label="Browse cars">{CARS.map(entry => <button type="button" key={entry.id} disabled={disabled} aria-pressed={entry.id === car.id} aria-label={`Browse ${entry.name}`} onClick={() => inspect(entry.id)}><UIIcon name={entry.id === selectedCar ? 'check' : ownedCars.includes(entry.id) ? 'car' : 'lock'} size={15} />{entry.name}<span>{entry.id === selectedCar ? 'Selected for racing' : ownedCars.includes(entry.id) ? 'Owned' : `${formatNumber(entry.price)} Gold`}</span></button>)}</div>
        </div>
      </section>
      <aside className="lx-bay-specs" aria-labelledby="garage-specs-title">
        <header><p className="lx-compare-kicker">CAR COMPARISON</p><h2 id="garage-specs-title">Performance</h2><p className="lx-compare-summary">{isSelected ? 'Your equipped car is on display. Browse another car to compare stats.' : <><strong>{betterCount} better</strong><span> · </span><b>{worseCount} lower</b><span> · {comparison.length - betterCount - worseCount} equal</span></>}</p></header>
        <div className="lx-compare-cars"><div className="is-inspected"><span><i />Browsing</span><strong>{car.name}</strong></div><div className="is-selected"><span><i />Equipped</span><strong>{selected.name}</strong></div></div>
        <div className="lx-compare-rows">{comparison.map(stat => <ComparisonRow key={stat.id} stat={stat} carName={car.name} selectedName={selected.name} />)}</div>
        <p className="lx-bay-spec-note"><UIIcon name="info" size={16} />Installed upgrades included. Higher is better for every stat. Speeds use game units.</p>
      </aside>
      <section className="lx-bay-equipment" aria-labelledby="garage-equipment-title">
        <header><div><p className="lx-bay-kicker">Tune your car. Raise your game.</p><h2 id="garage-equipment-title">Parts & Upgrades</h2></div><span>{isSelected ? `${EQUIPMENT.reduce((total, part) => total + fitted[part.id], 0)} / 9 stages installed` : 'Car preview'}</span></header>
        {!isSelected ? <p className="lx-bay-fit-note">{isOwned ? `Select ${car.name} to upgrade it.` : `Purchase ${car.name} to unlock upgrades.`} Equipped car: <strong>{getCar(selectedCar).name}</strong>.</p> : <p className="lx-bay-fit-note">Upgrades are fitted immediately to your selected <strong>{car.name}</strong>. Each part can be upgraded to Stage 3.</p>}
        <div className="lx-bay-parts">{EQUIPMENT.map(part => {
          const stage = fitted[part.id], cost = getUpgradeCost(part.id, stage), maxed = cost === null;
          const locked = !isSelected || !isOwned;
          const label = PART_LABELS[part.id];
          return <article className={`lx-bay-part ${stage ? 'is-fitted' : ''}`} key={part.id}>
            <div className="lx-bay-part-image"><img src={`/equipment/${part.id}.png`} alt="" width="112" height="112" /><span>{stage ? `Stage ${stage} / 3` : 'Stock'}</span></div>
            <div className="lx-bay-part-content">
              <div className="lx-bay-part-title"><h3><UIIcon name={part.id} size={18} />{label}</h3><span aria-label={`${label}: ${stage} of 3 stages installed`}>{[1, 2, 3].map(tier => <i key={tier} className={stage >= tier ? 'is-filled' : ''} />)}</span></div>
              <p>{maxed ? 'Maximum stage installed' : describeGain(part.id)}</p>
              <button type="button" className="lx-bay-upgrade" disabled={disabled || locked || maxed || gold < cost} onClick={() => buyUpgrade(part)} aria-label={locked ? `Purchase or select ${car.name} to upgrade ${label}` : maxed ? `${label} maxed out` : `Upgrade ${label} to Stage ${stage + 1} for ${formatNumber(cost)} Gold`}>
                <span><UIIcon name={locked ? 'lock' : maxed ? 'check' : 'upgrade'} size={16} />{locked ? isOwned ? 'Select car first' : 'Purchase first' : maxed ? 'Maxed Out' : `Stage ${stage + 1} Upgrade`}</span>
                {!maxed ? <strong><UIIcon name="coin" size={15} />{formatNumber(cost)} Gold</strong> : null}
              </button>
              {!locked && !maxed && gold < cost ? <small className="lx-bay-part-shortfall">{formatNumber(cost - gold)} more Gold needed</small> : null}
            </div>
          </article>;
        })}</div>
      </section>
      <div className="lx-bay-ready"><p>Your equipped car<br /><strong>{getCar(selectedCar).name}</strong></p><button type="button" onClick={onDone} className="lx-bay-done"><UIIcon name="arrowLeft" size={20} />Back to Main Menu</button><span>Your selection saves automatically</span></div>
    </div>
    <div className="lx-bay-save"><span><UIIcon name={saved ? 'save' : 'info'} size={16} />{saved ? 'Cars and upgrades saved on this device.' : 'Device storage unavailable. Progress is saved for this session only.'}</span><span><UIIcon name="coin" size={16} />Completed races: 25 Gold per coin, plus 1 Gold every 10 meters.</span></div>
  </section>;
}
