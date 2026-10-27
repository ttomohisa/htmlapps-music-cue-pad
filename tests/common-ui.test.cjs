const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('src/index.template.html','utf8');
function fn(name){const start=source.search(new RegExp('^      (?:async )?function '+name+'\\(','m')),line=source.indexOf('\n',start);assert.ok(start>=0);return source.slice(start,source.slice(start,line).trimEnd().endsWith('}')?line:source.indexOf('\n      }',line)+8);}
test('invalidated queued save drains accounting and never writes after replacement',async()=>{
 let release;const previous=new Promise(r=>release=r);let writes=0;
 const c=vm.createContext({state:{persistence:{supported:true,ready:true,saving:false,errorType:''}},persistenceGeneration:0,persistencePendingWrites:0,persistenceWriteChain:previous,renderStorageStatus(){},refreshStorageEstimate(){},markPersistenceError(){}});
 vm.runInContext(fn('enqueuePersistence'),c);
 const pending=c.enqueuePersistence(async()=>{writes++});c.persistenceGeneration++;release();await pending;
 assert.equal(writes,0);assert.equal(c.persistencePendingWrites,0);assert.equal(c.state.persistence.saving,false);
});
test('backup restore cancels delayed volume and cleanup before waiting for queued writes',async()=>{
 const cancelled=[],c=vm.createContext({state:{backupBusy:false,persistence:{supported:false,ready:true}},translate:k=>k,setBackupBusy(){},renderBoardMutationState(){},parseBoardBackup:async()=>({boardName:'Imported'}),AppConfirm:{ask:async()=>true},persistenceWriteChain:Promise.resolve(),persistenceGeneration:0,masterVolumeSaveTimer:11,orphanCleanupTimer:22,clearTimeout:id=>cancelled.push(id),applyImportedSnapshot(){},showToast(){},setTimeout(){},backupFileInput:{value:''},console});
 c.renderDeliveryStatus=()=>{};vm.runInContext(fn('backupLabel')+'\n'+fn('importBoardBackup'),c);await c.importBoardBackup(new Blob(['backup']));
 assert.ok(cancelled.includes(11));assert.ok(cancelled.includes(22));assert.equal(c.persistenceGeneration,1);
});
test('orphan cleanup retains an audio asset while its genuine Undo is available',async()=>{
 let opened=0;const c=vm.createContext({state:{cues:[],undoAssetId:'audio',assets:new Map([['audio',{id:'audio'}]])},openPersistenceDb:async()=>{opened++;return {transaction:()=>({objectStore:()=>({delete(){}})})}},transactionToPromise:async()=>{},blobUrls:new Set()});
 vm.runInContext(fn('cleanupOrphanAssets'),c);await c.cleanupOrphanAssets();
 assert.equal(opened,0);assert.equal(c.state.assets.has('audio'),true);
});
for(const phase of ['validation','storage'])test(`restore ${phase} failure has persistent keyed recovery and preserves old board`,async()=>{
 const old={id:'old'},state={cues:[old],persistence:{supported:true,ready:true,errorType:''}},nodes=new Map(),$=key=>{if(!nodes.has(key))nodes.set(key,{textContent:''});return nodes.get(key)};
 const c=vm.createContext({state,$,language:'en',translate:key=>c.language+':'+key,setBackupBusy:busy=>state.backupBusy=busy,renderBoardMutationState(){},parseBoardBackup:async()=>{if(phase==='validation')throw Error('bad');return {boardName:'new'}},persistImportedSnapshot:async()=>{throw Error('quota')},applyImportedSnapshot(){throw Error('must not replace')},AppConfirm:{ask:async()=>true},clearTimeout(){},setTimeout:f=>f(),masterVolumeSaveTimer:0,orphanCleanupTimer:0,persistenceGeneration:0,persistenceWriteChain:Promise.resolve(),backupFileInput:{},showToast(){},console:{error(){}}});
 vm.runInContext(fn('backupLabel')+'\n'+fn('renderDeliveryStatus')+'\n'+fn('importBoardBackup'),c);await c.importBoardBackup(new Blob(['backup']));
 assert.equal(state.cues[0],old);assert.equal(state.restoreErrorKey,phase==='validation'?'restoreValidationFailed':'restoreSaveFailed');assert.match($('#restoreBackupError').textContent,/en:restore/);c.language='ja';c.renderDeliveryStatus();assert.match($('#restoreBackupError').textContent,/ja:restore/);assert.equal(state.persistence.errorType,'');
});
test('successful restore clears only restore failure while preserving delivery failures',async()=>{
 const state={cues:[],restoreErrorKey:'restoreSaveFailed',backupDeliveryError:true,playerDeliveryError:true,persistence:{supported:true,ready:true}},c=vm.createContext({state,language:'en',translate:k=>k,setBackupBusy:busy=>state.backupBusy=busy,renderDeliveryStatus(){},renderBoardMutationState(){},parseBoardBackup:async()=>({boardName:'new'}),persistImportedSnapshot:async()=>{},applyImportedSnapshot:s=>state.cues.push(s),AppConfirm:{ask:async()=>true},clearTimeout(){},setTimeout:f=>f(),masterVolumeSaveTimer:0,orphanCleanupTimer:0,persistenceGeneration:0,persistenceWriteChain:Promise.resolve(),backupFileInput:{},showToast(){},console});
 vm.runInContext(fn('backupLabel')+'\n'+fn('importBoardBackup'),c);await c.importBoardBackup(new Blob(['backup']));assert.equal(state.restoreErrorKey,'');assert.equal(state.backupDeliveryError,true);assert.equal(state.playerDeliveryError,true);assert.equal(state.cues.length,1);
});
test('actual download handoff cleans its anchor and Blob URL after a blocked click',()=>{
 let attached=false,removed=0,revoked=[],timers=[];const anchor={click(){throw Error('blocked')},remove(){attached=false;removed++}},c=vm.createContext({URL:{createObjectURL:()=> 'blob:music',revokeObjectURL:url=>revoked.push(url)},document:{createElement:()=>anchor,body:{appendChild(){attached=true}}},setTimeout:(f,ms)=>timers.push({f,ms})});
 vm.runInContext(fn('downloadBlob'),c);assert.throws(()=>c.downloadBlob(new Blob(['original']),'edited.bkcue'),/blocked/);assert.equal(attached,false);assert.equal(removed,1);assert.equal(anchor.download,'edited.bkcue');assert.equal(timers.length,1);assert.equal(timers[0].ms,2000);timers[0].f();assert.deepEqual(revoked,['blob:music']);
});
