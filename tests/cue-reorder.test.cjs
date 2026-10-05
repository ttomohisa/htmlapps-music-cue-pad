// Source-level interaction tests. The DOM/audio doubles do not claim browser or audibility QA.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || 'src/index.template.html', 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, `actual runtime function ${name}`);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.slice(start, lineEnd).trimEnd().endsWith('}') ? lineEnd : source.indexOf('\n      }', lineEnd) + 8);
}
function section(start, end) {
  const at = source.indexOf(start); assert.notEqual(at, -1, start);
  const until = source.indexOf(end, at); assert.notEqual(until, -1, end);
  return source.slice(at, until);
}
function fixture(count = 3) {
  const nodes = new Map(), timers = new Map(), windowListeners = new Map();
  let clock = 0, timerId = 0;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.className = ''; this.dataset = {}; this.attrs = {}; this.style = {}; this.listeners = new Map();
      this.disabled = false; this.hidden = false; this.textContent = ''; this.value = '';
      this.classList = {
        contains: c => this.className.split(/\s+/).includes(c),
        add: (...cs) => { this.className = [...new Set([...this.className.split(/\s+/), ...cs])].join(' ').trim(); },
        remove: (...cs) => { this.className = this.className.split(/\s+/).filter(c => !cs.includes(c)).join(' '); },
        toggle: (c, enabled) => { (enabled ? this.classList.add : this.classList.remove)(c); },
      };
    }
    set innerHTML(html) {
      this.replaceChildren();
      // Only the named descendants read by the real cue renderer are needed here.
      for (const match of html.matchAll(/class="([^"]+)"/g)) { const child = new Element(); child.className = match[1]; this.append(child); }
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    matches(selector) {
      return selector.split(',').some(s => {
        s = s.trim(); const enabled = s.endsWith(':not(:disabled)'); if (enabled) s = s.slice(0, -':not(:disabled)'.length);
        return (!enabled || !this.disabled) && (s.startsWith('.') ? this.classList.contains(s.slice(1)) : s === this.tagName.toLowerCase());
      });
    }
    closest(s) { return this.matches(s) ? this : this.parentElement?.closest(s) || null; }
    querySelectorAll(s) { return this.children.flatMap(c => [...(c.matches(s) ? [c] : []), ...c.querySelectorAll(s)]); }
    querySelector(s) { return this.querySelectorAll(s)[0] || null; }
    append(...children) { for (const c of children) { c.remove(); c.parentElement = this; this.children.push(c); } }
    replaceChildren() { for (const c of this.children) c.parentElement = null; this.children = []; }
    remove() { if (this.parentElement) { this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; } }
    get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
    focus() { document.activeElement = this; }
    addEventListener(k, f) { this.listeners.set(k, f); }
  }
  const document = { activeElement: null, body: new Element('body'), listeners: new Map(), createElement: tag => new Element(tag), addEventListener(k, f) { this.listeners.set(k, f); }, querySelector: () => null };
  const $ = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const state = { cues: Array.from({ length: count }, (_, order) => ({ id: `c${order}`, assetId: 'shared', name: `Cue ${order}`, order, startTime: 2, endTime: 8, volume: .6, fadeIn: 1, fadeOut: 2, loop: true, shortcut: order === 2 ? 'N' : '' })), assets: new Map([['shared', { id: 'shared', status: 'ready', duration: 10, url: 'blob:shared', fileName: 'synthetic.wav', size: 20 }]]), activeCueId: null, playback: 'idle', liveMode: false, dragCueId: null, boardName: 'Keep board', masterVolume: .4 };
  const cueGrid = new Element(); document.body.append(cueGrid);
  const audioValues = { currentTime: 4, src: 'blob:shared', volume: .24, paused: false };
  const audioCalls = [];
  const primaryAudio = new Proxy(audioValues, { set(target, key, value) { audioCalls.push(['set', key, value]); target[key] = value; return true; } });
  const c = { $, state, cueGrid, document, Element, HTMLElement: Element, emptyState: new Element(), primaryAudio, cueDragSession: null, CSS: { escape: x => x }, Math, Number, Map, Set,
    window: { removeEventListener(k) { windowListeners.delete(k); }, setTimeout(f, ms) { timers.set(++timerId, { at: clock + ms, f }); return timerId; } },
    clearTimeout(id) { timers.delete(id); }, writes: [], audioCalls, stops: 0,
    enqueuePersistence(f) { c.writes.push(f); }, putAllCueMetadata() {}, deleteCueRecord() {}, scheduleOrphanCleanup() {}, updateCueCount() {}, refreshPlayerExportEstimate() {},
    renderPlayer() { c.renderNextCue(); }, nextCueButton: new Element('button'), formatCueClock: String, formatPreciseTime: String,
    translate: (key, v = {}) => key + (v.name ? ':' + v.name : ''),
    openCueEditor() {}, clearPlaybackSelection() { state.activeCueId = null; state.playback = 'idle'; },
    stopPlayback() { c.stops++; state.playback = 'stopped'; audioCalls.push(['stop']); },
    pausePlayback() { audioCalls.push(['pause']); }, resumePlayback() { audioCalls.push(['resume']); }, restartActiveCue() { audioCalls.push(['restart']); }, fadeStopPlayback() { audioCalls.push(['fade']); }, handleCuePress(id) { audioCalls.push(['play', id]); },
    anyDialogOpen: () => c.dialogOpen, isTypingTarget: target => target.tagName === 'INPUT', dialogOpen: false,
    makeId: () => 'copy',
  };
  vm.createContext(c);
  vm.runInContext(section('      const AppToast = (() => {', '\n\n      function applyLanguage()'), c);
  const names = ['cueForId', 'activeCue', 'cueIndex', 'reindexCues', 'nextCue', 'renderNextCue', 'normalizeShortcutValue', 'shortcutCue', 'deleteCue', 'duplicateCue', 'moveCue', 'finishCuePointerDrag', 'onCuePointerUp', 'onCuePointerCancel', 'onCuePointerMove', 'renderCues', 'cueToolButton', 'cueIconMarkup', 'statusForCue', 'cueProgress', 'cueDuration', 'cueStartTime', 'cueEndTime', 'cueRangeLabel', 'cueAudioLabel', 'formatBytes', 'escapeHtml', 'escapeAttribute'];
  if (source.includes('function onCueReorderKeydown(')) names.push('onCueReorderKeydown');
  vm.runInContext(names.map(fn).join('\n'), c);
  vm.runInContext(section("      document.addEventListener('keydown', event => {", "\n\n      window.addEventListener('pagehide'"), c);
  vm.runInContext(section("      cueGrid.addEventListener('keydown', event => {", "\n\n      enterLiveModeButton.addEventListener"), c);
  c.renderCues();
  c.handle = id => cueGrid.children.find(card => card.dataset.cueId === id)?.querySelector('.cue-drag-handle');
  c.event = (key, target, extra = {}) => ({ key, target, currentTarget: target, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra });
  c.key = (id, key, extra = {}) => {
    const handle = c.handle(id); assert.ok(handle, `rendered handle for ${id}`); handle.focus();
    const event = c.event(key, handle, extra);
    handle.listeners.get('keydown')?.(event); cueGrid.listeners.get('keydown')?.(event); document.listeners.get('keydown')?.(event);
    return event;
  };
  c.drag = (id, insertIndex) => {
    const card = cueGrid.children.find(card => card.dataset.cueId === id), ghost = new Element(), placeholder = new Element();
    document.body.append(ghost); cueGrid.append(placeholder); card.classList.add('is-drag-source'); document.body.classList.add('cue-drag-active');
    state.dragCueId = id; c.cueDragSession = { cueId: id, insertIndex, pointerId: 1, card, ghost, placeholder };
    for (const kind of ['pointermove', 'pointerup', 'pointercancel']) windowListeners.set(kind, true);
    return { ghost, placeholder, card };
  };
  c.escape = (extra = {}) => { const e = c.event('Escape', document.activeElement || document.body, extra); document.listeners.get('keydown')(e); return e; };
  c.release = () => c.onCuePointerUp(c.event('', document.body, { pointerId: 1 }));
  c.tick = ms => { clock += ms; for (const [id, t] of [...timers]) if (t.at <= clock) { timers.delete(id); t.f(); } };
  c.undo = () => $('#appToastAction').listeners.get('click')();
  c.order = () => state.cues.map(cue => cue.id).join(',');
  c.windowListeners = windowListeners;
  return c;
}
for (const playback of ['idle', 'playing', 'paused', 'stopped', 'ended', 'fading']) {
  test(`focused handle moves in both directions, preserving identity/settings/audio (${playback})`, () => {
    const h = fixture(); h.state.playback = playback; h.state.activeCueId = playback === 'idle' ? null : 'c0';
    const objects = [...h.state.cues], settings = objects.map(cue => ({ ...cue })), asset = h.state.assets.get('shared');
    const board = { boardName: h.state.boardName, masterVolume: h.state.masterVolume };
    assert.equal(h.key('c2', 'ArrowUp').defaultPrevented, true); assert.equal(h.order(), 'c0,c2,c1');
    assert.equal(h.document.activeElement, h.handle('c2')); assert.equal(h.writes.length, 1);
    assert.equal(h.nextCue().id, playback === 'idle' ? 'c0' : 'c2');
    h.key('c2', 'ArrowUp'); assert.equal(h.order(), 'c2,c0,c1'); h.key('c2', 'ArrowDown'); assert.equal(h.order(), 'c0,c2,c1');
    h.state.cues.forEach((cue, i) => { assert.equal(cue.order, i); const original = objects.find(x => x.id === cue.id); assert.equal(cue, original); assert.deepEqual({ ...cue, order: settings.find(x => x.id === cue.id).order }, settings.find(x => x.id === cue.id)); });
    assert.equal(h.state.assets.get('shared'), asset); assert.deepEqual(h.audioCalls, []);
    assert.equal(h.state.playback, playback); assert.equal(h.state.activeCueId, playback === 'idle' ? null : 'c0');
    assert.deepEqual({ boardName: h.state.boardName, masterVolume: h.state.masterVolume }, board);
    assert.ok(h.writes.every(f => f === h.putAllCueMetadata));
  });
}
test('first/last and single-cue arrows are no-ops without wrap, writes or toast changes', () => {
  for (const count of [1, 3]) {
    const h = fixture(count); h.window.AppToast.show({ message: 'Keep toast', duration: 6000 });
    h.key('c0', 'ArrowUp'); h.key(`c${count - 1}`, 'ArrowDown');
    assert.equal(h.order(), Array.from({ length: count }, (_, i) => `c${i}`).join(','));
    assert.equal(h.writes.length, 0); assert.equal(h.$('#appToastMessage').textContent, 'Keep toast'); assert.deepEqual(h.audioCalls, []);
  }
  const h = fixture(0); h.moveCue('missing', 1); assert.equal(h.writes.length, 0); assert.equal(h.cueGrid.hidden, true);
});
for (const extra of [{ isComposing: true }, { keyCode: 229 }, { repeat: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { defaultPrevented: true }]) {
  test(`reorder ignores guarded keyboard event ${JSON.stringify(extra)}`, () => { const h = fixture(); h.key('c1', 'ArrowUp', extra); assert.equal(h.order(), 'c0,c1,c2'); assert.equal(h.writes.length, 0); assert.deepEqual(h.audioCalls, []); });
}
for (const boundary of ['liveMode', 'dialog', 'drag']) test(`reorder ignores ${boundary} boundary`, () => {
  const h = fixture(); if (boundary === 'liveMode') h.state.liveMode = true; if (boundary === 'dialog') h.dialogOpen = true; if (boundary === 'drag') h.drag('c2', 0);
  h.key('c1', 'ArrowUp'); assert.equal(h.order(), 'c0,c1,c2'); assert.equal(h.writes.length, 0); assert.deepEqual(h.audioCalls, []);
});
test('handle retains native control and localized accessible guidance; unrelated keys do not reorder', () => {
  const h = fixture(), handle = h.handle('c1');
  assert.equal(handle.tagName, 'BUTTON'); assert.equal(handle.type, 'button'); assert.equal(handle.getAttribute('aria-describedby'), 'reorderHint');
  assert.equal(handle.getAttribute('aria-keyshortcuts'), 'ArrowUp ArrowDown');
  for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' ']) h.key('c1', key);
  assert.equal(h.order(), 'c0,c1,c2'); assert.equal(h.writes.length, 0); assert.deepEqual(h.audioCalls, []);
  assert.match(source, /reorderHint: '[^']*↑[^']*↓/); assert.match(source, /reorderHint: '[^']*ArrowUp[^']*ArrowDown/);
  assert.equal(h.cueGrid.querySelectorAll('.cue-tool-button').length, 12, 'no extra up/down buttons');
});
test('cue-play arrows and Home/End still navigate without editing the board', () => {
  const h = fixture(); const buttons = h.cueGrid.querySelectorAll('.cue-play');
  for (const [key, target] of [['ArrowDown', 1], ['End', 2], ['Home', 0], ['ArrowUp', 2]]) {
    const active = h.document.activeElement || buttons[0]; const e = h.event(key, active); h.cueGrid.listeners.get('keydown')(e); assert.equal(h.document.activeElement, buttons[target]);
  }
  assert.equal(h.order(), 'c0,c1,c2'); assert.equal(h.writes.length, 0);
});
test('no-op pointer drop preserves Delete Undo, expiry, metadata, and cleans drag UI', () => {
  const h = fixture(); h.deleteCue('c1'); const writes = h.writes.length; h.tick(3000); const drag = h.drag('c2', 1);
  h.release(); assert.equal(h.order(), 'c0,c2'); assert.equal(h.writes.length, writes); assert.equal(h.$('#appToastAction').hidden, false);
  assert.equal(h.state.dragCueId, null); assert.equal(h.cueDragSession, null); assert.equal(drag.ghost.isConnected, false); assert.equal(drag.placeholder.isConnected, false);
  assert.equal(h.document.body.classList.contains('cue-drag-active'), false); assert.equal(h.windowListeners.size, 0);
  h.tick(2999); h.undo(); assert.equal(h.order(), 'c0,c1,c2');
  const expired = fixture(); expired.deleteCue('c1'); expired.tick(3000); expired.drag('c2', 1); expired.release(); expired.tick(3000); expired.undo(); assert.equal(expired.order(), 'c0,c2');
});
test('edge keyboard no-op preserves Delete Undo and original expiry', () => {
  const h = fixture(); h.deleteCue('c1'); h.tick(3000); h.key('c2', 'ArrowDown'); h.tick(2999); h.undo(); assert.equal(h.order(), 'c0,c1,c2');
  const expired = fixture(); expired.deleteCue('c1'); expired.tick(3000); expired.key('c2', 'ArrowDown'); expired.tick(3000); expired.undo(); assert.equal(expired.order(), 'c0,c2');
});
for (const active of [false, true]) test(`Escape cancels pending drop while retaining emergency Stop (active=${active})`, () => {
  const h = fixture(); h.deleteCue('c1'); const writes = h.writes.length; if (active) { h.state.activeCueId = 'c0'; h.state.playback = 'playing'; }
  h.drag('c2', 0); assert.equal(h.escape().defaultPrevented, true); assert.equal(h.cueDragSession, null); h.release();
  assert.equal(h.order(), 'c0,c2'); assert.equal(h.writes.length, writes); assert.equal(h.stops, active ? 1 : 0); h.undo(); assert.equal(h.order(), 'c0,c1,c2');
});
test('pointercancel remains a true cancellation; Escape outside drag still stops', () => {
  const h = fixture(); h.deleteCue('c1'); const writes = h.writes.length; h.drag('c2', 0); h.onCuePointerCancel(h.event('', h.document.body, { pointerId: 1 })); h.release();
  assert.equal(h.order(), 'c0,c2'); assert.equal(h.writes.length, writes); h.undo(); assert.equal(h.order(), 'c0,c1,c2'); h.state.activeCueId = 'c0'; h.escape(); assert.equal(h.stops, 1);
});
test('real pointer move persists exactly once without touching audio/settings and updates Next', () => {
  const h = fixture(); h.state.activeCueId = 'c0'; h.state.playback = 'playing'; const cue = h.state.cues[2], settings = { ...cue };
  h.drag('c2', 1); h.release(); assert.equal(h.order(), 'c0,c2,c1'); assert.equal(h.state.cues[1], cue); assert.deepEqual({ ...cue, order: 2 }, settings);
  assert.equal(h.writes.length, 1); assert.equal(h.nextCue().id, 'c2'); assert.equal(h.$('#appToastMessage').textContent, 'dragMoved'); assert.deepEqual(h.audioCalls, []);
});
test('duplicate then keyboard reorder preserves shared asset, clears only duplicate shortcut, and Delete Undo works', () => {
  const h = fixture(); h.state.activeCueId = 'c0'; h.duplicateCue('c2'); const copy = h.state.cues[3], original = h.state.cues[2];
  h.key('copy', 'ArrowUp'); assert.equal(h.order(), 'c0,c1,copy,c2'); assert.equal(copy.assetId, original.assetId); assert.equal(copy.shortcut, ''); assert.equal(original.shortcut, 'N');
  h.deleteCue('copy'); h.undo(); assert.equal(h.order(), 'c0,c1,copy,c2'); assert.equal(h.state.cues[2], copy); assert.deepEqual(h.audioCalls, []);
});

