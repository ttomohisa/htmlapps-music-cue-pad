const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || 'src/index.template.html', 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, 'missing function ' + name);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.indexOf('\n      }', lineEnd) + 8);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function savingFixture() {
  const state = { persistence: { supported: true, ready: true, saving: false, errorType: '' } };
  const calls = { status: 0, estimate: 0, errors: 0 };
  const context = vm.createContext({
    state, calls, Promise,
    renderStorageStatus: () => { calls.status++; },
    refreshStorageEstimate: () => { calls.estimate++; },
    markPersistenceError: () => { calls.errors++; },
  });
  vm.runInContext('let persistenceGeneration = 0, persistencePendingWrites = 0, persistenceWriteChain = Promise.resolve();\n' + fn('enqueuePersistence'), context);
  const pendingCount = () => vm.runInContext('persistencePendingWrites', context);
  const invalidate = () => vm.runInContext('persistenceGeneration++', context);
  return { context, state, calls, pendingCount, invalidate };
}

test('reset cancels writes still queued behind an unfinished write without leaving Saving stuck', async () => {
  const h = savingFixture(), first = deferred();
  let obsoleteTaskExecuted = false;
  const beforeReset = h.context.enqueuePersistence(() => first.promise);
  await Promise.resolve(); await Promise.resolve();
  const obsolete = h.context.enqueuePersistence(() => { obsoleteTaskExecuted = true; });
  assert.equal(h.pendingCount(), 2);
  assert.equal(h.state.persistence.saving, true);
  h.invalidate(); // Reset or successful backup replacement
  first.resolve();
  assert.equal(await beforeReset, true);
  assert.equal(await obsolete, false);
  assert.equal(obsoleteTaskExecuted, false);
  assert.equal(h.pendingCount(), 0);
  assert.equal(h.state.persistence.saving, false);
  assert.equal(h.calls.errors, 0);
});

test('generation change before any queued write starts still drains the counter', async () => {
  const h = savingFixture();
  let writes = 0;
  const obsolete = h.context.enqueuePersistence(() => { writes++; });
  h.invalidate();
  assert.equal(await obsolete, false);
  assert.equal(writes, 0);
  assert.equal(h.pendingCount(), 0);
  assert.equal(h.state.persistence.saving, false);

  const fresh = await h.context.enqueuePersistence(() => { writes++; });
  assert.equal(fresh, true);
  assert.equal(writes, 1);
  assert.equal(h.pendingCount(), 0);
  assert.equal(h.state.persistence.saving, false);
});

test('canceled queued writes do not overwrite the newer snapshot after restore', async () => {
  const h = savingFixture(), blocker = deferred();
  const commits = [];
  const active = h.context.enqueuePersistence(async () => { await blocker.promise; commits.push('old committed'); });
  await Promise.resolve(); await Promise.resolve();
  const stale = h.context.enqueuePersistence(() => { commits.push('stale'); });
  h.invalidate();
  blocker.resolve();
  await active;
  await stale;
  const fresh = h.context.enqueuePersistence(() => { commits.push('new snapshot'); });
  assert.equal(await fresh, true);
  assert.deepEqual(commits, ['old committed', 'new snapshot']);
  assert.equal(h.state.persistence.saving, false);
});

function fadeFixture() {
  const cueA = { id: 'a' }, cueB = { id: 'b' };
  const assetA = { id: 'asset-a' }, assetB = { id: 'asset-b' };
  let selected = cueA;
  const graph = deferred();
  const calls = { ramps: [], timers: [], frames: [], renders: 0 };
  const state = { playback: 'playing', manualFadeActive: false };
  const context = vm.createContext({
    state, Promise, FADE_STOP_SECONDS: 1.5,
    primaryAudio: { currentTime: 2, volume: 1, pause() {} },
    manualFadeToken: 0, manualFadeTimer: 0,
    activeCue: () => selected,
    activeAsset: () => selected === cueA ? assetA : assetB,
    cueEndTime: () => 10,
    cueStartTime: () => 0,
    cueVolume: () => 1,
    fadeFactor: () => 1,
    cancelManualFade: () => { context.manualFadeToken++; state.manualFadeActive = false; },
    stopBoundaryMonitor() {},
    ensureAudioGraph: () => graph.promise,
    cueGainNode: { gain: { value: 1, cancelScheduledValues() {}, setValueAtTime(value,time) { calls.ramps.push(['set', value,time]); }, linearRampToValueAtTime(value,time) { calls.ramps.push(['ramp',value,time]); } } },
    audioContext: { currentTime: 4 },
    renderCues: () => { calls.renders++; },
    renderPlayer: () => { calls.renders++; },
    requestAnimationFrame: fn => { calls.frames.push(fn); return calls.frames.length; },
    window: { setTimeout: (fn,time) => { calls.timers.push({fn,time}); return calls.timers.length; } },
    performance: { now: () => 0 },
  });
  vm.runInContext(fn('fadeStopPlayback'), context);
  return { context, state, graph, calls, select: cue => { selected = cue; }, cueA, cueB };
}

