import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import RaceControls from '../src/components/RaceControls.jsx';
import RaceHUD from '../src/components/RaceHUD.jsx';
import { useGameStore } from '../src/store.js';
import '../src/index.css';
import '../src/App.css';

// Diagnostic entry only: no canvas, physics update, wallet, or remote service.
useGameStore.setState({ gameState: 'playing', gameOver: false, soundEnabled: false, speed: 110, currentX: 0, steeringInput: 0, isNitroActive: false, nitro: 100, maxNitro: 100, rocketActive: false, magnetActive: false });

export function Fixture() {
  return <div className="lx-race">
    <div className="fixture-scene" aria-hidden="true"><div className="fixture-road" /><div className="fixture-vehicle" data-vehicle-reference>VEHICLE<br />REFERENCE</div></div>
    <RaceHUD />
    <RaceControls touchVisible />
  </div>;
}

createRoot(document.querySelector('#root')).render(<Fixture />);

const button = document.querySelector('#run-checks');
const output = document.querySelector('#check-results');
const status = document.querySelector('#check-status');
const details = document.querySelector('#check-details');
const nextPaint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const query = selector => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`Missing fixture element: ${selector}`);
  return element;
};
const snapshot = () => {
  const state = useGameStore.getState();
  return { gameState: state.gameState, steeringInput: state.steeringInput, nitroActive: state.isNitroActive, soundEnabled: state.soundEnabled };
};
const rect = element => {
  const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
  return { x, y, width, height, top, right, bottom, left };
};
const center = element => {
  const bounds = element.getBoundingClientRect();
  return { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
};
const description = element => element ? { tag: element.tagName, label: element.getAttribute('aria-label'), className: typeof element.className === 'string' ? element.className : element.className?.baseVal } : null;
const pointer = (element, type, id, point) => {
  // Untrusted dispatch exercises real React handlers, but does not manufacture
  // a native active pointer or verify browser/OS pointer-capture routing.
  flushSync(() => element.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, clientX: point.x, clientY: point.y })));
};
const click = element => flushSync(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
const key = (type, code, target = window) => flushSync(() => target.dispatchEvent(new KeyboardEvent(type, { code, key: code === 'Space' ? ' ' : code, bubbles: true, cancelable: true })));
const reset = () => {
  flushSync(() => {
    window.dispatchEvent(new Event('resize'));
    useGameStore.setState({ gameState: 'playing', pausedFrom: null, steeringInput: 0, isNitroActive: false, nitro: 100, rocketActive: false, soundEnabled: false });
  });
};

async function runChecks() {
  button.disabled = true;
  details.open = false;
  status.textContent = 'Running synthetic checks…';
  const tests = [];
  const journal = [];
  let phase = 'setup';
  let previousSoundPreference;
  try { previousSoundPreference = localStorage.getItem('lumexia:sound'); } catch { /* Optional storage. */ }
  const unsubscribe = useGameStore.subscribe(() => journal.push({ phase, ...snapshot() }));
  const check = (name, pass, evidence, category = 'handler') => tests.push({ name, status: pass ? 'pass' : 'fail', category, evidence });
  const stateCheck = (name, steeringInput, nitroActive, gameState = 'playing') => {
    const actual = snapshot();
    check(name, actual.steeringInput === steeringInput && actual.nitroActive === nitroActive && actual.gameState === gameState, { expected: { steeringInput, nitroActive, gameState }, actual });
  };
  const report = {
    completed: false,
    methodology: 'Real RaceControls/RaceHUD/store and unchanged production CSS. Native elementFromPoint layout checks plus synthetic, untrusted PointerEvent/KeyboardEvent dispatch through React handlers. No physical device, native capture routing, WebGL, or simulation performance claim.',
    environment: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches, narrow: matchMedia('(max-width: 700px)').matches, smallLandscape: matchMedia('(max-width: 1000px) and (max-height: 550px)').matches, userAgent: navigator.userAgent },
    tests,
    stateJournal: journal,
  };
  try {
    reset();
    await nextPaint();
    phase = 'layout';
    const surface = query('.lx-touch-controls');
    const left = query('.lx-steer-left');
    const right = query('.lx-steer-right');
    const nitro = query('.lx-touch-nitro');
    const expectedTouch = report.environment.coarse || report.environment.narrow || report.environment.smallLandscape;
    const visible = getComputedStyle(surface).display !== 'none';
    report.geometry = Object.fromEntries(['.lx-touch-controls', '.lx-steer-left', '.lx-steer-right', '.lx-touch-nitro', '.lx-speed', '.lx-boost', '.fixture-vehicle'].map(selector => [selector, rect(query(selector))]));
    check('Actual responsive CSS shows/hides touch controls', visible === expectedTouch, { expectedTouch, visible }, 'layout');
    for (const [side, x] of [['left', innerWidth * .25], ['right', innerWidth * .75]]) {
      for (const [height, y] of [['top', 2], ['middle', innerHeight * .5], ['bottom', innerHeight - 2]]) {
        const hit = document.elementFromPoint(x, y);
        check(`${side} ${height}: native hit target`, expectedTouch ? Boolean(hit?.closest(`.lx-steer-${side}`)) : !hit?.closest('.lx-touch-controls'), { point: { x, y }, hit: description(hit), expectedTouch }, 'layout');
      }
    }
    for (const [selector, name] of [['.lx-touch-nitro', 'Nitro'], ['[aria-label="Mute audio"], [aria-label="Enable audio"]', 'Mute'], ['[aria-label="Pause race"]', 'Pause']]) {
      if (selector === '.lx-touch-nitro' && !expectedTouch) {
        tests.push({ name: 'Nitro native hit target', status: 'skip', category: 'layout', evidence: 'Touch control intentionally hidden at this fine-pointer desktop viewport.' });
        continue;
      }
      const element = query(selector);
      const point = center(element);
      const hit = document.elementFromPoint(point.x, point.y);
      check(`${name}: topmost interactive target`, Boolean(hit && (hit === element || element.contains(hit))), { point, hit: description(hit) }, 'layout');
    }
    for (const [selector, side] of [['.lx-speed', 'left'], ['.lx-boost', 'right']]) {
      const element = query(selector);
      const point = center(element);
      const hit = document.elementFromPoint(point.x, point.y);
      check(`${selector}: passive HUD does not intercept input`, expectedTouch ? Boolean(hit?.closest(`.lx-steer-${side}`)) : !element.contains(hit), { point, hit: description(hit) }, 'layout');
      const a = rect(element), b = rect(query('.fixture-vehicle'));
      const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      check(`${selector}: clear of vehicle reference`, overlap === 0, { overlapArea: overlap, gauge: a, reference: b }, 'layout');
    }
    check('No horizontal page overflow', document.documentElement.scrollWidth <= innerWidth, { scrollWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth }, 'layout');

    const l = { x: innerWidth * .25, y: innerHeight * .5 };
    const r = { x: innerWidth * .75, y: innerHeight * .5 };
    const n = visible ? center(nitro) : r;
    report.handlerVisibility = visible ? 'Handlers exercised on visible touch elements.' : 'Pointer handler checks skipped: CSS-hidden controls have no measurable steering surface. Keyboard and HUD checks still run.';
    if (visible) {
    phase = 'independent steering and nitro';
    pointer(left, 'pointerdown', 1, l);
    stateCheck('Left pointer starts held steering', -1, false);
    pointer(nitro, 'pointerdown', 2, n);
    stateCheck('Second nitro pointer preserves left steering', -1, true);
    pointer(left, 'pointerup', 1, l);
    stateCheck('Releasing steering preserves held nitro', 0, true);
    pointer(nitro, 'pointerup', 2, n);
    stateCheck('Releasing nitro clears boost', 0, false);
    await nextPaint();

    phase = 'held pointer crosses midpoint';
    pointer(left, 'pointerdown', 3, l);
    pointer(left, 'pointermove', 3, r);
    stateCheck('Captured-target move across midpoint steers right', 1, false);
    pointer(left, 'pointermove', 3, l);
    stateCheck('Move back across midpoint steers left', -1, false);
    pointer(left, 'pointercancel', 3, l);
    stateCheck('Pointer cancel releases steering', 0, false);
    await nextPaint();

    phase = 'opposite pointers';
    pointer(left, 'pointerdown', 4, l);
    pointer(right, 'pointerdown', 5, r);
    stateCheck('Opposite pointers cancel steering', 0, false);
    pointer(right, 'pointerup', 5, r);
    stateCheck('Releasing right retains the left pointer', -1, false);
    pointer(window, 'pointerup', 4, l);
    stateCheck('Window pointer release clears fallback input', 0, false);
    await nextPaint();

    phase = 'capture loss and cancel';
    pointer(left, 'pointerdown', 6, l);
    pointer(nitro, 'pointerdown', 7, n);
    pointer(left, 'lostpointercapture', 6, l);
    stateCheck('Lost steering capture preserves independent nitro', 0, true);
    pointer(nitro, 'lostpointercapture', 7, n);
    stateCheck('Lost nitro capture clears boost', 0, false);
    pointer(nitro, 'pointerdown', 8, n);
    pointer(window, 'pointercancel', 8, n);
    stateCheck('Window pointer cancellation clears boost', 0, false);
    await nextPaint();

    phase = 'resize reset';
    pointer(left, 'pointerdown', 9, l);
    pointer(nitro, 'pointerdown', 10, n);
    flushSync(() => window.dispatchEvent(new Event('resize')));
    stateCheck('Resize releases all held controls', 0, false);
    pointer(left, 'pointermove', 9, r);
    stateCheck('Stale move after resize cannot restore steering', 0, false);
    await nextPaint();
    } else {
      tests.push({ name: 'Touch pointer integration', status: 'skip', category: 'handler', evidence: 'Touch controls intentionally hidden at this fine-pointer desktop viewport.' });
    }

    phase = 'HUD pause and resume';
    if (visible) {
      pointer(left, 'pointerdown', 11, l);
      pointer(nitro, 'pointerdown', 12, n);
    } else {
      key('keydown', 'KeyA');
      key('keydown', 'Space');
    }
    click(query('[aria-label="Pause race"]'));
    stateCheck('Real pause button clears steering and nitro', 0, false, 'paused');
    check('Paused touch controls unmount', !document.querySelector('.lx-touch-controls'), { controlsMounted: Boolean(document.querySelector('.lx-touch-controls')) });
    await nextPaint();
    click(query('.lx-pause-card > .lx-button-primary'));
    stateCheck('Real resume button does not restore stale inputs', 0, false);
    await nextPaint();

    phase = 'HUD audio toggle';
    click(query('[aria-label="Enable audio"]'));
    check('Real audio button enables audio', useGameStore.getState().soundEnabled, snapshot());
    click(query('[aria-label="Mute audio"]'));
    check('Real audio button mutes audio', !useGameStore.getState().soundEnabled, snapshot());
    await nextPaint();

    phase = 'keyboard integration';
    key('keydown', 'KeyA');
    stateCheck('Keyboard A steers left', -1, false);
    key('keydown', 'Space');
    stateCheck('Keyboard Space preserves steering and boosts', -1, true);
    key('keyup', 'KeyA');
    key('keyup', 'Space');
    stateCheck('Keyboard releases clear both inputs', 0, false);
    key('keydown', 'Space', query('[aria-label="Pause race"]'));
    stateCheck('Space on HUD button does not trigger boost', 0, false);
    key('keyup', 'Space');
    key('keydown', 'KeyP');
    stateCheck('Keyboard P pauses', 0, false, 'paused');
    key('keydown', 'KeyP');
    stateCheck('Keyboard P resumes', 0, false);
    await nextPaint();

    phase = 'blur safety';
    if (visible) {
      pointer(query('.lx-steer-left'), 'pointerdown', 13, l);
      pointer(query('.lx-touch-nitro'), 'pointerdown', 14, n);
    } else {
      key('keydown', 'KeyA');
      key('keydown', 'Space');
    }
    flushSync(() => window.dispatchEvent(new Event('blur')));
    stateCheck('Window blur pauses and releases all inputs', 0, false, 'paused');
    reset();
    report.completed = true;
  } catch (error) {
    tests.push({ name: `Harness exception during ${phase}`, status: 'fail', category: 'harness', evidence: String(error?.stack || error) });
  } finally {
    unsubscribe();
    reset();
    // The real audio button writes a preference. Restore the pre-check value.
    try {
      if (previousSoundPreference === null) localStorage.removeItem('lumexia:sound');
      else if (previousSoundPreference !== undefined) localStorage.setItem('lumexia:sound', previousSoundPreference);
    } catch { /* Optional storage. */ }
    report.summary = { passed: tests.filter(test => test.status === 'pass').length, failed: tests.filter(test => test.status === 'fail').length, skipped: tests.filter(test => test.status === 'skip').length };
    report.finalState = snapshot();
    output.dataset.result = JSON.stringify(report);
    output.textContent = JSON.stringify(report, null, 2);
    status.textContent = `${report.summary.passed} pass / ${report.summary.failed} fail / ${report.summary.skipped} skip · synthetic`;
    button.disabled = false;
  }
}

button.addEventListener('click', runChecks);
