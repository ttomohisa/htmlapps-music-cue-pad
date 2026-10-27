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
 vm.runInContext(fn('backupLabel')+'\n'+fn('importBoardBackup'),c);await c.importBoardBackup(new Blob(['backup']));
 assert.ok(cancelled.includes(11));assert.ok(cancelled.includes(22));assert.equal(c.persistenceGeneration,1);
});
test('orphan cleanup retains an audio asset while its genuine Undo is available',async()=>{
 let opened=0;const c=vm.createContext({state:{cues:[],undoAssetId:'audio',assets:new Map([['audio',{id:'audio'}]])},openPersistenceDb:async()=>{opened++;return {transaction:()=>({objectStore:()=>({delete(){}})})}},transactionToPromise:async()=>{},blobUrls:new Set()});
 vm.runInContext(fn('cleanupOrphanAssets'),c);await c.cleanupOrphanAssets();
 assert.equal(opened,0);assert.equal(c.state.assets.has('audio'),true);
});
