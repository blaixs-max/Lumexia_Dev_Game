import { Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, Vector2, Vector3 } from 'three';
import RaceScene from '@benchmark/scene';
import RaceHUD from '@benchmark/hud';
import { useGameStore } from '@benchmark/store';
import { getCar, getCarStats } from '@benchmark/garage';
import { sampleRoadFrame } from '@benchmark/road';

const parameters = new URLSearchParams(location.search);
const profilePasses = parameters.get('profile') === 'passes';
const low = parameters.get('quality') === 'performance';
const bounded = (key, fallback, min, max) => parameters.has(key) && Number.isFinite(Number(parameters.get(key))) ? Math.min(max, Math.max(min, Number(parameters.get(key)))) : fallback;
const dpr = bounded('dpr', 1, 0.5, 2);
const cases = { 'dense-day': { time: 0, station: 0 }, 'dense-night': { time: 400, station: 0 }, 'curve-day': { time: 0, station: 350 }, 'curve-night': { time: 400, station: 350 } };
const caseName = Object.hasOwn(cases, parameters.get('case')) ? parameters.get('case') : 'dense-day';
const preset = cases[caseName];
const scenario = {
  name: caseName, car: getCar(parameters.get('car')).id, traffic: Math.floor(bounded('traffic', 12, 0, 12)),
  time: bounded('time', preset.time, 0, 570), station: bounded('station', preset.station, 0, 5000),
  width: Math.floor(bounded('width', 1280, 320, 3840)), height: Math.floor(bounded('height', 720, 320, 2160)),
  dpr, quality: low ? 'performance' : 'high', warmupSeconds: bounded('warmup', 8, 2, 30), sampleSeconds: bounded('sample', 24, 3, 120),
};
const runStats = getCarStats(scenario.car);
const fixedEnemies = Array.from({ length: scenario.traffic }, (_, i) => ({ id: `bench-${i}`, type: ['sport', 'sedan', 'suv', 'truck'][i % 4],
  x: [-4.5, 0, 4.5][i % 3], z: [-27, -82, -155, -245][Math.floor(i / 3)], lane: i % 3 - 1, targetLane: i % 3 - 1,
  ownSpeed: 55, actualSpeed: 55, isChanging: false, indicator: 0, changeProgress: 0 }));
const fixedPickups = ['magnet', 'rocket', 'coin', 'coin', 'magnet', 'rocket'].map((kind, i) => ({ id: `bench-pickup-${i}`, kind, x: [-4.5, 4.5, 0][i % 3], z: -48 - i * 32 }));
const output = document.querySelector('#metrics');
const samples = [];
const submissions = [];
const tasks = [];
let phase = 'ready';
let sampleVersion = 0;
let observer;
try { observer = new PerformanceObserver(list => { if (phase === 'sample') for (const item of list.getEntries()) tasks.push(item.duration); }); observer.observe({ entryTypes: ['longtask'] }); } catch { /* Optional browser support. */ }

const diagnostics = {
  timeline: [], contextLost: 0, contextRestored: 0, shaderErrors: [],
  sampleStart: null, sampleEnd: null,
  frames: { visibleFocused: 0, visibleUnfocused: 0, hidden: 0 },
  gpu: null, cleanup: null, pageErrors: [], shadowFrame: { calls: 0, triangles: 0 }, mainPassQuery: null,
};
const observeBrowser = source => {
  const state = { atMs: performance.now(), visibility: document.visibilityState, focused: document.hasFocus(), source };
  const previous = diagnostics.timeline.at(-1);
  if (!previous || previous.visibility !== state.visibility || previous.focused !== state.focused) diagnostics.timeline.push(state);
};

