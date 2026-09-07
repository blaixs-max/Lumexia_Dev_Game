import { useSyncExternalStore } from 'react';

function subscribe(onChange) {
  if (typeof document === 'undefined') return () => {};
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

const getSnapshot = () => typeof document === 'undefined' || !document.hidden;
const getServerSnapshot = () => true;

// Rendering policy only: game input and pause decisions belong to RaceControls.
export function usePageVisible() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export default usePageVisible;
