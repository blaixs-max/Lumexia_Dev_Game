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

const diagnostics = {
  timeline: [], contextLost: 0, contextRestored: 0, shaderErrors: [],
  sampleStart: null, sampleEnd: null,
  frames: { visibleFocused: 0, visibleUnfocused: 0, hidden: 0 },
  gpu: null, cleanup: null,
};
const observeBrowser = source => {
  const state = { atMs: performance.now(), visibility: document.visibilityState, focused: document.hasFocus(), source };
  const previous = diagnostics.timeline.at(-1);
  if (!previous || previous.visibility !== state.visibility || previous.focused !== state.focused) diagnostics.timeline.push(state);
};

function attachDiagnostics({ gl }) {
  const context = gl.getContext();
  const extension = context.getExtension('EXT_disjoint_timer_query_webgl2');
  diagnostics.gpu = { context, extension, pending: [], samples: [], issued: 0, skipped: 0, disjointFrames: 0, discarded: 0 };
  observeBrowser('renderer-created');
  const visibility = () => observeBrowser('visibilitychange');
  const focus = () => observeBrowser('focus');
  const blur = () => observeBrowser('blur');
  const lost = () => { diagnostics.contextLost++; };
  const restored = () => { diagnostics.contextRestored++; };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('focus', focus);
  window.addEventListener('blur', blur);
  gl.domElement.addEventListener('webglcontextlost', lost);
  gl.domElement.addEventListener('webglcontextrestored', restored);
  const previousShaderError = gl.debug.onShaderError;
  const previousShaderCheck = gl.debug.checkShaderErrors;
  gl.debug.checkShaderErrors = true;
  gl.debug.onShaderError = (ctx, program, vertex, fragment) => {
    const entry = {
      phase, atMs: performance.now(),
      program: (ctx.getProgramInfoLog(program) || '').slice(0, 8192),
      vertex: (ctx.getShaderInfoLog(vertex) || '').slice(0, 8192),
      fragment: (ctx.getShaderInfoLog(fragment) || '').slice(0, 8192),
    };
    diagnostics.shaderErrors.push(entry);
    console.error('Benchmark WebGL shader error:', entry);
    previousShaderError?.(ctx, program, vertex, fragment);
  };
  diagnostics.cleanup = () => {
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('focus', focus);
    window.removeEventListener('blur', blur);
    gl.domElement.removeEventListener('webglcontextlost', lost);
    gl.domElement.removeEventListener('webglcontextrestored', restored);
    gl.debug.onShaderError = previousShaderError;
    gl.debug.checkShaderErrors = previousShaderCheck;
    diagnostics.gpu.pending.forEach(({ query }) => context.deleteQuery(query));
    diagnostics.gpu.pending.length = 0;
  };
}

function pollGpuQueries() {
  const gpu = diagnostics.gpu;
  if (!gpu?.extension || gpu.context.isContextLost()) return;
  const { context, extension } = gpu;
  if (context.getParameter(extension.GPU_DISJOINT_EXT)) {
    gpu.disjointFrames++;
    gpu.discarded += gpu.pending.length;
    gpu.pending.forEach(({ query }) => context.deleteQuery(query));
    gpu.pending.length = 0;
    return;
  }
  while (gpu.pending.length && context.getQueryParameter(gpu.pending[0].query, context.QUERY_RESULT_AVAILABLE)) {
    const { query } = gpu.pending.shift();
    // QUERY_RESULT is read only after availability; never wait on a GPU fence.
    const milliseconds = context.getQueryParameter(query, context.QUERY_RESULT) / 1e6;
    if (Number.isFinite(milliseconds)) gpu.samples.push(milliseconds);
    context.deleteQuery(query);
  }
}

