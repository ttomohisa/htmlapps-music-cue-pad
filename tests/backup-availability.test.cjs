const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || 'src/index.template.html', 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.ok(start >= 0, 'missing runtime function: ' + name);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.indexOf('\n      }', lineEnd) + 8);
}
function fixture() {
  const state = { cues: [], backupBusy: false, boardMutationLocked: false };
  const ids = ['exportBackupButton', 'exportPlayerButton', 'importBackupButton', 'boardNameInput', 'playerFilenameInput', 'backupProgress', 'backupProgressLabel', 'backupProgressValue', 'backupProgressBar', 'cueCount', 'reorderHint'];
  const elements = Object.fromEntries(ids.map(id => [id, { id, disabled: false, hidden: false, textContent: '', value: '' }]));
  const context = vm.createContext({
    state, ...elements, $: id => elements[id], translate: (key, params) => key + ':' + (params?.count ?? ''),
    renderLiveModeUi() {},
  });
  vm.runInContext(['refreshBackupActionAvailability','setBackupBusy','updateCueCount'].map(fn).join('\n'), context);
  return { state, elements, context };
}
function assertExportState(h, expected, label) {
  assert.equal(h.elements.exportPlayerButton.disabled, expected, label + ' playback HTML');
  assert.equal(h.elements.exportBackupButton.disabled, expected, label + ' .bkcue');
}

test('empty board blocks exports, adding a cue re-enables both without another export operation', () => {
  const h = fixture();
  h.context.setBackupBusy(false);
  assertExportState(h, true, 'empty');
  assert.equal(h.elements.importBackupButton.disabled, false, 'import remains available on empty board');
  h.state.cues.push({ id:'cue1' });
  h.context.updateCueCount();
  assertExportState(h, false, 'after adding a cue');
  assert.equal(h.elements.cueCount.textContent, 'cueCount:1');
});

test('deleting the last cue disables exports and re-adding audio restores both actions', () => {
  const h = fixture();
  h.state.cues.push({id:'first'});
  h.context.updateCueCount();
  assertExportState(h, false, 'after initial import');
  h.state.cues.pop();
  h.context.updateCueCount();
  assertExportState(h, true, 'after deleting all cues');
  h.state.cues.push({id:'second'});
  h.context.updateCueCount();
  assertExportState(h, false, 'after importing again');
});

test('busy and restore/reset locks take precedence even if cues are added mid-operation', () => {
  const h = fixture();
  h.state.cues.push({ id:'first' });
  h.context.updateCueCount();
  h.context.setBackupBusy(true, 'encoding', 40);
  assertExportState(h, true, 'during export');
  assert.equal(h.elements.importBackupButton.disabled, true);
  h.state.cues.push({ id:'second' });
  h.context.updateCueCount();
  assertExportState(h, true, 'new cue cannot bypass the busy lock');
  h.context.setBackupBusy(false);
  assertExportState(h, false, 'after export finishes');

  h.state.boardMutationLocked = true;
  h.context.refreshBackupActionAvailability();
  assertExportState(h, true, 'during reset/restore');
  assert.equal(h.elements.importBackupButton.disabled, true);
  h.state.boardMutationLocked = false;
  h.context.refreshBackupActionAvailability();
  assertExportState(h, false, 'after reset/restore');
  assert.equal(h.elements.playerFilenameInput.disabled, false);
});

test('loading cues keep export button enabled, with incomplete audio rejected by export preflight', () => {
  const h = fixture();
  h.state.cues.push({id:'importing'});
  h.context.updateCueCount();
  assertExportState(h, false, 'cue exists; actual asset readiness is checked on export');
});
