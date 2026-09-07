import { useEffect, useRef } from 'react';
import { useGameStore } from '../store';
import { getSteeringSide } from '../utils/touchSteering';

const DRIVING_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space']);
const isEditing = target => target?.isContentEditable
  || Boolean(target?.closest?.('input, textarea, select, [role="textbox"]'));

function syncInput(input) {
  const state = useGameStore.getState();
  const actions = [...input.pointers.values(), ...input.buttonKeys.values()];
  const left = input.keys.has('ArrowLeft') || input.keys.has('KeyA') || actions.includes('left');
  const right = input.keys.has('ArrowRight') || input.keys.has('KeyD') || actions.includes('right');
  state.setSteeringInput(Number(right) - Number(left));
  if (input.keys.has('Space') || actions.includes('nitro')) state.activateNitro();
  else state.deactivateNitro();
}

function releaseInput(input) {
  input.keys.clear();
  input.pointers.clear();
  input.buttonKeys.clear();
  syncInput(input);
}

export default function RaceControls({ touchVisible = false }) {
  const gameState = useGameStore(state => state.gameState);
  const steeringInput = useGameStore(state => state.steeringInput);
  const boosting = useGameStore(state => state.isNitroActive);
  const inputRef = useRef({ keys: new Set(), pointers: new Map(), buttonKeys: new Map() });
  const surfaceRef = useRef();

  useEffect(() => {
    const input = inputRef.current;
    const onKeyDown = event => {
      if (event.defaultPrevented || isEditing(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const state = useGameStore.getState();
      if (event.code === 'Escape' || event.code === 'KeyP') {
        event.preventDefault();
        if (!event.repeat) state.togglePause();
        return;
      }
      if (event.code === 'KeyM') {
        if (!event.repeat) state.toggleSound();
        return;
      }
      if (!DRIVING_KEYS.has(event.code) || state.gameState !== 'playing') return;
      // Space must still activate the focused pause, sound, and dialog buttons.
      if (event.code === 'Space' && event.target?.closest?.('button, a, [role="button"]')) return;
      event.preventDefault();
      if (event.repeat) return;
      input.keys.add(event.code);
      syncInput(input);
    };
    const onKeyUp = event => {
      const hadInput = input.keys.delete(event.code);
      const hadButtonInput = input.buttonKeys.delete(event.code);
      if (hadInput || hadButtonInput) syncInput(input);
    };
    const onPointerRelease = event => {
      if (input.pointers.delete(event.pointerId)) syncInput(input);
    };
    const onBlur = () => {
      releaseInput(input);
      useGameStore.getState().pauseGame();
    };
    const onVisibilityChange = () => { if (document.hidden) onBlur(); };
    const onResize = () => releaseInput(input);
    const unsubscribe = useGameStore.subscribe((state, previous) => {
      if (state.gameState !== previous.gameState) releaseInput(input);
    });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerup', onPointerRelease);
    window.addEventListener('pointercancel', onPointerRelease);
    window.addEventListener('blur', onBlur);
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      unsubscribe();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerup', onPointerRelease);
      window.removeEventListener('pointercancel', onPointerRelease);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseInput(input);
    };
  }, []);

  const releasePointer = event => {
    if (inputRef.current.pointers.delete(event.pointerId)) syncInput(inputRef.current);
  };

  const handlers = action => ({
    onPointerDown: event => {
      if (event.button !== 0 || useGameStore.getState().gameState !== 'playing') return;
      event.preventDefault();
      const pointerAction = action === 'nitro' ? action : getSteeringSide(event.clientX, surfaceRef.current?.getBoundingClientRect());
      if (!pointerAction) return;
      inputRef.current.pointers.set(event.pointerId, pointerAction);
      try { event.currentTarget.setPointerCapture(event.pointerId); }
      catch { /* Window release listeners also cover interrupted capture. */ }
      syncInput(inputRef.current);
    },
    onPointerMove: event => {
      const previous = inputRef.current.pointers.get(event.pointerId);
      if (!previous || previous === 'nitro') return;
      // Capture keeps a held finger active as it crosses the midpoint. A second
      // finger can operate nitro independently without changing this pointer.
      const side = getSteeringSide(event.clientX, surfaceRef.current?.getBoundingClientRect());
      if (side && side !== previous) {
        inputRef.current.pointers.set(event.pointerId, side);
        syncInput(inputRef.current);
      }
    },
    onPointerUp: releasePointer,
    onPointerCancel: releasePointer,
    onLostPointerCapture: releasePointer,
    onContextMenu: event => event.preventDefault(),
    onKeyDown: event => {
      if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
        inputRef.current.buttonKeys.set(event.code, action);
        syncInput(inputRef.current);
      }
    },
    onBlur: () => {
      inputRef.current.buttonKeys.clear();
      syncInput(inputRef.current);
    },
  });

  if (!touchVisible || gameState !== 'playing') return null;
  return (
    <div ref={surfaceRef} className="lx-touch-controls lx-ui" role="group" aria-label="Driving controls">
      <button type="button" className="lx-steer-zone lx-steer-left" aria-label="Steer left" aria-pressed={steeringInput < 0} {...handlers('left')} />
      <button type="button" className="lx-steer-zone lx-steer-right" aria-label="Steer right" aria-pressed={steeringInput > 0} {...handlers('right')} />
      <button type="button" className="lx-touch-nitro" aria-label="Hold for nitro boost" aria-pressed={boosting} {...handlers('nitro')}><span aria-hidden="true">↯</span>NITRO</button>
    </div>
  );
}
