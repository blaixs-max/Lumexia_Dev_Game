import { Component, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame } from '@react-three/fiber';
import { ACESFilmicToneMapping, BasicShadowMap, PCFShadowMap, PCFSoftShadowMap, VSMShadowMap } from 'three';
import RaceScene from '../src/components/RaceScene';
import RaceHUD from '../src/components/RaceHUD';
import { useGameStore } from '../src/store';
import { CARS, getCar, getCarStats } from '../src/utils/garage';
import { collisionWithPlayer, PLAYER_Z, SIMULATION_STEP } from '../src/utils/gameplay';
import { hasPassingCorridor, occupiedLanes, passingWindow, updateTraffic, WORLD_SPEED_SCALE } from '../src/utils/traffic';
import { getPlayerDimensions, VEHICLE_DIMENSIONS, VEHICLE_RENDER_LIMITS } from '../src/utils/vehicleDimensions';
import { sampleDayCycle } from '../src/environment/day-cycle';
import { ROAD_ROUTE_LENGTH, sampleRoadFrame, sampleTunnelAmount, tunnelStartZ } from '../src/environment/road-path';
import '../src/App.css';

const parameters = new URLSearchParams(location.search);
const low = parameters.get('quality') === 'performance';
const dpr = Math.min(2, Math.max(0.5, Number(parameters.get('dpr')) || 1));
const TRAFFIC_CASES = {
  normal: { label: 'Normal traffic', enemy: null },
  'suv-side-gap': { label: 'SUV side clearance', enemy: { type: 'suv', x: 2.5, z: -2 } },
  'truck-front-gap': { label: 'Truck front clearance', enemy: { type: 'truck', x: 0, z: -9 } },
  'truck-rear-gap': { label: 'Truck rear clearance', enemy: { type: 'truck', x: 0, z: 5 } },
  'truck-contact': { label: 'Truck actual contact', enemy: { type: 'truck', x: 0, z: -5 } },
};
const initialTraffic = Object.hasOwn(TRAFFIC_CASES, parameters.get('traffic')) ? parameters.get('traffic') : 'normal';
const SIMULATION_CASES = { static: 'Static layout', live: 'Live seeded traffic', following: 'Following / braking', 'lane-change': 'Lane-change case', 'shadow-pass': 'Shadow approach pass' };
const initialSimulation = Object.hasOwn(SIMULATION_CASES, parameters.get('simulation')) ? parameters.get('simulation') : 'static';
const initialLevel = [1, 3, 5, 8, 20, 80].includes(Number(parameters.get('level'))) ? Number(parameters.get('level')) : 1;
const initialSeed = parameters.has('seed') && Number.isFinite(Number(parameters.get('seed'))) ? Number(parameters.get('seed')) >>> 0 : 2026;
const settings = { car: getCar(parameters.get('car')).id, pickups: parameters.get('pickups') === 'powerups' ? 'powerups' : 'coins', traffic: initialTraffic, footprints: initialTraffic !== 'normal', simulation: initialSimulation, level: initialLevel, seed: initialSeed, simulationRunning: true, simulationVersion: 0, time: 0, station: 0, lane: 0, replay: false, cycle: false, version: 0, ready: false };
const diagnostics = { shaderErrors: [], pageErrors: [], contextLost: 0, contextRestored: 0, renderer: '', programsInitial: null, programsMax: 0, cleanup: null };
settings.stepSeconds = 0;
const types = ['sport', 'sedan', 'suv', 'truck', 'sport', 'sedan', 'suv', 'sedan'];
const element = id => document.getElementById(id);
const noop = () => {};
const isLiveTraffic = () => settings.simulation !== 'static';