test('moving the selected cue retains selection, playback and final Next boundary', () => {
  const h = fixture(); h.state.activeCueId = 'c1'; h.state.playback = 'paused';
  h.key('c1', 'ArrowDown'); assert.equal(h.order(), 'c0,c2,c1'); assert.equal(h.nextCue(), null); assert.equal(h.nextCueButton.disabled, true);
  h.key('c1', 'ArrowUp'); assert.equal(h.order(), 'c0,c1,c2'); assert.equal(h.nextCue().id, 'c2');
  assert.equal(h.state.activeCueId, 'c1'); assert.equal(h.state.playback, 'paused'); assert.deepEqual(h.audioCalls, []);
});
for (const status of ['loading', 'error']) test(`reorder keeps unavailable immediate Next explicit (${status})`, () => {
  const h = fixture(); h.state.activeCueId = 'c0'; h.state.assets.set('unavailable', { status }); h.state.cues[2].assetId = 'unavailable';
  h.key('c2', 'ArrowUp'); assert.equal(h.nextCue().id, 'c2'); assert.equal(h.nextCueButton.disabled, true); assert.deepEqual(h.audioCalls, []);
});
test('unrelated pointer release cannot commit drag; Escape cancellation preserves Undo deadline', () => {
  const h = fixture(); h.deleteCue('c1'); h.tick(3000); h.drag('c2', 0); h.onCuePointerUp(h.event('', h.document.body, { pointerId: 9 }));
  assert.notEqual(h.cueDragSession, null); assert.equal(h.order(), 'c0,c2'); h.escape(); h.tick(3000); h.undo(); assert.equal(h.order(), 'c0,c2');
});
