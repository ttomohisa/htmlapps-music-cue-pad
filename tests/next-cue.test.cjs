const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(process.env.MUSIC_CUE_SOURCE || 'src/index.template.html', 'utf8');
function fn(name) {
  const start = source.search(new RegExp('^      (?:async )?function ' + name + '\\(', 'm'));
  assert.notEqual(start, -1, `runtime function ${name} exists`);
  const lineEnd = source.indexOf('\n', start);
  return source.slice(start, source.slice(start, lineEnd).trimEnd().endsWith('}') ? lineEnd : source.indexOf('\n      }', lineEnd) + 8);
}
function deferred() { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; }
class AudioStub {
  constructor() { this.listeners = new Map(); this.src=''; this.currentTime=0; this.readyState=1; this.paused=true; this.ended=false; this.plays=[]; this.pending=[]; this.volume=1; }
  addEventListener(k, fn) { if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(fn); }
  removeEventListener(k, fn) { this.listeners.get(k)?.delete(fn); }
  fire(k) { for(const fn of [...(this.listeners.get(k)||[])])fn(); }
  load() {} removeAttribute() { this.src=''; }
  play() { this.paused=false;this.plays.push(this.src);this.fire('play'); return this.pending.shift()?.promise || Promise.resolve(); }
  pause() {this.paused=true;this.fire('pause');}
}
function element() { return {hidden:false,disabled:false,textContent:'',value:0,attrs:{},children:[],dataset:{},classList:{toggle(){},remove(){}},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k]},querySelector(){return null},querySelectorAll(){return []}}; }
function fixture(count=3) {
 const audio=new AudioStub(), elements=new Map(), frames=new Map(); let frameId=0;
 const state={cues:Array.from({length:count},(_,i)=>({id:`c${i}`,assetId:`a${i}`,name:`Cue ${i+1}`,order:i,startTime:2,endTime:8,volume:.6,fadeIn:1,fadeOut:1,loop:false})),assets:new Map(),activeCueId:null,playback:'idle',masterVolume:1};
 state.cues.forEach(c=>state.assets.set(c.assetId,{id:c.assetId,status:'ready',duration:10,url:`blob:${c.assetId}`}));
 const $=key=>{if(!elements.has(key))elements.set(key,element());return elements.get(key)};
 const context={state,primaryAudio:audio,editPreviewAudio:new AudioStub(),playbackGeneration:0,playbackRequested:false,playbackAbortController:null,playbackBoundaryFrame:0,AbortController,DOMException,Number,Math,Map,Set,Promise,CSS:{escape:x=>x},document:{body:element(),querySelectorAll:()=>[]},$,cueGrid:element(),playerBar:$('#playerBar'),pauseResumeButton:$('#pauseResumeButton'),timelineSlider:$('#timelineSlider'),nextCueButton:$('#nextCueButton'),cancelManualFade(){},ensureAudioGraph:async()=>{},applyAutomaticGain(){},renderLiveModeUi(){},translate:(k,v={})=>k+(v.name?':'+v.name:''),formatCueClock:String,isEndingSoon:()=>false,updateCueCount(){},enqueuePersistence(){},putAllCueMetadata(){},deleteCueRecord(){},scheduleOrphanCleanup(){},makeId:()=>`copy${state.cues.length}`,showToast:(text,options)=>context.toast={text,options},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId},cancelAnimationFrame:id=>frames.delete(id)};
 vm.createContext(context);
 const names=['cueForId','activeCue','activeAsset','cueStartTime','cueEndTime','cueDuration','cueIndex','reindexCues','nextCue','renderNextCue','playNextCue','invalidatePlayback','isCurrentPlayback','clearPlaybackSelection','waitForMetadata','stopBoundaryMonitor','monitorPlaybackBoundary','preparePrimaryCue','handleCuePress','resumePlayback','pausePlayback','stopPlayback','duplicateCue','deleteCue','moveCue','reorderCue','renderPlayer'];
 vm.runInContext(names.map(fn).join('\n'),context);
 context.renderCues=()=>context.renderPlayer();
 const events=source.slice(source.indexOf("      primaryAudio.addEventListener('play'"),source.indexOf("\n\n\n      cueGrid.addEventListener('keydown'"));
 vm.runInContext(events,context);
 return Object.assign(context,{audio,elements,frames,flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}});
}
for(const count of [0,1,3])test(`next is manual, ordered, and never wraps (${count} cues)`,async()=>{
 const h=fixture(count);h.renderPlayer();assert.equal(h.audio.plays.length,0);assert.equal(h.nextCue()?.id,count?'c0':undefined);
 for(let i=0;i<count;i++){await h.playNextCue();assert.equal(h.state.activeCueId,`c${i}`);assert.equal(h.audio.currentTime,2);}
 assert.equal(h.nextCue(),null);assert.equal(h.$('#nextCueButton').disabled,true);const n=h.audio.plays.length;await h.playNextCue();assert.equal(h.audio.plays.length,n);
});
for(const status of ['paused','stopped','ended','playing'])test(`next advances from ${status} including looping cues`,async()=>{
 const h=fixture();await h.playNextCue();h.state.playback=status;h.state.cues[0].loop=true;await h.playNextCue();assert.equal(h.state.activeCueId,'c1');assert.equal(h.audio.src,'blob:a1');
});
for(const status of ['loading','error'])test(`next explains ${status}, does not skip or interrupt`,async()=>{
 const h=fixture();await h.playNextCue();h.state.assets.get('a1').status=status;h.renderPlayer();assert.equal(h.$('#nextCueButton').disabled,true);assert.match(h.$('#nextCueName').textContent,/Cue 2/);await h.playNextCue();assert.equal(h.state.activeCueId,'c0');assert.equal(h.audio.plays.length,1);
});
test('duplicate, reorder, delete and Undo recompute from cue identity',async()=>{
 const h=fixture();await h.playNextCue();h.duplicateCue('c0');assert.match(h.nextCue().id,/copy/);h.reorderCue('c2','c0',true);assert.equal(h.nextCue().id,'c2');h.deleteCue('c2');assert.match(h.nextCue().id,/copy/);h.deleteCue('c0');assert.equal(h.state.activeCueId,null);assert.match(h.nextCue().id,/copy/);h.toast.options.onAction();assert.equal(h.state.activeCueId,'c0');assert.equal(h.state.playback,'stopped');assert.equal(h.audio.paused,true);
});
test('rapid next selects sequential cues before asynchronous audio graph resumes',async()=>{
 const h=fixture(), d=deferred();h.ensureAudioGraph=()=>d.promise;const a=h.playNextCue(),b=h.playNextCue();assert.equal(h.state.activeCueId,'c1');d.resolve();await Promise.all([a,b]);assert.deepEqual(h.audio.plays,['blob:a1']);
});
test('Stop cancels next awaiting audio graph and keeps its cursor',async()=>{
 const h=fixture(),d=deferred();h.ensureAudioGraph=()=>d.promise;const p=h.playNextCue();h.stopPlayback();d.resolve();await p;assert.equal(h.audio.plays.length,0);assert.equal(h.state.playback,'stopped');assert.equal(h.nextCue().id,'c1');
});
test('metadata from superseded selection cannot seek or play old audio',async()=>{
 const h=fixture();h.audio.readyState=0;const a=h.playNextCue();await h.flush();const b=h.handleCuePress('c2');await h.flush();h.audio.readyState=1;h.audio.fire('loadedmetadata');await Promise.all([a,b]);assert.deepEqual(h.audio.plays,['blob:a2']);assert.equal(h.state.activeCueId,'c2');
});
test('Stop cancels metadata wait and removes listeners',async()=>{
 const h=fixture();h.audio.readyState=0;const p=h.playNextCue();await h.flush();h.stopPlayback();await p;assert.equal(h.audio.listeners.get('loadedmetadata').size,0);h.audio.fire('loadedmetadata');assert.equal(h.audio.plays.length,0);
});
test('late play completion after Stop cannot restart or change state',async()=>{
 const h=fixture(),d=deferred();h.audio.pending.push(d);const p=h.playNextCue();await h.flush();h.stopPlayback();d.resolve();await p;assert.equal(h.state.playback,'stopped');assert.equal(h.audio.paused,true);assert.equal(h.frames.size,0);
});
test('old play rejection cannot overwrite a directly selected cue',async()=>{
 const h=fixture(),d=deferred();h.audio.pending.push(d);const p=h.playNextCue();await h.flush();await h.handleCuePress('c2');d.reject(new Error('old'));await p;assert.equal(h.state.activeCueId,'c2');assert.equal(h.state.playback,'playing');assert.equal(h.toast,undefined);
});
test('natural finish never advances; loop repeats only its cue',async()=>{
 const h=fixture();await h.playNextCue();h.audio.ended=true;h.audio.fire('ended');await h.flush();assert.equal(h.state.activeCueId,'c0');assert.equal(h.state.playback,'ended');assert.equal(h.audio.plays.length,1);h.state.cues[0].loop=true;await h.handleCuePress('c0');h.audio.fire('ended');await h.flush();assert.equal(h.state.activeCueId,'c0');assert.equal(h.audio.src,'blob:a0');
});
test('N is still a cue key and next is a keyboard-focusable native button',()=>{
 assert.match(source,/const RESERVED_SHORTCUTS = new Set\(\['R', 'F'\]\)/);assert.match(source,/<button[^>]+id="nextCueButton"[^>]+type="button"/);assert.doesNotMatch(source,/aria-keyshortcuts="N"/);
});
module.exports={fn,AudioStub,element,deferred};

