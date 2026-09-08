import { Component, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import RaceScene from '../src/components/RaceScene';
import RaceHUD from '../src/components/RaceHUD';
import { useGameStore } from '../src/store';
import { sampleDayCycle } from '../src/environment/day-cycle';
import { ROAD_ROUTE_LENGTH, sampleRoadFrame, sampleTunnelAmount, tunnelStartZ } from '../src/environment/road-path';
import '../src/App.css';

const parameters = new URLSearchParams(location.search);
const low = parameters.get('quality') === 'performance';
const dpr = Math.min(2, Math.max(0.5, Number(parameters.get('dpr')) || 1));
const settings = { time: 0, station: 0, lane: 0, replay: false, cycle: false, version: 0, ready: false };
const diagnostics = { shaderErrors: [], pageErrors: [], contextLost: 0, contextRestored: 0, renderer: '', programsInitial: null, programsMax: 0, cleanup: null };
const types = ['sport', 'sedan', 'suv', 'truck', 'sport', 'sedan', 'suv', 'sedan'];
const element = id => document.getElementById(id);
const noop = () => {};

function showErrors() {
  element('route-errors').textContent = JSON.stringify({ shaderErrors: diagnostics.shaderErrors, pageErrors: diagnostics.pageErrors }, null, 2);
}

function attachDiagnostics({ gl }) {
  const context = gl.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
  diagnostics.renderer = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
  const priorError = gl.debug.onShaderError, priorCheck = gl.debug.checkShaderErrors;
  gl.debug.checkShaderErrors = true;
  gl.debug.onShaderError = (ctx, program, vertex, fragment) => {
    diagnostics.shaderErrors.push({ program: (ctx.getProgramInfoLog(program) || '').slice(0, 4000),
      vertex: (ctx.getShaderInfoLog(vertex) || '').slice(0, 4000), fragment: (ctx.getShaderInfoLog(fragment) || '').slice(0, 4000) });
    showErrors(); priorError?.(ctx, program, vertex, fragment);
  };
  const lost = () => { diagnostics.contextLost++; };
  const restored = () => { diagnostics.contextRestored++; };
  const pageError = event => { diagnostics.pageErrors.push(String(event.message || event.reason || 'Unknown error').slice(0, 4000)); showErrors(); };
  gl.domElement.addEventListener('webglcontextlost', lost);
  gl.domElement.addEventListener('webglcontextrestored', restored);
  window.addEventListener('error', pageError); window.addEventListener('unhandledrejection', pageError);
  diagnostics.cleanup = () => {
    gl.debug.onShaderError = priorError; gl.debug.checkShaderErrors = priorCheck;
    gl.domElement.removeEventListener('webglcontextlost', lost); gl.domElement.removeEventListener('webglcontextrestored', restored);
    window.removeEventListener('error', pageError); window.removeEventListener('unhandledrejection', pageError);
  };
}

function lightCounts(scene, camera) {
  const mounted = {}, visible = {};
  let shadows = 0;
  scene.traverse(object => {
    if (!object.isLight) return;
    mounted[object.type] = (mounted[object.type] || 0) + 1;
    let parent = object;
    while (parent && parent.visible) parent = parent.parent;
    if (parent || !object.layers.test(camera.layers)) return;
    visible[object.type] = (visible[object.type] || 0) + 1;
    if (object.castShadow) shadows++;
  });
  return { mounted, visible, shadowCasting: shadows };
}

function bindControls() {
  const listeners = [];
  const listen = (id, event, handler) => { const node = element(id); node.addEventListener(event, handler); listeners.push(() => node.removeEventListener(event, handler)); };
  const setNumber = (key, value) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && (key === 'lane' || parsed >= 0)) { settings[key] = parsed; settings.version++; }
  };
  listen('route-phase', 'change', event => { setNumber('time', event.target.value); element('route-time-input').value = settings.time; });
  listen('route-station', 'change', event => { setNumber('station', event.target.value); element('route-distance-input').value = settings.station; });
  listen('route-time-input', 'change', event => setNumber('time', event.target.value));
  listen('route-distance-input', 'change', event => setNumber('station', event.target.value));
  listen('route-lane', 'change', event => setNumber('lane', event.target.value));
  for (const [id, key] of [['route-replay', 'replay'], ['route-cycle', 'cycle']]) {
    listen(id, 'click', event => { settings[key] = !settings[key]; event.currentTarget.setAttribute('aria-pressed', String(settings[key])); settings.version++; });
  }
  listen('route-reset', 'click', () => {
    Object.assign(settings, { time: 0, station: 0, lane: 0, replay: false, cycle: false, version: settings.version + 1 });
    for (const id of ['route-phase', 'route-station', 'route-time-input', 'route-distance-input', 'route-lane']) element(id).value = '0';
    for (const id of ['route-replay', 'route-cycle']) element(id).setAttribute('aria-pressed', 'false');
  });
  listen('route-reload', 'click', () => location.reload());
  return () => listeners.forEach(cleanup => cleanup());
}

