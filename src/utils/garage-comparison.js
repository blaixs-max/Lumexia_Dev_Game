import { CARS, getCarStats } from './garage';

const fullBuild = { engine: 3, handling: 3, nitro: 3 };
const fullyUpgradedStats = CARS.map(car => getCarStats(car.id, fullBuild));
const definitions = [
  { id: 'cruiseSpeed', label: 'Top Speed', icon: 'speed', unit: 'game units', precision: 0 },
  { id: 'boostSpeed', label: 'Nitro Speed', icon: 'rocket', unit: 'game units', precision: 0 },
  { id: 'acceleration', label: 'Acceleration', icon: 'engine', unit: 'rating', precision: 2 },
  { id: 'steeringRate', label: 'Handling', icon: 'handling', unit: 'rating', precision: 1 },
  { id: 'maxNitro', label: 'Nitro Capacity', icon: 'nitro', unit: 'units', precision: 0 },
  { id: 'nitroRegenRate', label: 'Nitro Recharge', icon: 'clock', unit: 'units/s', precision: 2 },
];

function rounded(value, precision) {
  const result = Number(value.toFixed(precision));
  return result === 0 ? 0 : result;
}

// Every car uses the same scale, including all available upgrade stages.
export const GARAGE_STATS = Object.freeze(definitions.map(definition => Object.freeze({
  ...definition,
  key: definition.id,
  max: rounded(Math.max(...fullyUpgradedStats.map(stats => stats[definition.id])), definition.precision),
})));

export function compareCarStats(inspectedCarId, inspectedUpgrades, selectedCarId, selectedUpgrades) {
  const inspected = getCarStats(inspectedCarId, inspectedUpgrades);
  const selected = getCarStats(selectedCarId, selectedUpgrades);
  return GARAGE_STATS.map(definition => {
    const value = rounded(inspected[definition.id], definition.precision);
    const selectedValue = rounded(selected[definition.id], definition.precision);
    const difference = rounded(value - selectedValue, definition.precision);
    return {
      ...definition,
      value,
      selectedValue,
      difference,
      relation: difference > 0 ? 'better' : difference < 0 ? 'worse' : 'equal',
    };
  });
}