test('switching cues while AudioContext resumes cannot fade out the newly selected track', async () => {
  const h = fadeFixture();
  const oldFade = h.context.fadeStopPlayback();
  assert.equal(h.state.playback, 'fading');
  h.select(h.cueB);
  h.state.playback = 'playing';
  h.context.cancelManualFade({ restoreGain: false });
  h.graph.resolve(true);
  await oldFade;
  assert.equal(h.state.playback, 'playing');
  assert.deepEqual(h.calls.ramps, []);
  assert.deepEqual(h.calls.timers, []);
  assert.deepEqual(h.calls.frames, []);
});

test('stopping a cue while its Fade Stop graph is suspended cancels the obsolete fade', async () => {
  const h = fadeFixture();
  const oldFade = h.context.fadeStopPlayback();
  h.context.cancelManualFade({ restoreGain: false });
  h.state.playback = 'stopped';
  h.graph.resolve(true);
  await oldFade;
  assert.deepEqual(h.calls.ramps, []);
  assert.deepEqual(h.calls.timers, []);
});

test('uninterrupted Fade Stop still applies a ramp and schedules its stop', async () => {
  const h = fadeFixture();
  const p = h.context.fadeStopPlayback();
  h.graph.resolve(true);
  await p;
  assert.equal(h.state.playback, 'fading');
  assert.deepEqual(h.calls.ramps.map(x => x[0]), ['set', 'ramp']);
  assert.equal(h.calls.timers.length, 1);
});


test('back/forward cache pagehide retains audio URLs, media source, and IndexedDB connection', () => {
  const events = new Map(), revoked = [], cleared = [], calls = [];
  const urls = new Set(['blob:track-a', 'blob:track-b']);
  const audio = {
    src: 'blob:track-a',
    pause() { calls.push('pause'); },
    removeAttribute(name) { calls.push('remove:' + name); this.src = ''; }
  };
  const db = { close() { calls.push('db-close'); } };
  const graph = { state: 'running', close() { calls.push('audio-close'); } };
  const context = vm.createContext({
    window: { addEventListener(name, handler) { events.set(name, handler); } },
    invalidatePlayback() { calls.push('cancel'); },
    cancelLiveExitHold() {},
    releaseWakeLock() {},
    primaryAudio: audio,
    masterVolumeSaveTimer: 1, orphanCleanupTimer: 2,
    clearTimeout(id) { cleared.push(id); },
    blobUrls: urls,
    URL: { revokeObjectURL(url) { revoked.push(url); } },
    persistenceDb: db, audioContext: graph,
  });
  const start = source.indexOf("      window.addEventListener('pagehide', event => {");
  const end = source.indexOf("\n      $('#versionBadge')", start);
  assert.ok(start >= 0 && end > start, 'pagehide listener present');
  vm.runInContext(source.slice(start, end), context);
  events.get('pagehide')({ persisted: true });
  assert.equal(audio.src, 'blob:track-a');
  assert.deepEqual(revoked, []);
  assert.deepEqual(cleared, []);
  assert.equal(urls.size, 2);
  assert.ok(!calls.includes('db-close'));
  assert.ok(!calls.includes('audio-close'));
  assert.ok(calls.includes('pause'), 'background playback still pauses');

  events.get('pagehide')({ persisted: false });
  assert.equal(audio.src, '');
  assert.deepEqual(new Set(revoked), new Set(['blob:track-a', 'blob:track-b']));
  assert.equal(urls.size, 0);
  assert.deepEqual(cleared, [1, 2]);
  assert.ok(calls.includes('db-close'));
  assert.ok(calls.includes('audio-close'));
});
