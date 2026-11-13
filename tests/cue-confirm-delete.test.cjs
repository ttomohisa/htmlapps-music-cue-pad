const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || 'src/index.template.html', 'utf8');
const start = source.indexOf('      async function requestDeleteCue(');
const end = source.indexOf('\n      function deleteCue(', start);
assert.ok(start >= 0 && end > start, 'delete confirmation runtime must exist');
const requestCode = source.slice(start, end);
assert.match(source, /remove\.addEventListener\('click', \(\) => requestDeleteCue\(cue\.id\)\)/, 'trash button must request confirmation');

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture() {
  const cue = { id: 'cue-a', assetId: 'file-a', name: 'Example' };
  const state = { boardMutationLocked: false, cues: [cue] };
  const request = deferred(), deleted = [], asked = [];
  const context = vm.createContext({
    state, persistenceGeneration: 5,
    cueForId: id => state.cues.find(item => item.id === id) || null,
    AppConfirm: { ask: options => { asked.push(options); return request.promise; } },
    translate: (key, values) => key + (values?.name ? ':' + values.name : ''),
    deleteCue: id => { deleted.push(id); state.cues = state.cues.filter(item => item.id !== id); }
  });
  vm.runInContext(requestCode, context);
  return { context, state, request, cue, deleted, asked };
}

test('Cancel leaves the cue and audio references untouched', async () => {
  const h = fixture();
  const ongoing = h.context.requestDeleteCue('cue-a');
  assert.equal(h.asked.length, 1);
  assert.equal(h.asked[0].tone, 'danger');
  assert.equal(h.asked[0].title, 'deleteCueConfirmTitle:Example');
  h.request.resolve(false);
  await ongoing;
  assert.deepEqual(h.deleted, []);
  assert.deepEqual(h.state.cues, [h.cue]);
});

test('Delete is executed only after explicit confirmation', async () => {
  const h = fixture();
  const ongoing = h.context.requestDeleteCue('cue-a');
  assert.deepEqual(h.deleted, []);
  h.request.resolve(true);
  await ongoing;
  assert.deepEqual(h.deleted, ['cue-a']);
  assert.equal(h.state.cues.length, 0);
});

for (const mutation of ['board replaced', 'cue replaced', 'board locked']) {
  test('Pending delete confirmation cannot delete after ' + mutation, async () => {
    const h = fixture();
    const ongoing = h.context.requestDeleteCue('cue-a');
    if (mutation === 'board replaced') h.context.persistenceGeneration++;
    if (mutation === 'cue replaced') h.state.cues = [{ ...h.cue }];
    if (mutation === 'board locked') h.state.boardMutationLocked = true;
    h.request.resolve(true);
    await ongoing;
    assert.deepEqual(h.deleted, []);
  });
}

test('Delete confirmation cannot open while a board transaction is locked', async () => {
  const h = fixture();
  h.state.boardMutationLocked = true;
  await h.context.requestDeleteCue('cue-a');
  assert.equal(h.asked.length, 0);
});
