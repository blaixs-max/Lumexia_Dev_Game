export const DAY_CYCLE = Object.freeze({ day: 300, sunset: 45, night: 180, sunrise: 45 });
export const DAY_CYCLE_SECONDS = DAY_CYCLE.day + DAY_CYCLE.sunset + DAY_CYCLE.night + DAY_CYCLE.sunrise;

const smooth = value => value * value * (3 - 2 * value);

// Shared horizon colors keep the sky and distance fog continuous.
export const DAY_SKY_COLORS = Object.freeze({
  day: Object.freeze({ horizon: '#a6b8bb', zenith: '#347cb2', lower: '#829a9b' }),
  twilight: Object.freeze({ horizon: '#ad796b', zenith: '#344865', lower: '#756773' }),
  night: Object.freeze({ horizon: '#101b32', zenith: '#030711', lower: '#0a1427' }),
});
export const DAY_LIGHT_POSITIONS = Object.freeze({
  day: Object.freeze([-82, 145, -460]),
  twilight: Object.freeze([-82, 34, -460]),
  night: Object.freeze([82, 85, -460]),
});

/** Elapsed simulation seconds; pass a reusable target for allocation-free sampling. */
export function sampleDayCycle(elapsedTime, target = {}) {
  const time = (Number.isFinite(elapsedTime) ? Math.max(0, elapsedTime) : 0) % DAY_CYCLE_SECONDS;
  let progress, phase, night, twilight = 0;
  if (time < DAY_CYCLE.day) {
    phase = 'day'; progress = time / DAY_CYCLE.day; night = 0;
  } else if (time < DAY_CYCLE.day + DAY_CYCLE.sunset) {
    phase = 'sunset'; progress = (time - DAY_CYCLE.day) / DAY_CYCLE.sunset;
    night = smooth(progress);
    twilight = 16 * progress * progress * (1 - progress) * (1 - progress);
  } else if (time < DAY_CYCLE_SECONDS - DAY_CYCLE.sunrise) {
    phase = 'night'; progress = (time - DAY_CYCLE.day - DAY_CYCLE.sunset) / DAY_CYCLE.night; night = 1;
  } else {
    phase = 'sunrise'; progress = (time - DAY_CYCLE_SECONDS + DAY_CYCLE.sunrise) / DAY_CYCLE.sunrise;
    night = 1 - smooth(progress);
    twilight = 16 * progress * progress * (1 - progress) * (1 - progress);
  }
  target.night = night;
  target.day = 1 - night;
  target.twilight = twilight;
  target.phase = phase;
  target.progress = progress;
  target.timeInCycle = time;
  return target;
}