function attachDiagnostics({ gl }) {
  const context = gl.getContext();
  const extension = context.getExtension('EXT_disjoint_timer_query_webgl2');
  diagnostics.gpu = { context, extension, pending: [], samples: [], passSamples: { shadow: [], main: [] }, issued: 0, skipped: 0, disjointFrames: 0, discarded: 0 };
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
  const previousAutoReset = gl.info.autoReset;
  const previousShadowRender = gl.shadowMap.render;
  gl.info.autoReset = false;
  // The renderer normally clears info between shadows and the visible pass.
  // Keep it cumulative; measure the shadow subpass without issuing a second draw.
  gl.shadowMap.render = function (...args) {
    const calls = gl.info.render.calls, triangles = gl.info.render.triangles;
    const query = beginPassQuery('shadow');
    let result;
    try { result = previousShadowRender.apply(this, args); }
    finally {
      endPassQuery(query);
      diagnostics.mainPassQuery = beginPassQuery('main');
    }
    diagnostics.shadowFrame.calls += gl.info.render.calls - calls;
    diagnostics.shadowFrame.triangles += gl.info.render.triangles - triangles;
    return result;
  };
  const pageError = event => diagnostics.pageErrors.push(String(event.message || event.reason || 'Unknown error').slice(0, 4000));
  window.addEventListener('error', pageError); window.addEventListener('unhandledrejection', pageError);
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
    gl.info.autoReset = previousAutoReset;
    gl.shadowMap.render = previousShadowRender;
    window.removeEventListener('error', pageError); window.removeEventListener('unhandledrejection', pageError);
    diagnostics.gpu.pending.forEach(({ query }) => context.deleteQuery(query));
    diagnostics.gpu.pending.length = 0;
  };
}

function beginPassQuery(pass) {
  const gpu = diagnostics.gpu;
  if (!profilePasses || phase !== 'sample' || !gpu?.extension || gpu.context.isContextLost()) return null;
  if (gpu.pending.length >= 12 || gpu.context.getParameter(gpu.extension.GPU_DISJOINT_EXT)) { gpu.skipped++; return null; }
  const query = gpu.context.createQuery();
  if (!query) return null;
  gpu.context.beginQuery(gpu.extension.TIME_ELAPSED_EXT, query);
  return { query, pass };
}

function endPassQuery(entry) {
  if (!entry) return;
  const gpu = diagnostics.gpu;
  gpu.context.endQuery(gpu.extension.TIME_ELAPSED_EXT);
  gpu.pending.push(entry); gpu.issued++;
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
    const { query, pass } = gpu.pending.shift();
    // QUERY_RESULT is read only after availability; never wait on a GPU fence.
    const milliseconds = context.getQueryParameter(query, context.QUERY_RESULT) / 1e6;
    if (Number.isFinite(milliseconds)) {
      if (pass) gpu.passSamples[pass].push(milliseconds);
      else gpu.samples.push(milliseconds);
    }
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
      : profilePasses ? 'whole-frame query disabled for sequential pass profiling'
      : sorted.length ? 'asynchronous elapsed GPU queries' : 'no completed valid GPU queries',
    samples: sorted.length, issued: gpu?.issued ?? 0, pending: gpu?.pending.length ?? 0,
    skippedWhenPoolFull: gpu?.skipped ?? 0, disjointFrames: gpu?.disjointFrames ?? 0, discarded: gpu?.discarded ?? 0,
    meanMs: sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : null,
    medianMs: sorted.length ? sorted[Math.floor(sorted.length * .5)] : null,
    p95Ms: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * .95))] : null,
  };
  const passSummary = pass => {
    const values = [...(gpu?.passSamples[pass] || [])].sort((a, b) => a - b);
    return { samples: values.length,
      meanMs: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      medianMs: values.length ? values[Math.floor(values.length * .5)] : null,
      p95Ms: values.length ? values[Math.min(values.length - 1, Math.floor(values.length * .95))] : null };
  };
  const gpuPassTiming = profilePasses ? {
    supported: Boolean(gpu?.extension),
    definition: 'Non-overlapping asynchronous queries around shadowMap.render, then the remaining visible/transmission render; whole-frame timer disabled.',
    shadow: passSummary('shadow'), mainAndTransmission: passSummary('main'),
    issued: gpu?.issued ?? 0, pending: gpu?.pending.length ?? 0, skipped: gpu?.skipped ?? 0,
    disjointFrames: gpu?.disjointFrames ?? 0, discarded: gpu?.discarded ?? 0,
  } : null;
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
  if (!gpuTiming.samples && !(gpuPassTiming?.shadow.samples || gpuPassTiming?.mainAndTransmission.samples)) warnings.push('No valid GPU timing samples; rAF intervals cannot distinguish GPU cost from compositor or browser scheduling.');
  if (samples.length && samples.filter(value => value >= 250).length > samples.length / 2) warnings.push('Most rAF intervals exceeded 250ms. This cadence is consistent with either heavy rendering or scheduling limits; it is not proof of either cause.');
  return {
    browserObservation: { ...exposure, frames: diagnostics.frames, finalVisibility: document.visibilityState, finalFocus: document.hasFocus(), transitions: diagnostics.timeline, userAgent: navigator.userAgent },
    gpuTiming,
    ...(profilePasses ? { gpuPassTiming } : {}),
    webglDiagnostics: { contextLostEvents: diagnostics.contextLost, contextRestoredEvents: diagnostics.contextRestored, contextCurrentlyLost: gl.getContext().isContextLost(), drawingBuffer: [gl.getContext().drawingBufferWidth, gl.getContext().drawingBufferHeight], shaderErrors: diagnostics.shaderErrors, pageErrors: diagnostics.pageErrors, programLogs: shaderPrograms },
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

const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] : null;
};
const rounded = value => Number.isFinite(value) ? Number(value.toFixed(3)) : null;