function diagnosticSummary(gl) {
  observeBrowser('sample-end');
  pollGpuQueries();
  const start = diagnostics.sampleStart, end = diagnostics.sampleEnd;
  const exposure = { observedMs: Math.max(0, end - start), hiddenMs: 0, unfocusedMs: 0, visibleFocusedMs: 0 };
  diagnostics.timeline.forEach((state, index) => {
    const duration = Math.max(0, Math.min(end, diagnostics.timeline[index + 1]?.atMs ?? end) - Math.max(start, state.atMs));
    if (state.visibility !== 'visible') exposure.hiddenMs += duration;
    if (!state.focused) exposure.unfocusedMs += duration;
    if (state.visibility === 'visible' && state.focused) exposure.visibleFocusedMs += duration;
  });
  const gpu = diagnostics.gpu;
  const sorted = [...(gpu?.samples || [])].sort((a, b) => a - b);
  const gpuTiming = {
    supported: Boolean(gpu?.extension),
    status: !gpu?.extension ? 'unavailable: EXT_disjoint_timer_query_webgl2 not supported'
      : sorted.length ? 'asynchronous elapsed GPU queries' : 'no completed valid GPU queries',
    samples: sorted.length, issued: gpu?.issued ?? 0, pending: gpu?.pending.length ?? 0,
    skippedWhenPoolFull: gpu?.skipped ?? 0, disjointFrames: gpu?.disjointFrames ?? 0, discarded: gpu?.discarded ?? 0,
    meanMs: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null,
    medianMs: sorted.length ? sorted[Math.floor(sorted.length * .5)] : null,
    p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : null,
  };
  const shaderPrograms = (gl.info.programs || []).filter(program => program.diagnostics).map(program => ({
    id: program.id, runnable: program.diagnostics.runnable,
    programLog: program.diagnostics.programLog?.slice(0, 8192),
    vertexLog: program.diagnostics.vertexShader?.log?.slice(0, 8192),
    fragmentLog: program.diagnostics.fragmentShader?.log?.slice(0, 8192),
  }));
  const warnings = [];
  if (exposure.hiddenMs > 0) warnings.push('Document was hidden during sampling; foreground FPS cannot be inferred from this run.');
  if (exposure.unfocusedMs > 0) warnings.push('Document lacked focus during sampling. This alone does not prove throttling; browser/window occlusion is not fully exposed by these APIs.');
  if (diagnostics.contextLost) warnings.push('WebGL context was lost during this run; timing is not a stable rendering measurement.');
  if (diagnostics.shaderErrors.length || shaderPrograms.some(program => !program.runnable)) warnings.push('WebGL shader errors were observed; rendering completeness must be checked.');
  if (!gpuTiming.samples) warnings.push('No valid GPU timing samples; rAF intervals cannot distinguish GPU cost from compositor or browser scheduling.');
  if (samples.length && samples.filter(value => value >= 250).length > samples.length / 2) warnings.push('Most rAF intervals exceeded 250ms. This cadence is consistent with either heavy rendering or scheduling limits; it is not proof of either cause.');
  return {
    browserObservation: { ...exposure, frames: diagnostics.frames, finalVisibility: document.visibilityState, finalFocus: document.hasFocus(), transitions: diagnostics.timeline, userAgent: navigator.userAgent },
    gpuTiming,
    webglDiagnostics: { contextLostEvents: diagnostics.contextLost, contextRestoredEvents: diagnostics.contextRestored, contextCurrentlyLost: gl.getContext().isContextLost(), drawingBuffer: [gl.getContext().drawingBufferWidth, gl.getContext().drawingBufferHeight], shaderErrors: diagnostics.shaderErrors, programLogs: shaderPrograms },
    measurementValidity: { warnings, limitation: 'rAF measures delivered callbacks, not isolated GPU time. Visible/focused does not certify lack of OS occlusion, throttling, thermal limits, or competing GPU work. GPU queries time this fixture render and may still include driver scheduling effects.' },
  };
}

function lightCensus(scene, camera) {
  const mounted = {}, visible = {};
  let shadowCasting = 0;
  scene.traverse(object => {
    if (!object.isLight) return;
    mounted[object.type] = (mounted[object.type] || 0) + 1;
    let parent = object;
    while (parent && parent.visible) parent = parent.parent;
    if (parent || !object.layers.test(camera.layers)) return;
    // Zero intensity still occupies a light slot in Three's shader program.
    visible[object.type] = (visible[object.type] || 0) + 1;
    if (object.castShadow) shadowCasting++;
  });
  return { mounted, visible, shadowCasting };
}

