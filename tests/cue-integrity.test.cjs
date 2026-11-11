// Regression checks for audio/cue integrity and asynchronous browser operations.
const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || 'src/index.template.html', 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, 'Missing runtime function: ' + name);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.slice(start, lineEnd).trimEnd().endsWith('}') ? lineEnd : source.indexOf('\n      }', lineEnd) + 8);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}
function audioBlob(label) {
  const blob = new Blob([label], { type: 'audio/wav' });
  blob.name = label + '.wav';
  return blob;
}
function board() {
  const original = audioBlob('ORIGINAL');
  const cue = { id: 'cue1', assetId: 'a1', name: 'Original cue', order: 0, startTime: 0, endTime: null, loop: false, volume: 1, fadeIn: 0, fadeOut: 0, shortcut: '' };
  const asset = { id: 'a1', fileName: 'ORIGINAL.wav', mimeType: 'audio/wav', blob: original, status: 'ready', duration: 1, size: original.size };
  return { state: { cues: [cue], assets: new Map([['a1', asset]]), boardName: 'Original board', masterVolume: .75, backupBusy: false }, original, cue, asset };
}

test('backup manifest refuses an unavailable cue instead of making an unrestorable archive', () => {
  const b = board();
  const c = vm.createContext({ state: b.state, Blob, Set, Map, Date, APP_CONFIG: {version:'1.0.2'}, BOARD_SCHEMA_VERSION:1, fileExtension:()=> 'wav', translate:x=>x, cueRecord:x=>({...x}) });
  vm.runInContext(fn('backupManifest'), c);
  assert.equal(c.backupManifest().cues.length, 1);
  const missing = {id:'bad',assetId:'bad-audio',name:'Broken',order:1};
  b.state.cues.push(missing);
  b.state.assets.set('bad-audio', {id:'bad-audio',blob:audioBlob('BROKEN'),status:'error',duration:1});
  assert.equal(c.backupManifest(), null);
  b.state.assets.get('bad-audio').status = 'ready';
  b.state.assets.get('bad-audio').duration = NaN;
  assert.equal(c.backupManifest(), null);
});

function importFixture() {
  const state = {cues:[], assets:new Map(), boardMutationLocked:false};
  const inspections = [], writes = [], saved = [];
  let counter = 0;
  const context = vm.createContext({
    state, Blob, Set, Map, Promise, Number, MAX_FILE_BYTES:2**31, persistenceGeneration:0,
    looksLikeAudio:()=>true, makeId:(prefix)=>prefix+'-'+(++counter),
    URL:{createObjectURL:()=> 'blob:audio'}, blobUrls:new Set(),
    inspectMetadata(asset) { const wait=deferred(); inspections.push({asset,wait}); return wait.promise; },
    setImportStatus(){},updateCueCount(){},renderCues(){},showToast(){},translate:x=>x,
    enqueuePersistence(write){ writes.push(write); },
    putImportedCues(cues){saved.push(cues.map(cue=>cue.id));},
    audioInput:{value:'selected'}
  });
  vm.runInContext(fn('addFiles'),context);
  return {context,state,inspections,writes,saved};
}
test('late import save includes duplicated cues and excludes deleted cues', async () => {
  const h=importFixture();
  const ongoing=h.context.addFiles([audioBlob('ONE')]);
  const original=h.state.cues[0];
  h.state.cues.push({...original,id:'duplicate',name:'Copy'});
  h.inspections[0].asset.status='ready';
  h.inspections[0].asset.duration=1;
  h.inspections[0].wait.resolve(true);
  await ongoing;
  assert.equal(h.writes.length,1);
  await h.writes[0]();
  assert.deepEqual(h.saved[0],[original.id,'duplicate']);

  const d=importFixture();
  const pending=d.context.addFiles([audioBlob('TWO')]);
  d.state.cues.length=0;
  d.inspections[0].asset.status='ready';
  d.inspections[0].asset.duration=1;
  d.inspections[0].wait.resolve(true);
  await pending;
  for(const write of d.writes) await write();
  assert.deepEqual(d.saved.flat(),[]);
});

test('reset or restore generation change prevents late import writes',async()=>{
  const h=importFixture();
  const pending=h.context.addFiles([audioBlob('SLOW')]);
  h.context.persistenceGeneration++;
  h.inspections[0].asset.status='ready';
  h.inspections[0].asset.duration=1;
  h.inspections[0].wait.resolve(true);
  await pending;
  assert.equal(h.writes.length,0);
  assert.equal(h.context.audioInput.value,'');
});

