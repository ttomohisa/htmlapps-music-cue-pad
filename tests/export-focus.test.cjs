// Execute the real export/busy functions, encoders and builders. The DOM models
// native focus loss on disabling a button; browser Tab/download QA is separate.
// Removing export focus restoration or any ownership guard must fail here.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || path.join(__dirname, '../src/index.template.html'), 'utf8');

function runtimeFunction(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, `runtime function ${name} exists`);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.slice(start, lineEnd).trimEnd().endsWith('}') ? lineEnd : source.indexOf('\n      }', lineEnd) + 8);
}

function fixture(kind, fail = false) {
  const timers = [], errors = [], downloads = [], listeners = new Map();
  const document = {
    activeElement: null, modal: false,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    querySelector(selector) { return selector === 'dialog[open]' && this.modal ? {} : null; }
  };
  function element(id) {
    return {
      id, isConnected: true, hidden: false, visibility: 'visible', value: 'focus-test-player', focusCalls: [],
      set disabled(value) { this.isDisabled = value; if (value && document.activeElement === this) document.activeElement = document.body; },
      get disabled() { return Boolean(this.isDisabled); },
      getClientRects() { return this.isConnected && !this.hidden ? [{}] : []; },
      focus(options) {
        document.activeElement = this; this.focusCalls.push(options);
        for (const fn of listeners.get('focusin') || []) fn({ target: this });
      }
    };
  }
  document.body = element('body'); document.documentElement = element('html');
  const names = ['exportBackupButton', 'exportPlayerButton', 'importBackupButton', 'boardNameInput', 'playerFilenameInput', 'backupProgress', 'backupProgressLabel', 'backupProgressBar', 'backupProgressValue', 'backupFileInput'];
  const elements = Object.fromEntries(names.map(name => [name, element(name)]));
  const opener = elements[kind === 'backup' ? 'exportBackupButton' : 'exportPlayerButton'];
  const state = { cues: [{ id: 'cue', assetId: 'asset', name: 'Synthetic cue', volume: 1 }], assets: new Map([['asset', { id: 'asset', fileName: 'synthetic.wav', status: 'ready', duration: 1, blob: new Blob(['synthetic audio']) }]]), boardName: 'Focus test', masterVolume: 1, persistence: { supported: false }, backupBusy: false };
  const context = vm.createContext({ ...elements, document, state, Blob, TextEncoder, btoa, language: 'en',
    APP_CONFIG: { version: '1.0.2' }, BOARD_SCHEMA_VERSION: 1,
    outputFilenameRules: { extension: '.html', fallback: 'music-cue-pad-player' },
    translate: key => key, showToast() {}, console: { error: (...args) => errors.push(args.at(-1)) },
    cueRecord: cue => ({ ...cue }),
    getComputedStyle: node => ({ visibility: node.visibility }),
    setTimeout(fn, delay) { if (delay === 0) queueMicrotask(fn); else timers.push({ fn, delay }); },
    // Download and import persistence are external boundaries, not focus logic.
    downloadBlob(blob, filename) { if (fail) throw new Error('synthetic export failure'); downloads.push({ blob, filename }); },
    parseBoardBackup: async () => ({ boardName: 'Imported' }), AppConfirm: { ask: async () => true },
    persistenceWriteChain: Promise.resolve(), applyImportedSnapshot() {},
  });
  const functions = ['setBackupBusy', 'safeBackupBaseName', 'safePlayerBaseName', 'blobToBase64', 'fileExtension', 'escapeHtml', 'exportPlaybackHtml', 'anyDialogOpen', 'importBoardBackup'];
  if (source.includes('      function captureExportFocus(')) functions.push('captureExportFocus');
  const playerBuilder = source.slice(source.indexOf('      function playerExportDocument('), source.indexOf('      async function exportPlaybackHtml('));
  const backupBuilder = source.slice(source.indexOf('      const crc32Table = '), source.indexOf('      async function readZipDirectory('));
  vm.runInContext(functions.map(runtimeFunction).join('\n') + '\n' + playerBuilder + '\n' + backupBuilder + '\nconst PLAYER_EXPORT_WARN_BYTES = 100 * 1024 * 1024; const PLAYER_EXPORT_MAX_BYTES = 250 * 1024 * 1024;', context);
  opener.focus(); opener.focusCalls.length = 0;
  return { ...elements, document, state, context, opener, errors, downloads, timers, listeners, element,
    run: () => kind === 'backup' ? context.exportBoardBackup() : context.exportPlaybackHtml(),
    release() { assert.equal(timers.length, 1); assert.equal(timers[0].delay, 250, 'preserve the existing busy-release delay'); timers.shift().fn(); }
  };
}

for (const kind of ['backup', 'player']) {
  for (const fail of [false, true]) {
    test(`${kind}: ${fail ? 'failed' : 'successful'} export returns keyboard focus after the existing busy delay`, async () => {
      const h = fixture(kind, fail);
      await h.run();
      assert.equal(h.document.activeElement, h.document.body);
      assert.equal(h.opener.disabled, true);
      assert.equal(h.errors.length, fail ? 1 : 0);
      if (fail) assert.equal(h.errors[0].message, 'synthetic export failure');
      else assert.equal(h.downloads.length, 1);
      h.release();
      assert.equal(h.opener.disabled, false);
      assert.equal(h.document.activeElement, h.opener);
      assert.equal(h.opener.focusCalls.length, 1);
      assert.equal(h.opener.focusCalls[0]?.preventScroll, true);
      assert.equal(h.listeners.get('focusin')?.size || 0, 0, 'temporary ownership listener is removed');
    });
  }

  for (const change of ['new focus', 'focus then body', 'open modal', 'hidden', 'invisible', 'disconnected', 'empty board']) {
    test(`${kind}: export does not steal focus after ${change}`, async () => {
      const h = fixture(kind);
      const pending = h.run();
      const newer = h.element('newer-control');
      if (change === 'new focus' || change === 'focus then body') newer.focus();
      if (change === 'focus then body') h.document.activeElement = h.document.body;
      if (change === 'open modal') h.document.modal = true;
      if (change === 'hidden') h.opener.hidden = true;
      if (change === 'invisible') h.opener.visibility = 'hidden';
      if (change === 'disconnected') h.opener.isConnected = false;
      await pending;
      if (change === 'empty board') h.state.cues.length = 0;
      const active = h.document.activeElement;
      h.release();
      assert.equal(h.document.activeElement, active);
      assert.equal(h.opener.focusCalls.length, 0);
      assert.equal(h.listeners.get('focusin')?.size || 0, 0);
    });
  }

  test(`${kind}: an export started without owning focus does not claim BODY focus`, async () => {
    const h = fixture(kind);
    h.document.activeElement = h.document.body;
    await h.run(); h.release();
    assert.equal(h.document.activeElement, h.document.body);
    assert.equal(h.opener.focusCalls.length, 0);
  });
}

test('backup import keeps its existing focus behavior and does not use export restoration', async () => {
  const h = fixture('backup');
  h.importBackupButton.focus(); h.importBackupButton.focusCalls.length = 0;
  await h.context.importBoardBackup(new Blob(['synthetic import']));
  h.release();
  assert.equal(h.document.activeElement, h.document.body);
  assert.equal(h.importBackupButton.focusCalls.length, 0);
  assert.equal(h.exportBackupButton.focusCalls.length, 0);
  assert.equal(h.exportPlayerButton.focusCalls.length, 0);
  assert.equal(h.listeners.get('focusin')?.size || 0, 0);
});