function sceneCensus(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), shadows = [];
  let meshes = 0, instances = 0;
  scene.traverse(object => {
    if (object.isMesh) {
      meshes++;
      if (object.isInstancedMesh) instances += object.count;
      geometries.add(object.geometry);
      for (const material of [object.material].flat()) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    }
    if (object.isLight && object.castShadow && object.shadow) shadows.push({
      name: object.name, mapSize: object.shadow.mapSize.toArray(),
      ...Object.fromEntries(Object.entries(object.userData).filter(([, value]) => ['number', 'boolean', 'string'].includes(typeof value))),
    });
  });
  return { meshes, instanceCount: instances, uniqueGeometries: geometries.size, uniqueMaterials: materials.size, uniqueTextures: textures.size, shadows };
}

function resetMeasurements() {
  samples.length = 0; submissions.length = 0; tasks.length = 0;
  diagnostics.sampleStart = null; diagnostics.sampleEnd = null;
  diagnostics.frames = { visibleFocused: 0, visibleUnfocused: 0, hidden: 0 };
  diagnostics.timeline.length = 0;
  observeBrowser('sample-reset');
  const gpu = diagnostics.gpu;
  if (gpu) {
    gpu.pending.forEach(({ query }) => gpu.context.deleteQuery(query));
    Object.assign(gpu, { pending: [], samples: [], passSamples: { shadow: [], main: [] }, issued: 0, skipped: 0, disjointFrames: 0, discarded: 0 });
  }
  phase = 'warmup';
  delete output.dataset.result;
}