function Drive({ ready, finished }) {
  const clock = useRef({ time: 0, previous: 0, nextReport: 0 });
  const lighting = useRef({ first: null, last: null, variants: new Set(), programsStart: null, programsEnd: null, programsMax: 0 });
  const { gl, size, scene, camera } = useThree();
  useEffect(() => {
    useGameStore.setState({ gameState: 'playing', gameOver: false, updateGame: () => {}, speed: 220, soundEnabled: false, currentX: 0, isNitroActive: false, rocketActive: false });
    return () => { observer?.disconnect(); diagnostics.cleanup?.(); };
  }, []);
  useFrame((_, delta) => {
    const current = clock.current;
    if (!ready) {
      // Observe the same preparation barrier as the game. The eight-second
      // replay warmup starts only after traffic textures and shaders are ready.
      current.previous = 0;
      output.textContent = 'Preparing race textures and shaders…';
      return;
    }
    const now = performance.now();
    if (current.previous) {
      const dt = now - current.previous;
      if (current.time >= 8 && current.time < 32) {
        observeBrowser('sample-frame');
        diagnostics.sampleStart ??= current.previous;
        diagnostics.sampleEnd = now;
        diagnostics.frames[document.visibilityState !== 'visible' ? 'hidden' : document.hasFocus() ? 'visibleFocused' : 'visibleUnfocused']++;
        phase = 'sample'; samples.push(dt);
        submissions.push({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures });
        const census = lightCensus(scene, camera);
        const programs = gl.info.programs?.length ?? null;
        const currentLighting = lighting.current;
        currentLighting.first ??= census;
        currentLighting.last = census;
        currentLighting.variants.add(JSON.stringify(census));
        currentLighting.programsStart ??= programs;
        currentLighting.programsEnd = programs;
        currentLighting.programsMax = Math.max(currentLighting.programsMax, programs ?? 0);
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
      const currentLighting = lighting.current;
      Object.assign(summary, {
        readinessGated: true,
        lightCountsAtSampleStart: currentLighting.first,
        lightCountsAtSampleEnd: currentLighting.last,
        lightCountsStable: currentLighting.variants.size === 1,
        lightCountVariants: [...currentLighting.variants].map(value => JSON.parse(value)),
        programsAtSampleStart: currentLighting.programsStart,
        programsAtSampleEnd: currentLighting.programsEnd,
        maxProgramsDuringSample: currentLighting.programsMax,
        programCountGrowth: currentLighting.programsStart === null ? null : currentLighting.programsMax - currentLighting.programsStart,
      });
      const context = gl.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
      summary.renderer = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
      Object.assign(summary, diagnosticSummary(gl));
      output.dataset.result = JSON.stringify(summary); output.textContent = JSON.stringify(summary, null, 2);
      finished();
    }
  }, -2);
  // A positive priority replaces R3F's automatic render, allowing one timer
  // around the actual scene submission. The query pool is bounded and polled
  // asynchronously; unsupported contexts render normally without GPU queries.
  useFrame(({ gl: renderer, scene: renderScene, camera: renderCamera }) => {
    pollGpuQueries();
    const gpu = diagnostics.gpu;
    let query = null;
    if (phase === 'sample' && gpu?.extension && !gpu.context.isContextLost()) {
      if (gpu.pending.length < 6 && !gpu.context.getParameter(gpu.extension.GPU_DISJOINT_EXT)) {
        query = gpu.context.createQuery();
        if (query) gpu.context.beginQuery(gpu.extension.TIME_ELAPSED_EXT, query);
      } else gpu.skipped++;
    }
    renderer.render(renderScene, renderCamera);
    if (query) {
      gpu.context.endQuery(gpu.extension.TIME_ELAPSED_EXT);
      gpu.pending.push({ query });
      gpu.issued++;
    }
  }, 1);
  return null;
}

export default function Benchmark() {
  const [started, setStarted] = useState(false), [complete, setComplete] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { const start = document.querySelector('#start'); start.onclick = () => { start.disabled = true; setStarted(true); }; document.querySelector('#repeat').onclick = () => location.reload(); }, []);
  return started ? <>
    <Canvas onCreated={attachDiagnostics} dpr={dpr} shadows={!low} frameloop={complete ? 'demand' : 'always'} camera={{ position: [0, 5.2, 11.5], fov: 54, near: 0.5, far: 750 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}>
      <Suspense fallback={null}><RaceScene low={low} adaptive={false} onReady={() => setReady(true)} onReduceQuality={() => {}} /><Drive ready={ready} finished={() => setComplete(true)} /></Suspense>
    </Canvas><RaceHUD />
  </> : null;
}
createRoot(document.querySelector('#root')).render(<Benchmark />);
