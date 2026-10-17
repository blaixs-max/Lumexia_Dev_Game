import './UIIcon.css';

const SYMBOLS = {
  play: <path d="m8 4 12 8-12 8z" />,
  flag: <><path d="M5 21V3m0 1h14l-3 4 3 4H5" /><path d="M9 4v4h4v4m0-8v4h5M5 8h4v4" /></>,
  garage: <><path d="M3 21V8l9-5 9 5v13M6 21V11h12v10M6 15h12M6 18h12" /><path d="M9 7h6" /></>,
  car: <><path d="m5 8 2-4h10l2 4 2 3v7H3v-7zM3 11h18M6 18v3m12-3v3" /><path d="M6 14h2m8 0h2" /></>,
  coin: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="6" /><path d="m12 8-3 4 3 4 3-4z" /></>,
  speed: <><path d="M4 18a9 9 0 1 1 16 0M5 14h2m10 0h2M8 7l1 2m7-2-1 2M12 5v2m0 7 5-4" /><circle cx="12" cy="15" r="2" /></>,
  nitro: <><rect x="7" y="6" width="10" height="15" rx="3" /><path d="M10 6V3h4v3m-1 6-3 4h4l-3 4M9 3h6" /></>,
  engine: <><path d="M3 9h3l3-4h8v4h4v10H8l-3-4H3zM10 2h6m-3 0v3M1 9v7" /><path d="m13 9-2 4h4l-2 4" /></>,
  handling: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M3 10h6m6 0h6m-9 5v6M5 6l5 4m9-4-5 4" /></>,
  arrowLeft: <path d="m11 5-7 7 7 7M4 12h17" />,
  arrowRight: <path d="m13 5 7 7-7 7M3 12h17" />,
  check: <path d="m5 12 4 4L19 6" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
  volume: <><path d="m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
  muted: <path d="m11 5-5 4H3v6h3l5 4zm5 4 5 6m0-6-5 6" />,
  pause: <><rect x="5" y="4" width="4" height="16" rx="1" /><rect x="15" y="4" width="4" height="16" rx="1" /></>,
  restart: <><path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" /></>,
  trophy: <><path d="M7 3h10v5a5 5 0 0 1-10 0zm0 2H3v3a4 4 0 0 0 5 4m9-7h4v3a4 4 0 0 1-5 4M12 13v5m-4 3v-3h8v3M6 21h12" /></>,
  distance: <><path d="M7 21 9 3m6 0 2 18M12 3v3m0 4v4m0 4v3M3 21h18" /></>,
  nearMiss: <><path d="M5 4h5v16H5zm9 0h5v16h-5M10 12h4m-4 0 2-2m0 4 2-2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.2" /></>,
  rocket: <><path d="M9 15c-2-5 3-11 12-12 0 9-6 14-11 12zM9 8H5l-3 5 7-1m7 3v4l-5 3 1-7M6 17l-3 4m4-2-1 2" /><circle cx="16" cy="8" r="2" /></>,
  magnet: <><path d="M5 4h5v9a2 2 0 0 0 4 0V4h5v9a7 7 0 0 1-14 0zM5 8h5m4 0h5" /></>,
  settings: <><path d="M4 7h16M4 17h16" /><circle cx="8" cy="7" r="2" /><circle cx="16" cy="17" r="2" /></>,
  save: <><path d="M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-7h8v7" /></>,
  upgrade: <><path d="m5 11 7-7 7 7M12 4v16M5 20h14" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  road: <><path d="M6 21 8 3m8 0 2 18M12 3v3m0 4v4m0 4v3" /></>,
};

export default function UIIcon({ name, size = 20, className = '' }) {
  return <svg className={`lx-ui-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{SYMBOLS[name] || SYMBOLS.info}</svg>;
}