function Drive({ ready, finished }) {
  const clock = useRef({ version: -1, time: 0, previous: 0, nextReport: 0, frameInterval: 0 });
  const lighting = useRef({ first: null, last: null, variants: new Set(), programsStart: null, programsEnd: null, programsMax: 0 });
  const { gl, size, scene, camera } = useThree();
  const target = useRef(new Vector3());
  const drawingBuffer = useRef(new Vector2());
  useEffect(() => {
    return () => { observer?.disconnect(); diagnostics.cleanup?.(); };
  }, []);

  // Run after the game's camera but before CSM; every case has an exact,
  // settled camera instead of depending on smoothing or delivered frame rate.
  useFrame(() => {
    const portrait = scenario.height > scenario.width;
    const fov = (portrait ? 66 : 54) + Math.min(runStats.cruiseSpeed / 28, 7);
    camera.position.set(0, portrait ? 6.4 : 5.2, portrait ? 13 : 11.5);
    const road = sampleRoadFrame(scenario.station, -36);
    target.current.set(road.x, 0.7, road.z);
    camera.lookAt(target.current);
    if (camera.fov !== fov || camera.aspect !== scenario.width / scenario.height) {
      camera.fov = fov; camera.aspect = scenario.width / scenario.height;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }, -0.7);

  useFrame(() => {
    const current = clock.current;
    if (current.version !== sampleVersion) {
      Object.assign(current, { version: sampleVersion, time: 0, previous: 0, nextReport: 0, frameInterval: 0 });
      lighting.current = { first: null, last: null, variants: new Set(), programsStart: null, programsEnd: null, programsMax: 0 };
      resetMeasurements();
    }
    if (!ready) {
      current.previous = 0;
      output.textContent = 'Preparing the real race textures, CSM shadows and shaders…';
      return;
    }
    const now = performance.now();
    current.frameInterval = current.previous ? now - current.previous : 0;
    current.previous = now;
    if (phase !== 'complete') {
      current.time += current.frameInterval / 1000;
      phase = current.time >= scenario.warmupSeconds ? 'sample' : 'warmup';
    }
  }, -2);

  // Replace only the fixture's automatic render. One real submission gives
  // cumulative calls/triangles including every CSM map, plus a shadow subtotal.
  useFrame(({ gl: renderer, scene: renderScene, camera: renderCamera }) => {
    const current = clock.current;
    pollGpuQueries();
    const gpu = diagnostics.gpu;
    let query = null;
    if (!profilePasses && phase === 'sample' && gpu?.extension && !gpu.context.isContextLost()) {
      if (gpu.pending.length < 6 && !gpu.context.getParameter(gpu.extension.GPU_DISJOINT_EXT)) {
        query = gpu.context.createQuery();
        if (query) gpu.context.beginQuery(gpu.extension.TIME_ELAPSED_EXT, query);
      } else gpu.skipped++;
    }
    renderer.info.reset();
    diagnostics.shadowFrame.calls = 0; diagnostics.shadowFrame.triangles = 0;
    const renderStart = performance.now();
    try { renderer.render(renderScene, renderCamera); }
    finally {
      endPassQuery(diagnostics.mainPassQuery);
      diagnostics.mainPassQuery = null;
    }
    const cpuMs = performance.now() - renderStart;
    if (query) {
      gpu.context.endQuery(gpu.extension.TIME_ELAPSED_EXT);
      gpu.pending.push({ query }); gpu.issued++;
    }
    const render = renderer.info.render;
    const lastFrame = {
      totalCalls: render.calls, totalTriangles: render.triangles,
      shadowCalls: diagnostics.shadowFrame.calls, shadowTriangles: diagnostics.shadowFrame.triangles,
      mainPassCalls: render.calls - diagnostics.shadowFrame.calls,
      mainPassTriangles: render.triangles - diagnostics.shadowFrame.triangles,
      cpuSubmissionMs: cpuMs,
    };
    if (ready && phase === 'sample' && current.frameInterval > 0) {
      observeBrowser('sample-frame');
      diagnostics.sampleStart ??= performance.now() - current.frameInterval;
      diagnostics.sampleEnd = performance.now();
      diagnostics.frames[document.visibilityState !== 'visible' ? 'hidden' : document.hasFocus() ? 'visibleFocused' : 'visibleUnfocused']++;
      samples.push(current.frameInterval); submissions.push(lastFrame);
    }
    const completed = current.time >= scenario.warmupSeconds + scenario.sampleSeconds && samples.length > 0;
    if (ready && (current.time >= current.nextReport || completed) && phase !== 'complete') {
      const roundedMean = key => rounded(mean(submissions.map(frame => frame[key])));
      const currentLighting = lighting.current;
      const census = lightCensus(scene, camera), programs = gl.info.programs?.length || 0;
      currentLighting.first ??= census; currentLighting.last = census;
      currentLighting.variants.add(JSON.stringify(census));
      currentLighting.programsStart ??= programs; currentLighting.programsEnd = programs;
      currentLighting.programsMax = Math.max(currentLighting.programsMax, programs);
      const buffer = renderer.getDrawingBufferSize(drawingBuffer.current);
      const summary = {
        completed, phase: completed ? 'complete' : phase, elapsedSeconds: rounded(current.time),
        scenario, scenarioKey: JSON.stringify(scenario), physicsFrozen: true, persistentWrites: false,
        adaptiveResolution: false, viewport: [size.width, size.height], dpr: renderer.getPixelRatio(),
        drawingBuffer: [buffer.x, buffer.y], camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov, aspect: camera.aspect },
        frames: samples.length, fps: samples.length ? rounded(1000 / mean(samples)) : null,
        meanMs: rounded(mean(samples)), medianMs: rounded(percentile(samples, .5)), p95Ms: rounded(percentile(samples, .95)), p99Ms: rounded(percentile(samples, .99)),
        cpuSubmissionMedianMs: rounded(percentile(submissions.map(frame => frame.cpuSubmissionMs), .5)),
        cpuSubmissionP95Ms: rounded(percentile(submissions.map(frame => frame.cpuSubmissionMs), .95)),
        over25ms: samples.filter(value => value > 25).length, over50ms: samples.filter(value => value > 50).length,
        longTasks: tasks.length, maxLongTaskMs: Math.max(0, ...tasks),
        averageTotalDrawCalls: roundedMean('totalCalls'), averageTotalTriangles: roundedMean('totalTriangles'),
        averageShadowDrawCalls: roundedMean('shadowCalls'), averageShadowTriangles: roundedMean('shadowTriangles'),
        averageMainPassDrawCalls: roundedMean('mainPassCalls'), averageMainPassTriangles: roundedMean('mainPassTriangles'),
        counterDefinition: 'One real scene render: total includes CSM shadows; mainPass = total − shadows, including any transmission pass. autoReset=false; manual reset once per measured render.',
        lastFrame, geometryCount: renderer.info.memory.geometries, textureCount: renderer.info.memory.textures,
        sceneResources: sceneCensus(scene), programsAtSampleStart: currentLighting.programsStart,
        programsAtSampleEnd: currentLighting.programsEnd, maxProgramsDuringSample: currentLighting.programsMax,
        programCountGrowth: currentLighting.programsStart === null ? null : currentLighting.programsMax - currentLighting.programsStart,
        lightCountsAtSampleStart: currentLighting.first, lightCountsAtSampleEnd: currentLighting.last,
        lightCountsStable: currentLighting.variants.size <= 1, readinessGated: true,
      };
      const context = renderer.getContext(), debug = context.getExtension('WEBGL_debug_renderer_info');
      summary.renderer = debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
      Object.assign(summary, diagnosticSummary(renderer));
      output.dataset.result = JSON.stringify(summary); output.textContent = JSON.stringify(summary, null, 2);
      document.querySelector('#status').textContent = completed ? `Complete · ${summary.frames} frames · ${summary.fps} FPS · ${summary.averageTotalDrawCalls} total calls`
        : `${phase === 'sample' ? 'Sampling' : 'Warming'} · ${current.time.toFixed(1)} s · ${lastFrame.totalCalls} total / ${lastFrame.shadowCalls} shadow calls`;
      current.nextReport = current.time + 1;
      if (completed) { phase = 'complete'; finished(); }
    }
  }, 1);
  return null;
}

