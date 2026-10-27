const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),test=require('node:test');
const source=fs.readFileSync('src/index.template.html','utf8');
function fn(name){const start=source.search(new RegExp('^      (?:async )?function '+name+'\\(','m')),line=source.indexOf('\n',start);assert.ok(start>=0);return source.slice(start,source.slice(start,line).trimEnd().endsWith('}')?line:source.indexOf('\n      }',line)+8)}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
test('reset holds mutation and queue boundary through the actual clear transaction',async()=>{
 const old=deferred(),clear=deferred();let txNumber=0,tail=Promise.resolve();const persisted={assets:new Map([['a',{id:'a'}]]),cues:new Map([['c',{id:'c'}]]),settings:new Map()};
 const db={transaction(){const n=++txNumber,ops=[],tx={objectStore:name=>({clear:()=>ops.push(()=>persisted[name].clear()),put:value=>ops.push(()=>persisted[name].set(value.id||value.key,{...value}))})};tx.done=tail.then(async()=>{if(n===1)await clear.promise;ops.forEach(f=>f())});tail=tx.done;return tx}};
 const cue={id:'c',assetId:'a'},state={cues:[cue],assets:new Map([['a',{id:'a',persisted:true}]]),persistence:{supported:true,ready:true,saving:false,errorType:''}};
 const c=vm.createContext({state,language:'en',persistenceGeneration:0,persistencePendingWrites:0,persistenceWriteChain:old.promise,masterVolumeSaveTimer:0,orphanCleanupTimer:0,resetButton:{},boardNameInput:{},blobUrls:new Set(),URL:{revokeObjectURL(){}},clearTimeout(){},AppConfirm:{ask:async()=>true},translate:k=>k,showToast(){},renderBoardMutationState(){},renderStorageStatus(){},refreshStorageEstimate:async()=>{},markPersistenceError(e){throw e},openPersistenceDb:async()=>db,transactionToPromise:tx=>tx.done,cueRecord:x=>({...x}),boardRecord:()=>({key:'board'}),clearPlaybackSelection(){},syncPlayerFilenameFromBoard(){},setMasterVolume(){},updateCueCount(){},renderCues(){},renderPlayer(){},refreshImportStatus(){}});
 vm.runInContext(['enqueuePersistence','putCue','resetAllData'].map(fn).join('\n'),c);
 const reset=c.resetAllData();await new Promise(setImmediate);old.resolve();await new Promise(setImmediate);assert.equal(txNumber,1);
 const edit=c.enqueuePersistence(()=>c.putCue(cue));await new Promise(setImmediate);clear.resolve();await Promise.all([reset,edit]);
 assert.equal(state.cues.length,0);assert.equal(persisted.cues.size,0);assert.equal(txNumber,1);assert.equal(state.boardMutationLocked,false);
});
test('all editable board entry points reject mutation while replacement owns the board',async()=>{
 const state={boardMutationLocked:true,cues:[{id:'original'}],masterVolume:.5};const c=vm.createContext({state});
 for(const name of ['saveCueEditor','duplicateCue','deleteCue','moveCue','reorderCue','onCueReorderKeydown','startCuePointerDrag','openCueEditor','addFiles','setMasterVolume'])vm.runInContext(fn(name),c);
 await c.saveCueEditor();c.duplicateCue('original');c.deleteCue('original');c.moveCue('original',1);c.reorderCue('original','next');c.onCueReorderKeydown('original',{});c.startCuePointerDrag('original',{},{});c.openCueEditor('original');await c.addFiles([]);c.setMasterVolume(1);
 assert.equal(state.cues.length,1);assert.equal(state.masterVolume,.5);
});
test('restore holds queue boundary through the real atomic imported snapshot transaction',async()=>{
 const gate=deferred(),persisted={assets:new Map([['a',{id:'a'}]]),cues:new Map([['old',{id:'old'}]]),settings:new Map()};let transactions=0;
 const db={transaction(){transactions++;const ops=[],tx={objectStore:name=>({clear:()=>ops.push(()=>persisted[name].clear()),put:value=>ops.push(()=>persisted[name].set(value.id||value.key,{...value}))})};tx.done=gate.promise.then(()=>ops.forEach(f=>f()));return tx}};
 const snapshot={boardName:'Imported',masterVolume:.8,assets:new Map([['new-asset',{id:'new-asset',fileName:'new.wav',mimeType:'audio/wav',duration:1,size:3,blob:new Blob(['new'])}]]),cues:[{id:'new-cue',assetId:'new-asset'}]};
 const state={cues:[{id:'old'}],assets:new Map(),persistence:{supported:true,ready:true}},c=vm.createContext({state,language:'en',APP_CONFIG:{version:'1.0.2'},BOARD_SCHEMA_VERSION:1,persistenceGeneration:0,persistencePendingWrites:0,persistenceWriteChain:Promise.resolve(),masterVolumeSaveTimer:0,orphanCleanupTimer:0,clearTimeout(){},setTimeout:f=>f(),backupFileInput:{},setBackupBusy(busy){state.backupBusy=busy},renderBoardMutationState(){},renderDeliveryStatus(){},parseBoardBackup:async()=>snapshot,AppConfirm:{ask:async()=>true},translate:k=>k,showToast(){},openPersistenceDb:async()=>db,transactionToPromise:tx=>tx.done,cueRecord:x=>({...x}),applyImportedSnapshot:s=>{state.cues=s.cues},renderStorageStatus(){},refreshStorageEstimate(){},markPersistenceError(e){throw e},console});
 vm.runInContext(['backupLabel','enqueuePersistence','putCue','persistImportedSnapshot','importBoardBackup'].map(fn).join('\n'),c);
 const restore=c.importBoardBackup(new Blob(['backup']));await new Promise(setImmediate);assert.equal(transactions,1);
 const edit=c.enqueuePersistence(()=>c.putCue({id:'old',assetId:'a'}));gate.resolve();await Promise.all([restore,edit]);
 assert.equal(transactions,1);assert.deepEqual([...persisted.cues.keys()],['new-cue']);assert.equal(state.cues[0].id,'new-cue');assert.equal(state.boardMutationLocked,false);
});