function Drive() {
  const last = useRef({ version: -1, reportAt: 0, previous: 0, frameMs: 0 });
  useFrame(({ gl, scene, camera, size }, delta) => {
    const current = last.current;
    const now = performance.now();
    current.frameMs = current.previous ? now - current.previous : 0; current.previous = now;
    const dt = document.visibilityState === 'visible' ? Math.min(delta, 0.1) : 0;
    if (settings.ready && settings.replay) { settings.station += dt * 70; settings.version++; }
    if (settings.ready && settings.cycle) { settings.time += dt * 20; settings.version++; }
    if (current.version !== settings.version) {
      useGameStore.setState({ gameState: 'playing', gameOver: false, sessionType: 'practice', soundEnabled: false, updateGame: noop,
        elapsedTime: settings.time, totalDistance: settings.station / 5, currentX: settings.lane, steeringVelocity: 0,
        speed: 220, score: 0, isNitroActive: false, rocketActive: false, magnetActive: false, message: '', particles: [],
        enemies: types.map((type, i) => ({ id: `route-${i}`, type, x: [-4.5, 0, 4.5][i % 3],
          z: 24 - ((i * 51 + 360 - settings.station / 70 * 12 % 360) % 360), isChanging: false, indicator: 0 })),
        coins: Array.from({ length: 8 }, (_, i) => ({ id: `route-coin-${i}`, kind: 'coin', x: [-4.5, 0, 4.5][i % 3], z: -28 - i * 38 })),
      });
      current.version = settings.version;
    }
    if (now >= current.reportAt) {
      const programs = gl.info.programs?.length || 0;
      if (settings.ready) diagnostics.programsInitial ??= programs;
      diagnostics.programsMax = Math.max(diagnostics.programsMax, programs);
      const frame = sampleRoadFrame(settings.station, -2);
      const report = {
        ready: settings.ready, phase: sampleDayCycle(settings.time), elapsedTime: Number(settings.time.toFixed(2)),
        station: Number(settings.station.toFixed(2)), routeStation: Number((settings.station % ROAD_ROUTE_LENGTH).toFixed(2)),
        tunnelFrontZ: Number(tunnelStartZ(settings.station).toFixed(2)), tunnelAmount: sampleTunnelAmount(settings.station, -2),
        playerRoadFrame: frame, replay: settings.replay, cycle: settings.cycle,
        viewport: [size.width, size.height], dpr: gl.getPixelRatio(), quality: low ? 'performance' : 'high',
        programs, programsInitial: diagnostics.programsInitial, programsMax: diagnostics.programsMax,
        lights: lightCounts(scene, camera), mainPassDrawCalls: gl.info.render.calls, mainPassTriangles: gl.info.render.triangles,
        geometryCount: gl.info.memory.geometries, textureCount: gl.info.memory.textures,
        lastFrameMs: Number(current.frameMs.toFixed(2)), shaderErrorCount: diagnostics.shaderErrors.length,
        pageErrorCount: diagnostics.pageErrors.length, contextLost: diagnostics.contextLost, contextRestored: diagnostics.contextRestored,
        visibility: document.visibilityState, focused: document.hasFocus(), renderer: diagnostics.renderer,
      };
      element('route-metrics').dataset.result = JSON.stringify(report);
      element('route-metrics').textContent = JSON.stringify(report, null, 2);
      element('route-status').textContent = settings.ready ? `${report.phase.phase.toUpperCase()} · ${report.station} m · ${report.programs} programs · ${report.shaderErrorCount} shader errors` : 'Preparing models, textures and shaders…';
      current.reportAt = now + 500;
    }
  }, -2);
  return null;
}

class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error: String(error) }; }
  componentDidCatch(error) { diagnostics.pageErrors.push(String(error)); showErrors(); }
  render() { return this.state.error ? <pre role="alert">{this.state.error}</pre> : this.props.children; }
}

export default function RouteCheck() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const unbind = bindControls();
    useGameStore.setState({ gameState: 'playing', updateGame: noop, soundEnabled: false });
    return () => { unbind(); diagnostics.cleanup?.(); };
  }, []);
  return <Boundary><div className="lx-race" style={{ width: '100%', height: '100%' }}>
    <Canvas onCreated={attachDiagnostics} dpr={dpr} shadows={!low} camera={{ position: [0, 5.2, 11.5], fov: 54, near: 0.5, far: 750 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}>
      <Suspense fallback={null}><RaceScene low={low} adaptive={false} onReady={() => { settings.ready = true; setReady(true); }} onReduceQuality={noop} /><Drive /></Suspense>
    </Canvas>
    {ready ? <RaceHUD onMainMenu={() => location.reload()} onRestart={() => location.reload()} /> : null}
  </div></Boundary>;
}

createRoot(element('root')).render(<RouteCheck />);