export default function Benchmark() {
  const [started, setStarted] = useState(parameters.get('autostart') === '1');
  const [complete, setComplete] = useState(false), [ready, setReady] = useState(false);
  useEffect(() => {
    const stage = document.querySelector('#root');
    stage.style.width = `${scenario.width}px`; stage.style.height = `${scenario.height}px`;
    const start = document.querySelector('#start'), reset = document.querySelector('#reset-sample');
    start.disabled = started; reset.disabled = !started || !ready;
    start.onclick = () => { start.disabled = true; setStarted(true); };
    reset.onclick = () => { sampleVersion++; setComplete(false); };
    document.querySelector('#repeat').onclick = () => location.reload();
    document.querySelector('#case-description').textContent = `${scenario.name} · ${getCar(scenario.car).name} · ${scenario.traffic} NPCs · ${scenario.width}×${scenario.height} at DPR ${dpr} · ${scenario.quality}. Frozen physics/camera, no persistent writes; ${scenario.warmupSeconds}s warmup + ${scenario.sampleSeconds}s sample.`;
  }, [started, ready]);
  return started ? <div className="lx-race" style={{ width: '100%', height: '100%' }}>
    <Canvas onCreated={attachDiagnostics} dpr={dpr} shadows="soft" frameloop={complete ? 'demand' : 'always'} camera={{ position: [0, 5.2, 11.5], fov: 54, near: 0.5, far: 750 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}>
      <color attach="background" args={['#070e20']} />
      <Suspense fallback={null}><RaceScene low={low} adaptive={false} onReady={() => setReady(true)} onReduceQuality={() => {}} /><Drive ready={ready} finished={() => setComplete(true)} /></Suspense>
    </Canvas><RaceHUD />
  </div> : null;
}
// Set the frozen loadout before the scene first reads runCar; no game action,
// garage write, reward or submission is called by this standalone entry.
useGameStore.setState({ gameState: 'playing', gameOver: false, updateGame: () => {},
  runCar: scenario.car, runStats, speed: runStats.cruiseSpeed, score: 0, soundEnabled: false,
  totalDistance: scenario.station / 5, elapsedTime: scenario.time, currentLevel: 8,
  currentX: 0, steeringVelocity: 0, isNitroActive: false, rocketActive: false,
  magnetActive: false, message: '', cameraShake: 0, particles: [], enemies: fixedEnemies, coins: fixedPickups });
createRoot(document.querySelector('#root')).render(<Benchmark />);