test('backup uses the captured audio blob if the board changes while hashing',async()=>{
  const b=board(), hashing=deferred(), downloads=[];
  const c=vm.createContext({
    state:b.state, Blob, Map, Set, Date, TextEncoder, APP_CONFIG:{version:'1.0.2'}, BOARD_SCHEMA_VERSION:1,
    fileExtension:()=> 'wav', cueRecord:x=>({...x}), translate:x=>x, captureExportFocus:()=>()=>{},
    exportBackupButton:{}, setBackupBusy(){}, showToast(){},
    crc32Bytes:()=>0,
    crc32Blob(blob){ c.hashedBlob=blob; return hashing.promise; },
    zipDosDateTime:()=>({time:0,date:0}),
    zipLocalHeader:()=>new Uint8Array(),zipCentralHeader:()=>new Uint8Array(),zipEndRecord:()=>new Uint8Array(),
    downloadBlob:(blob,name)=>downloads.push({blob,name}),
    setTimeout:fn=>fn(),console
  });
  vm.runInContext(fn('backupManifest')+'\n'+fn('exportBoardBackup'),c);
  const exporting=c.exportBoardBackup();
  assert.strictEqual(c.hashedBlob,b.original);
  b.state.assets.set('a1',{...b.asset,blob:audioBlob('REPLACED')});
  b.state.cues.push({id:'new',assetId:'different',name:'Later'});
  hashing.resolve(0);
  await exporting;
  assert.equal(downloads.length,1);
  assert.match(await downloads[0].blob.text(),/ORIGINAL/);
  assert.doesNotMatch(await downloads[0].blob.text(),/REPLACED/);
});

test('player HTML freezes cues and settings before asynchronous encoding',async()=>{
  const b=board(), encoding=deferred(), outputs=[];
  const c=vm.createContext({
    state:b.state, Blob, Set, Map, Promise, PLAYER_EXPORT_MAX_BYTES:250*1024*1024, PLAYER_EXPORT_WARN_BYTES:100*1024*1024,
    language:'ja', APP_CONFIG:{version:'1.0.2'}, outputFilenameRules:{extension:'.html'},
    translate:x=>x, showToast(){},captureExportFocus:()=>()=>{},exportPlayerButton:{},
    setBackupBusy(){},blobToBase64:()=>encoding.promise,
    playerFilenameInput:{value:'export'},safePlayerBaseName:x=>x,
    playerExportDocument(payload){ outputs.push(payload);return '<!doctype html>'; },
    downloadBlob(){},setTimeout:fn=>fn(),console
  });
  vm.runInContext(fn('exportPlaybackHtml'),c);
  const exporting=c.exportPlaybackHtml();
  b.state.cues.push({id:'later',assetId:'new',name:'Later'});
  b.state.boardName='Changed board';b.state.masterVolume=0;
  c.language='en';
  encoding.resolve('T1JJR0lOQUw=');
  await exporting;
  assert.equal(outputs.length,1);
  assert.equal(outputs[0].cues.length,1);
  assert.equal(outputs[0].boardName,'Original board');
  assert.equal(outputs[0].masterVolume,.75);
  assert.equal(outputs[0].language,'ja');
});

test('late wake lock grant is released after user cancels',async()=>{
  const granting=deferred(),released=[];
  const state={liveMode:true,wakeLockRequested:false,wakeLockSentinel:null};
  const c=vm.createContext({
    state,navigator:{wakeLock:{request:()=>granting.promise}},wakeLockGeneration:0,
    wakeLockSupported:()=>true,renderLiveModeUi(){},showToast(){},translate:x=>x
  });
  vm.runInContext(fn('releaseWakeLock')+'\n'+fn('requestWakeLock'),c);
  const pending=c.requestWakeLock();
  await c.releaseWakeLock();
  granting.resolve({released:false,release:async()=>{released.push(true);}});
  await pending;
  assert.equal(released.length,1);
  assert.equal(state.wakeLockSentinel,null);
  assert.equal(state.wakeLockRequested,false);
});

test('late rejected wake lock does not show a failure after cancellation',async()=>{
  const granting=deferred(),toasts=[];
  const state={liveMode:true,wakeLockRequested:false,wakeLockSentinel:null};
  const c=vm.createContext({state,navigator:{wakeLock:{request:()=>granting.promise}},wakeLockGeneration:0,wakeLockSupported:()=>true,renderLiveModeUi(){},showToast:x=>toasts.push(x),translate:x=>x});
  vm.runInContext(fn('releaseWakeLock')+'\n'+fn('requestWakeLock'),c);
  const pending=c.requestWakeLock();
  await c.releaseWakeLock();
  granting.reject(new Error('user canceled'));
  await pending;
  assert.equal(toasts.length,0);
});