test('Undo of the deleted selection cancels playback started in the meantime',async()=>{
 const h=fixture();await h.playNextCue();h.deleteCue('c0');const undo=h.toast.options.onAction;await h.playNextCue();assert.equal(h.audio.paused,false);undo();assert.equal(h.state.activeCueId,'c0');assert.equal(h.state.playback,'stopped');assert.equal(h.audio.paused,true);
});
test('deleting pending selection prevents metadata from reviving it',async()=>{
 const h=fixture();h.audio.readyState=0;const p=h.playNextCue();await h.flush();h.deleteCue('c0');await p;h.audio.fire('loadedmetadata');assert.equal(h.audio.plays.length,0);assert.equal(h.state.activeCueId,null);assert.equal(h.nextCue().id,'c1');
});
test('custom cue end stops without advancing and Stop holds selected start',async()=>{
 const h=fixture();await h.playNextCue();h.audio.currentTime=8;const tick=[...h.frames.values()].at(-1);tick();assert.equal(h.state.playback,'ended');assert.equal(h.audio.currentTime,8);assert.equal(h.state.activeCueId,'c0');h.stopPlayback();assert.equal(h.audio.currentTime,2);assert.equal(h.nextCue().id,'c1');
});
test('board replacement cancels pending audio and resets Next to imported first',async()=>{
 const h=fixture(),d=deferred();h.ensureAudioGraph=()=>d.promise;const p=h.playNextCue();
 Object.assign(h,{closeCueEditor(){},blobUrls:new Set(),URL:{revokeObjectURL(){},createObjectURL:()=> 'blob:imported'},boardNameInput:{},syncPlayerFilenameFromBoard(){},setMasterVolume(){},refreshImportStatus(){},renderStorageStatus(){},refreshStorageEstimate(){}});h.state.persistence={supported:false};
 vm.runInContext(fn('applyImportedSnapshot'),h);h.applyImportedSnapshot({assets:new Map([['new',{id:'new',status:'ready',duration:10}]]),cues:[{id:'new',assetId:'new',name:'Imported',startTime:1,endTime:5}],boardName:'Imported',masterVolume:1});d.resolve();await p;
 assert.equal(h.state.activeCueId,null);assert.equal(h.nextCue().name,'Imported');assert.equal(h.audio.plays.length,0);
});
test('actual automatic volume and fade shape stay within cue bounds',()=>{
 const h=fixture();vm.runInContext(fn('cueVolume')+'\n'+fn('fadeFactor'),h);const c=h.state.cues[0],a=h.state.assets.get(c.assetId);
 assert.equal(h.cueVolume(c),.6);assert.equal(h.fadeFactor(c,a,2),0);assert.equal(h.fadeFactor(c,a,2.5),.5);assert.equal(h.fadeFactor(c,a,4),1);assert.equal(h.fadeFactor(c,a,7.5),.5);assert.equal(h.fadeFactor(c,a,8),0);
});
test('generated readable and self-extract JavaScript parse and have no new runtime dependencies',()=>{
 for(const file of ['dist/index.html','dist/index.self-extract.html']){
  if(!fs.existsSync(file))throw new Error('Run scripts/check-repository.ps1 to build both artifacts before tests');
  const html=fs.readFileSync(file,'utf8');assert.match(html,/connect-src 'none'/);
  for(const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g))if(!/type=["'](?!text\/javascript|application\/javascript|module)/.test(m[1]))new vm.Script(m[2],{filename:file});
 }
 assert.deepEqual(JSON.parse(fs.readFileSync('dependencies.json','utf8')).dependencies,[]);
});

test('browser or OS media pause updates UI and selected cue can resume',async()=>{
 const h=fixture();await h.playNextCue();h.audio.pause();assert.equal(h.state.playback,'paused');assert.equal(h.$('#pauseResumeLabel').textContent,'resume');await h.handleCuePress('c0');assert.equal(h.state.playback,'playing');assert.equal(h.audio.paused,false);
});

test('natural end during manual fade stops a looping cue instead of restarting',async()=>{const h=fixture();await h.playNextCue();h.state.cues[0].loop=true;h.state.playback='fading';h.audio.ended=true;h.audio.fire('ended');await h.flush();assert.equal(h.state.playback,'stopped');assert.equal(h.audio.paused,true);assert.equal(h.audio.plays.length,1);});

for(const loop of [false,true])test(`natural end pause-before-ended event ordering (loop=${loop})`,async()=>{const h=fixture();await h.playNextCue();h.state.cues[0].loop=loop;h.audio.ended=true;h.audio.paused=true;h.audio.fire('pause');h.audio.fire('ended');await h.flush();assert.equal(h.state.playback,loop?'playing':'ended');assert.equal(h.audio.plays.length,loop?2:1);});