function makeTrafficRandom() {
  let value = settings.seed;
  let prefix = settings.simulation === 'lane-change' ? 3 : 0;
  return () => {
    // A controlled first decision makes the isolated lane-change case repeatable.
    // Subsequent decisions and the live traffic case use the selected seed.
    if (prefix > 0) { prefix--; return 0.1; }
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function liveTrafficLayout() {
  const vehicle = (id, type, lane, z, ownSpeed, decision = 0) => ({
    id, type, lane, targetLane: lane, x: lane * 4.5, z, ownSpeed, actualSpeed: ownSpeed,
    passed: false, isChanging: false, indicator: 0, signalRemaining: 0,
    changeProgress: 0, laneDecisionRemaining: decision,
  });
  if (settings.simulation === 'following') return [
    vehicle('following-leader', 'truck', 0, -165, 43, 30),
    vehicle('following-follower', 'sport', 0, -130, 73, 30),
  ];
  if (settings.simulation === 'lane-change') return [vehicle('changing-sedan', 'sedan', 0, -240, 55)];
  if (settings.simulation === 'shadow-pass') return [vehicle('shadow-approach', 'suv', -1, -180, 55, Infinity)];
  // Nearby examples show forward motion immediately while the real spawner
  // fills the road at the selected level. Initial cars leave two passing lanes.
  return [vehicle('live-near', 'sport', -1, -60, 67, 1), vehicle('live-far', 'truck', 1, -160, 43, 1)];
}

function createTrafficSimulation() {
  return {
    state: { enemies: liveTrafficLayout(), speed: getCarStats(settings.car).cruiseSpeed,
      currentLevel: settings.level, elapsedTime: settings.time, totalDistance: settings.station / 5,
      nextTrafficDistance: settings.simulation === 'live' ? settings.station / 5 : Infinity,
      nextEntityId: 1, rocketActive: false, rocketTargetSpeed: 210, runStats: getCarStats(settings.car) },
    random: makeTrafficRandom(), accumulator: 0, seconds: 0, ticks: 0,
    signalsStarted: 0, laneChangesStarted: 0, laneChangesCompleted: 0,
    spawned: 0, removed: 0, peak: 0, overlapTicks: 0, minimumGap: Infinity,
    maxSpeedReduction: 0, relativeSpeeds: new Map(),
  };
}

function trafficPairGaps(enemies) {
  let minimumGap = Infinity;
  const contacts = [];
  for (let i = 0; i < enemies.length; i++) {
    const first = enemies[i], a = VEHICLE_DIMENSIONS[first.type] || VEHICLE_DIMENSIONS.sedan;
    for (let j = i + 1; j < enemies.length; j++) {
      const second = enemies[j], b = VEHICLE_DIMENSIONS[second.type] || VEHICLE_DIMENSIONS.sedan;
      if (Math.abs(first.x - second.x) >= (a.width + b.width) / 2) continue;
      const gap = Math.abs(first.z - second.z) - (a.length + b.length) / 2;
      minimumGap = Math.min(minimumGap, gap);
      if (gap < -0.0001) contacts.push({ first: first.id, second: second.id, overlap: Number((-gap).toFixed(4)) });
    }
  }
  return { minimumGap, contacts };
}

function advanceTrafficSimulation(simulation, delta) {
  simulation.accumulator += delta;
  while (simulation.accumulator + 1e-9 >= SIMULATION_STEP) {
    const state = simulation.state;
    const previous = new Map(state.enemies.map(enemy => [enemy.id, enemy]));
    const travel = state.speed * SIMULATION_STEP;
    state.totalDistance += travel * 0.1;
    state.elapsedTime += SIMULATION_STEP * (settings.cycle ? 20 : 1);
    updateTraffic(state, SIMULATION_STEP, travel, simulation.random);
    simulation.seconds += SIMULATION_STEP;
    simulation.ticks++;
    simulation.accumulator -= SIMULATION_STEP;
    const ids = new Set(state.enemies.map(enemy => enemy.id));
    previous.forEach((enemy, id) => {
      if (!ids.has(id)) { simulation.removed++; simulation.relativeSpeeds.delete(id); }
    });
    for (const enemy of state.enemies) {
      const before = previous.get(enemy.id);
      if (!before) simulation.spawned++;
      else {
        simulation.relativeSpeeds.set(enemy.id, (enemy.z - before.z) / SIMULATION_STEP);
        if (enemy.indicator && !before.indicator) simulation.signalsStarted++;
        if (enemy.isChanging && !before.isChanging) simulation.laneChangesStarted++;
        if (enemy.lane !== before.lane) simulation.laneChangesCompleted++;
      }
      simulation.maxSpeedReduction = Math.max(simulation.maxSpeedReduction, enemy.ownSpeed - (enemy.actualSpeed ?? enemy.ownSpeed));
    }
    simulation.peak = Math.max(simulation.peak, state.enemies.length);
    const gaps = trafficPairGaps(state.enemies);
    simulation.minimumGap = Math.min(simulation.minimumGap, gaps.minimumGap);
    if (gaps.contacts.length) simulation.overlapTicks++;
  }
  settings.station = simulation.state.totalDistance * 5;
  settings.time = simulation.state.elapsedTime;
}

function liveTrafficReport(simulation) {
  if (!isLiveTraffic() || !simulation) return { enabled: false, label: SIMULATION_CASES.static };
  const state = simulation.state, gaps = trafficPairGaps(state.enemies);
  const round = value => Number.isFinite(value) ? Number(value.toFixed(4)) : null;
  const speeds = [...new Set([state.runStats.cruiseSpeed, state.runStats.boostSpeed, state.rocketTargetSpeed])];
  return { enabled: true, label: SIMULATION_CASES[settings.simulation], running: settings.simulationRunning,
    seed: settings.seed, randomPrefix: settings.simulation === 'lane-change' ? 'first 3 samples = 0.1' : 'none',
    level: settings.level, fixedStepSeconds: SIMULATION_STEP, simulatedSeconds: round(simulation.seconds), ticks: simulation.ticks,
    playerCollisionsDisabled: true, persistentWrites: false, spawned: simulation.spawned, removed: simulation.removed,
    active: state.enemies.length, peak: simulation.peak, signalsStarted: simulation.signalsStarted,
    laneChangesStarted: simulation.laneChangesStarted, laneChangesCompleted: simulation.laneChangesCompleted,
    maxSpeedReduction: round(simulation.maxSpeedReduction), minimumPairGap: round(gaps.minimumGap),
    minimumPairGapObserved: round(simulation.minimumGap), npcContacts: gaps.contacts, overlapTicks: simulation.overlapTicks,
    passingCorridor: { open: hasPassingCorridor(state.enemies, speeds), reservedDistance: passingWindow(speeds),
      definition: 'Production spatial passing corridor; both lanes reserved during signals/changes',
      playerSpeeds: speeds, worldSpeedScale: WORLD_SPEED_SCALE },
    vehicles: state.enemies.map(enemy => ({ id: enemy.id, type: enemy.type, lane: enemy.lane, targetLane: enemy.targetLane,
      planned: Boolean(enemy.laneChangePlanned), reservedLanes: occupiedLanes(enemy),
      x: round(enemy.x), z: round(enemy.z), desiredSpeed: enemy.ownSpeed, actualSpeed: round(enemy.actualSpeed ?? enemy.ownSpeed),
      forwardWorldSpeed: round((enemy.actualSpeed ?? enemy.ownSpeed) * WORLD_SPEED_SCALE),
      relativeWorldSpeed: round(simulation.relativeSpeeds.get(enemy.id)), isChanging: enemy.isChanging,
      indicator: enemy.indicator, changeProgress: round(enemy.changeProgress) })),
  };
}

function trafficLayout() {
  const fixture = TRAFFIC_CASES[settings.traffic].enemy;
  if (fixture) return [{ id: 'route-collision-fixture', ...fixture, lane: 0, targetLane: 0, ownSpeed: 0, isChanging: false, indicator: 0 }];
  return types.map((type, i) => ({ id: `route-${i}`, type, x: [-4.5, 0, 4.5][i % 3],
    z: 24 - ((i * 51 + 360 - settings.station / 70 * 12 % 360) % 360), isChanging: false, indicator: 0 }));
}

function collisionReport(state) {
  const playerDimensions = getPlayerDimensions(state.runCar);
  const rounded = number => Number(number.toFixed(6));
  const vehicles = state.enemies.map(enemy => {
    const footprint = VEHICLE_DIMENSIONS[enemy.type] || VEHICLE_DIMENSIONS.sedan;
    const legacy = VEHICLE_RENDER_LIMITS[enemy.type] || VEHICLE_RENDER_LIMITS.sedan;
    const dx = Math.abs(enemy.x - state.currentX), dz = Math.abs(enemy.z - PLAYER_Z);
    return { id: enemy.id, type: enemy.type, x: enemy.x, z: enemy.z, footprint,
      gapX: rounded(dx - (playerDimensions.width + footprint.width) / 2),
      gapZ: rounded(dz - (playerDimensions.length + footprint.length) / 2),
      collision: collisionWithPlayer(enemy, enemy, state.currentX, state.currentX, playerDimensions),
      legacyCollision: dx <= (VEHICLE_RENDER_LIMITS.player.width + legacy.width) / 2 + 0.2
        && dz <= (VEHICLE_RENDER_LIMITS.player.length + legacy.length) / 2 + 0.2,
    };
  });
  return { layout: settings.traffic, label: TRAFFIC_CASES[settings.traffic].label,
    player: { car: state.runCar, x: state.currentX, z: PLAYER_Z, footprint: playerDimensions },
    footprintsVisible: settings.footprints, gapUnits: 'world units; positive = visible AABB clearance on that axis', vehicles };
}

function Footprint({ id, dimensions, player = false }) {
  const group = useRef();
  useFrame(() => {
    if (!group.current) return;
    const state = useGameStore.getState();
    const vehicle = player ? { x: state.currentX, z: PLAYER_Z } : state.enemies.find(enemy => enemy.id === id);
    group.current.visible = settings.footprints && Boolean(vehicle);
    if (!vehicle) return;
    const road = sampleRoadFrame(state.totalDistance * 5, vehicle.z);
    group.current.position.set(road.x + vehicle.x * Math.cos(road.yaw), 0.04, road.z - vehicle.x * Math.sin(road.yaw));
    group.current.rotation.y = road.yaw;
  });
  return <group ref={group} visible={false}><mesh renderOrder={20}>
    <boxGeometry args={[dimensions.width, 0.02, dimensions.length]} />
    <meshBasicMaterial color={player ? '#7deaff' : '#a8ff76'} wireframe transparent opacity={0.85} depthTest={false} toneMapped={false} />
  </mesh></group>;
}

function CollisionFootprints() {
  const carId = useGameStore(state => state.runCar);
  const enemies = useGameStore(state => state.enemies);
  return <><Footprint player dimensions={getPlayerDimensions(carId)} />
    {enemies.map(enemy => <Footprint key={enemy.id} id={enemy.id} dimensions={VEHICLE_DIMENSIONS[enemy.type] || VEHICLE_DIMENSIONS.sedan} />)}</>;
}

function pickupLayout() {
  if (settings.pickups === 'powerups') return [
    { id: 'route-magnet-near', kind: 'magnet', x: -4.5, z: -12 },
    { id: 'route-rocket-near', kind: 'rocket', x: 4.5, z: -12 },
    { id: 'route-coin-middle', kind: 'coin', x: 0, z: -25 },
    { id: 'route-magnet-far', kind: 'magnet', x: -4.5, z: -45 },
    { id: 'route-rocket-far', kind: 'rocket', x: 4.5, z: -45 },
  ];
  return Array.from({ length: 8 }, (_, i) => ({ id: `route-coin-${i}`, kind: 'coin', x: [-4.5, 0, 4.5][i % 3], z: -28 - i * 38 }));
}

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

function shadowSettings(gl, scene) {
  const names = { [BasicShadowMap]: 'BasicShadowMap', [PCFShadowMap]: 'PCFShadowMap', [PCFSoftShadowMap]: 'PCFSoftShadowMap', [VSMShadowMap]: 'VSMShadowMap' };
  const lights = [];
  let castingMeshes = 0, receivingMeshes = 0, playerCastingMeshes = 0;
  scene.traverse(object => {
    if (object.isMesh) {
      if (object.castShadow) castingMeshes++;
      if (object.receiveShadow) receivingMeshes++;
    }
    if (!object.isLight || !object.castShadow || !object.shadow) return;
    const shadow = object.shadow, camera = shadow.camera;
    lights.push({ name: object.name || object.type, type: object.type, intensity: object.intensity, visible: object.visible,
      position: object.position.toArray(), target: object.target?.position.toArray(),
      metadata: Object.fromEntries(Object.entries(object.userData).filter(([, value]) => ['number', 'string', 'boolean'].includes(typeof value))),
      mapSize: shadow.mapSize.toArray(), bias: shadow.bias, normalBias: shadow.normalBias, radius: shadow.radius,
      camera: { near: camera.near, far: camera.far, left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom },
    });
  });
  scene.getObjectByName('player-car')?.traverse(object => { if (object.isMesh && object.castShadow) playerCastingMeshes++; });
  return { enabled: gl.shadowMap.enabled, type: names[gl.shadowMap.type] || gl.shadowMap.type,
    autoUpdate: gl.shadowMap.autoUpdate, castingMeshes, receivingMeshes, playerCastingMeshes, lights };
}

function bindControls() {
  const listeners = [];
  const listen = (id, event, handler) => { const node = element(id); node.addEventListener(event, handler); listeners.push(() => node.removeEventListener(event, handler)); };
  const setNumber = (key, value) => {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && (key === 'lane' || parsed >= 0)) { settings[key] = parsed; settings.version++; }
  };
  const carSelect = element('route-car');
  carSelect.replaceChildren(...CARS.map(car => new Option(car.name, car.id)));
  carSelect.value = settings.car;
  element('route-quality').value = low ? 'performance' : 'high';
  element('route-pickups').value = settings.pickups;
  const syncCollisionControls = () => {
    const live = isLiveTraffic();
    element('route-traffic').value = settings.traffic;
    element('route-traffic').disabled = live;
    element('route-simulation').value = settings.simulation;
    element('route-level').value = String(settings.level);
    element('route-seed').value = String(settings.seed);
    element('route-level').disabled = !live;
    element('route-seed').disabled = !live;
    element('route-sim-play').disabled = !live;
    element('route-sim-restart').disabled = !live;
    for (const id of ['route-sim-step-small', 'route-sim-step-one']) element(id).disabled = !live || settings.simulationRunning;
    element('route-sim-play').setAttribute('aria-pressed', String(settings.simulationRunning));
    element('route-sim-play').textContent = settings.simulationRunning ? 'Pause traffic' : 'Resume traffic';
    element('route-footprints').setAttribute('aria-pressed', String(settings.footprints));
    element('route-lane').disabled = !live && settings.traffic !== 'normal';
    element('route-replay').disabled = live || settings.traffic !== 'normal';
  };
  syncCollisionControls();
  listen('route-car', 'change', event => {
    settings.car = getCar(event.target.value).id; settings.version++; settings.simulationVersion++;
    const url = new URL(location.href); url.searchParams.set('car', settings.car); history.replaceState(null, '', url);
  });
  listen('route-quality', 'change', event => {
    const url = new URL(location.href); url.searchParams.set('quality', event.target.value); url.searchParams.set('car', settings.car); location.assign(url);
  });
  listen('route-pickups', 'change', event => {
    settings.pickups = event.target.value === 'powerups' ? 'powerups' : 'coins'; settings.version++;
    const url = new URL(location.href); url.searchParams.set('pickups', settings.pickups); history.replaceState(null, '', url);
  });
  listen('route-traffic', 'change', event => {
    settings.traffic = Object.hasOwn(TRAFFIC_CASES, event.target.value) ? event.target.value : 'normal';
    settings.lane = 0; settings.station = 0; settings.replay = false;
    settings.footprints = settings.traffic !== 'normal'; settings.version++;
    for (const id of ['route-lane', 'route-station', 'route-distance-input']) element(id).value = '0';
    element('route-replay').setAttribute('aria-pressed', 'false');
    syncCollisionControls();
    const url = new URL(location.href); url.searchParams.set('traffic', settings.traffic); history.replaceState(null, '', url);
  });
  listen('route-simulation', 'change', event => {
    settings.simulation = Object.hasOwn(SIMULATION_CASES, event.target.value) ? event.target.value : 'static';
    settings.replay = false; settings.simulationRunning = true; settings.station = 0;
    settings.simulationVersion++; settings.version++;
    element('route-replay').setAttribute('aria-pressed', 'false');
    element('route-station').value = '0'; element('route-distance-input').value = '0';
    syncCollisionControls();
    const url = new URL(location.href); url.searchParams.set('simulation', settings.simulation); history.replaceState(null, '', url);
  });
  listen('route-level', 'change', event => {
    settings.level = Number(event.target.value); settings.simulationVersion++; settings.version++;
    const url = new URL(location.href); url.searchParams.set('level', String(settings.level)); history.replaceState(null, '', url);
  });
  listen('route-seed', 'change', event => {
    settings.seed = Number(event.target.value) >>> 0; settings.simulationVersion++; settings.version++;
    event.target.value = String(settings.seed);
    const url = new URL(location.href); url.searchParams.set('seed', String(settings.seed)); history.replaceState(null, '', url);
  });
  listen('route-sim-play', 'click', () => {
    settings.simulationRunning = !settings.simulationRunning; syncCollisionControls();
  });
  for (const [id, seconds] of [['route-sim-step-small', 0.1], ['route-sim-step-one', 1]]) {
    listen(id, 'click', () => { settings.stepSeconds += seconds; });
  }
  listen('route-sim-restart', 'click', () => {
    settings.station = 0; settings.simulationRunning = true; settings.simulationVersion++; settings.version++;
    element('route-station').value = '0'; element('route-distance-input').value = '0'; syncCollisionControls();
  });
  listen('route-footprints', 'click', () => {
    settings.footprints = !settings.footprints; syncCollisionControls(); settings.version++;
  });
  listen('route-phase', 'change', event => { setNumber('time', event.target.value); element('route-time-input').value = settings.time; });
  listen('route-station', 'change', event => { setNumber('station', event.target.value); element('route-distance-input').value = settings.station; });
  listen('route-time-input', 'change', event => setNumber('time', event.target.value));
  listen('route-distance-input', 'change', event => setNumber('station', event.target.value));
  listen('route-lane', 'change', event => setNumber('lane', event.target.value));
  for (const [id, key] of [['route-replay', 'replay'], ['route-cycle', 'cycle']]) {
    listen(id, 'click', event => { settings[key] = !settings[key]; event.currentTarget.setAttribute('aria-pressed', String(settings[key])); settings.version++; });
  }
  listen('route-reset', 'click', () => {
    Object.assign(settings, { traffic: 'normal', footprints: false, simulation: 'static', simulationRunning: true, time: 0, station: 0, lane: 0, replay: false, cycle: false, simulationVersion: settings.simulationVersion + 1, version: settings.version + 1 });
    for (const id of ['route-phase', 'route-station', 'route-time-input', 'route-distance-input', 'route-lane']) element(id).value = '0';
    for (const id of ['route-replay', 'route-cycle']) element(id).setAttribute('aria-pressed', 'false');
    syncCollisionControls();
    const url = new URL(location.href); url.searchParams.delete('traffic'); url.searchParams.delete('simulation'); history.replaceState(null, '', url);
  });
  listen('route-reload', 'click', () => location.reload());
  return () => listeners.forEach(cleanup => cleanup());
}

function Drive() {
  const last = useRef({ version: -1, simulationVersion: -1, simulation: null, reportAt: 0, previous: 0, frameMs: 0 });
  useFrame(({ gl, scene, camera, size }, delta) => {
    const current = last.current;
    const now = performance.now();
    current.frameMs = current.previous ? now - current.previous : 0; current.previous = now;
    const dt = document.visibilityState === 'visible' ? Math.min(delta, 0.1) : 0;
    const live = isLiveTraffic();
    if (!live && settings.ready && settings.replay) { settings.station += dt * 70; settings.version++; }
    if (!live && settings.ready && settings.cycle) { settings.time += dt * 20; settings.version++; }
    if (live && current.simulationVersion !== settings.simulationVersion) {
      current.simulation = createTrafficSimulation();
      current.simulationVersion = settings.simulationVersion;
    }
    if (current.version !== settings.version) {
      const runStats = getCarStats(settings.car);
      if (live) {
        Object.assign(current.simulation.state, { elapsedTime: settings.time, totalDistance: settings.station / 5,
          speed: runStats.cruiseSpeed, currentLevel: settings.level, runStats });
      }
      useGameStore.setState({ gameState: 'playing', gameOver: false, sessionType: 'practice', soundEnabled: false, updateGame: noop,
        runCar: settings.car, runStats, nitro: runStats.maxNitro, maxNitro: runStats.maxNitro,
        elapsedTime: settings.time, totalDistance: settings.station / 5, currentLevel: live ? settings.level : 1,
        currentX: live || settings.traffic === 'normal' ? settings.lane : 0, steeringVelocity: 0,
        speed: live ? runStats.cruiseSpeed : 220, score: 0, isNitroActive: false, rocketActive: false, magnetActive: false, message: '', particles: [],
        enemies: live ? current.simulation.state.enemies : trafficLayout(),
        coins: pickupLayout(),
      });
      current.version = settings.version;
    }
    if (live && settings.ready && (settings.simulationRunning || settings.stepSeconds > 0) && useGameStore.getState().gameState !== 'paused') {
      const advance = settings.simulationRunning ? dt : settings.stepSeconds;
      settings.stepSeconds = 0;
      if (!settings.simulationRunning) current.reportAt = 0;
      advanceTrafficSimulation(current.simulation, advance);
      useGameStore.setState({ enemies: current.simulation.state.enemies,
        elapsedTime: settings.time, totalDistance: settings.station / 5 });
    }
    if (now >= current.reportAt) {
      const programs = gl.info.programs?.length || 0;
      if (settings.ready) diagnostics.programsInitial ??= programs;
      diagnostics.programsMax = Math.max(diagnostics.programsMax, programs);
      const frame = sampleRoadFrame(settings.station, -2);
      const pickups = pickupLayout();
      const byKind = pickups.reduce((counts, pickup) => { counts[pickup.kind] = (counts[pickup.kind] || 0) + 1; return counts; }, {});
      const collision = collisionReport(useGameStore.getState());
      const trafficMotion = liveTrafficReport(current.simulation);
      const report = {
        ready: settings.ready, phase: sampleDayCycle(settings.time), elapsedTime: Number(settings.time.toFixed(2)),
        station: Number(settings.station.toFixed(2)), routeStation: Number((settings.station % ROAD_ROUTE_LENGTH).toFixed(2)),
        tunnelFrontZ: Number(tunnelStartZ(settings.station).toFixed(2)), tunnelAmount: sampleTunnelAmount(settings.station, -2),
        playerRoadFrame: frame, replay: settings.replay, cycle: settings.cycle,
        viewport: [size.width, size.height], dpr: gl.getPixelRatio(), quality: low ? 'performance' : 'high',
        player: { id: settings.car, name: getCar(settings.car).name, model: getCar(settings.car).model, stats: getCarStats(settings.car) },
        pickups: { layout: settings.pickups, count: pickups.length, byKind, positions: pickups.map(({ kind, x, z }) => ({ kind, x, z })) },
        collision, trafficMotion,
        shadows: shadowSettings(gl, scene),
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
      const hits = collision.vehicles.filter(vehicle => vehicle.collision).length;
      const legacyHits = collision.vehicles.filter(vehicle => vehicle.legacyCollision).length;
      element('route-collision').dataset.contact = String(hits > 0);
      element('route-collision').textContent = `${collision.label}: ${hits ? 'COLLISION' : 'CLEAR'} · old bounds: ${legacyHits ? 'COLLISION' : 'CLEAR'}`;
      element('route-traffic-status').textContent = trafficMotion.enabled
        ? `${trafficMotion.label} · ${trafficMotion.simulatedSeconds.toFixed(1)} s · ${trafficMotion.active} NPCs · ${trafficMotion.laneChangesCompleted} lane changes · ${trafficMotion.npcContacts.length} NPC contacts${settings.simulationRunning ? '' : ' · PAUSED'}`
        : 'Static layout; live NPC simulation is off.';
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
    const runStats = getCarStats(settings.car);
    useGameStore.setState({ gameState: 'playing', updateGame: noop, soundEnabled: false,
      runCar: settings.car, runStats, nitro: runStats.maxNitro, maxNitro: runStats.maxNitro });
    return () => { unbind(); diagnostics.cleanup?.(); };
  }, []);
  return <Boundary><div className="lx-race" style={{ width: '100%', height: '100%' }}>
    <Canvas onCreated={attachDiagnostics} dpr={dpr} shadows="soft" camera={{ position: [0, 5.2, 11.5], fov: 54, near: 0.5, far: 750 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping }}>
      <Suspense fallback={null}><RaceScene low={low} adaptive={false} onReady={() => { settings.ready = true; setReady(true); }} onReduceQuality={noop} /><Drive /><CollisionFootprints /></Suspense>
    </Canvas>
    {ready ? <RaceHUD onMainMenu={() => location.reload()} onRestart={() => location.reload()} /> : null}
  </div></Boundary>;
}

createRoot(element('root')).render(<RouteCheck />);
