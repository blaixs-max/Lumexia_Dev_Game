import { Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import RaceScene from '@benchmark/scene';
import RaceHUD from '@benchmark/hud';
import { useGameStore } from '@benchmark/store';

const parameters = new URLSearchParams(location.search);
const low = parameters.get('quality') === 'performance';
const dpr = Number(parameters.get('dpr') || 1);
const output = document.querySelector('#metrics');
const types = ['sport', 'sedan', 'suv', 'truck', 'sport', 'sedan', 'suv', 'sedan'];
const samples = [];
const submissions = [];
const tasks = [];
let phase = 'ready';
let observer;
try { observer = new PerformanceObserver(list => { if (phase === 'sample') for (const item of list.getEntries()) tasks.push(item.duration); }); observer.observe({ entryTypes: ['longtask'] }); } catch { /* Optional browser support. */ }

function Drive({ finished }) {
  const clock = useRef({ time: 0, previous: 0, nextReport: 0 });
  const { gl, size } = useThree();
  useEffect(() => {
    useGameStore.setState({ gameState: 'playing', gameOver: false, updateGame: () => {}, speed: 220, soundEnabled: false, currentX: 0, isNitroActive: false, rocketActive: false });
    return () => observer?.disconnect();
  }, []);
  useFrame((_, delta) => {
    const now = performance.now();
    const current = clock.current;
    if (current.previous) {
      const dt = now - current.previous;
      if (current.time >= 8 && current.time < 32) {
        phase = 'sample'; samples.push(dt);
        submissions.push({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures });
      }
    }
    current.previous = now; current.time += delta;
    const t = current.time;
    useGameStore.setState({
      totalDistance: t * 22, elapsedTime: t, speed: 220, score: t * 100, currentX: Math.sin(t * 0.2) * 1.3,
      enemies: types.map((type, i) => ({ id: `bench-${i}`, type, x: [-4.5, 0, 4.5][i % 3], z: 24 - ((i * 51 + 360 - t * 12 % 360) % 360), isChanging: false, indicator: 0 })),
      coins: Array.from({ length: 8 }, (_, i) => ({ id: `coin-${i}`, kind: 'coin', x: [-4.5, 0, 4.5][i % 3], z: 20 - ((i * 45 + 360 - t * 110 % 360) % 360) })),
    });
    if (t >= current.nextReport) { output.textContent = `${t < 8 ? 'Warming shaders' : 'Measuring'}: ${t.toFixed(1)}s\n${gl.info.render.triangles.toLocaleString()} triangles\n${gl.info.render.calls} draw calls`; current.nextReport = t + 1; }
    if (t >= 32) {
      phase = 'complete';
      const sorted = [...samples].sort((a, b) => a - b);
      const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
      const mean = values => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
      const summary = { completed: true, viewport: [size.width, size.height], dpr: gl.getPixelRatio(), quality: low ? 'performance' : 'high', frames: samples.length, meanMs: mean(samples), medianMs: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), over25ms: samples.filter(v => v > 25).length, over50ms: samples.filter(v => v > 50).length, longTasks: tasks.length, maxLongTaskMs: Math.max(0, ...tasks), averageTriangles: Math.round(mean(submissions.map(v => v.triangles))), averageDrawCalls: Math.round(mean(submissions.map(v => v.calls))), geometryCount: gl.info.memory.geometries, textureCount: gl.info.memory.textures };
      const context = gl.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
      summary.renderer = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
      output.dataset.result = JSON.stringify(summary); output.textContent = JSON.stringify(summary, null, 2);
      finished();
    }
  }, -2);
  return null;
}

export default function Benchmark() {
  const [started, setStarted] = useState(false), [complete, setComplete] = useState(false);
  useEffect(() => { const start = document.querySelector('#start'); start.onclick = () => { start.disabled = true; setStarted(true); }; document.querySelector('#repeat').onclick = () => location.reload(); }, []);
  return started ? <>
    <Canvas dpr={dpr} shadows={!low} frameloop={complete ? 'demand' : 'always'} camera={{ position: [0, 5.2, 11.5], fov: 54, near: 0.5, far: 750 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}>
      <Suspense fallback={null}><RaceScene low={low} adaptive={false} onReady={() => {}} onReduceQuality={() => {}} /><Drive finished={() => setComplete(true)} /></Suspense>
    </Canvas><RaceHUD />
  </> : null;
}
createRoot(document.querySelector('#root')).render(<Benchmark />);
