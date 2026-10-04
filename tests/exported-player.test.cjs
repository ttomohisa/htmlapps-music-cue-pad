const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('src/index.template.html','utf8');
const start=source.indexOf('      function playerExportDocument('),end=source.indexOf('      async function exportPlaybackHtml',start);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
class Element {
 constructor(){this.children=[];this.nodes=new Map();this.listeners=new Map();this.dataset={};this.value='100';this.textContent='';this.disabled=false;this.hidden=false;this.attrs={};this.classList={toggle(){}};}
 querySelector(s){if(!this.nodes.has(s))this.nodes.set(s,new Element());return this.nodes.get(s);}
 append(el){this.children.push(el);}
 addEventListener(k,fn){this.listeners.set(k,fn);}
 click(){if(!this.disabled)return this.listeners.get('click')?.();}
 setAttribute(k,v){this.attrs[k]=v;}
}
class Audio {
 constructor(){this.listeners=new Map();this.readyState=1;this.paused=true;this.currentTime=0;this.plays=[];this.pending=[];}
 addEventListener(k,fn){if(!this.listeners.has(k))this.listeners.set(k,new Set());this.listeners.get(k).add(fn);}
 removeEventListener(k,fn){this.listeners.get(k)?.delete(fn);}
 fire(k){for(const fn of [...(this.listeners.get(k)||[])])fn();}
 pause(){this.paused=true;this.fire('pause');}
 load(){}
 play(){this.paused=false;this.plays.push(this.src);this.fire('play');return this.pending.shift()?.promise || Promise.resolve();}
}
function fixture(count=3,language='en'){
 const nodes=new Map(),$=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id)};
 const data={language,boardName:'<Cue Board>',masterVolume:1,cues:Array.from({length:count},(_,i)=>({id:`c${i}`,assetId:`a${i}`,name:`Cue ${i+1}`,startTime:2,endTime:8,volume:.6,fadeIn:1,fadeOut:1,shortcut:i===2?'N':'',loop:false})),assets:Array.from({length:count},(_,i)=>({id:`a${i}`,duration:10,src:`data:audio/wav;base64,${i}`}))};
 const context={document:{getElementById:$,querySelector:()=>null,createElement:()=>new Element(),addEventListener:(k,f)=>$('document').addEventListener(k,f)},Audio,Element,AbortController,performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},escapeHtml:s=>String(s).replace(/</g,'&lt;'),console};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);const html=context.playerExportDocument(data);$('music-cue-pad-data').textContent=JSON.stringify(data);
 const script=html.match(/<script>\(\(\)=>\{([\s\S]*?)<\/script>/)[0].replace(/^<script>/,'').replace(/<\/script>$/,'');
 vm.runInContext(script.replace(/\}\)\(\);\s*$/, ';globalThis.api={data,audio,nextCue,playNext,playCue,stopNow,finish,render,get active(){return active},get playState(){return playState}};})();'),context);
 return {api:context.api,$,html,flush:async()=>{for(let i=0;i<8;i++)await Promise.resolve();}};
}
for(const lang of ['ja','en'])test(`exported ${lang} player names next, works unselected, stops at final`,async()=>{
 const h=fixture(3,lang),a=h.api;assert.equal(a.audio.plays.length,0);assert.equal(a.nextCue().id,'c0');assert.match(h.$('nextName').textContent,/Cue 1/);
 for(let i=0;i<3;i++){await h.$('next').click();assert.equal(a.active.id,`c${i}`);assert.equal(a.audio.currentTime,2);}
 assert.equal(a.nextCue(),null);assert.equal(h.$('next').disabled,true);assert.match(h.$('nextName').textContent,lang==='en'?/End/:/最後/);
});
test('empty exported player disables next and every existing transport',()=>{const h=fixture(0);for(const id of ['next','pause','fade','stop'])assert.equal(h.$(id).disabled,true);});
test('exported next ignores unavailable immediate cue without skipping',async()=>{const h=fixture(),a=h.api;await a.playNext();a.data.assets[1].status='error';a.render();assert.equal(h.$('next').disabled,true);await a.playNext();assert.equal(a.active.id,'c0');});
test('exported rapid next and direct selection ignore stale play completion',async()=>{const h=fixture(),a=h.api,d=deferred();a.audio.pending.push(d);const p=a.playNext();await h.flush();await a.playNext();await a.playCue(a.data.cues[2]);d.resolve();await p;assert.equal(a.active.id,'c2');assert.equal(a.playState,'playing');});
test('exported Stop cancels next awaiting metadata',async()=>{const h=fixture(),a=h.api;a.audio.readyState=0;const p=a.playNext();await h.flush();a.stopNow();await p;a.audio.fire('loadedmetadata');assert.equal(a.audio.plays.length,0);assert.equal(a.playState,'stopped');});
test('exported Stop wins over pending play and late play events',async()=>{const h=fixture(),a=h.api,d=deferred();a.audio.pending.push(d);const p=a.playNext();await h.flush();a.stopNow();d.resolve();await p;a.audio.fire('play');assert.equal(a.audio.paused,true);assert.equal(a.playState,'stopped');});
test('exported finish keeps cursor and looping repeats current only',async()=>{const h=fixture(),a=h.api;await a.playNext();a.finish();assert.equal(a.active.id,'c0');assert.equal(a.playState,'ended');a.data.cues[0].loop=true;await a.playCue(a.data.cues[0]);a.finish();await h.flush();assert.equal(a.active.id,'c0');assert.equal(a.playState,'playing');});
test('exported N still triggers its assigned cue with keyboard; native buttons keep Space',async()=>{const h=fixture(),a=h.api;h.$('document').listeners.get('keydown')({key:'n',target:{tagName:'BODY'},preventDefault(){}});await h.flush();assert.equal(a.active.id,'c2');assert.doesNotMatch(h.html,/aria-keyshortcuts="N"/);});

test('exported recoverable play rejection stays retryable',async()=>{const h=fixture(),a=h.api,d=deferred();a.audio.pending.push(d);const p=a.playNext();await h.flush();d.reject(new Error('autoplay denied'));await p;assert.equal(a.playState,'error');await a.playCue(a.data.cues[0]);assert.equal(a.playState,'playing');});
test('exported volume, fades, range and loop settings are preserved',async()=>{const h=fixture(),a=h.api;await a.playNext();assert.equal(a.audio.currentTime,2);assert.equal(a.audio.volume,0);a.audio.currentTime=2.5;a.audio.fire('timeupdate');assert.equal(a.audio.volume,.3);a.audio.currentTime=7.5;a.audio.fire('timeupdate');assert.equal(a.audio.volume,.3);a.audio.currentTime=8;a.audio.fire('timeupdate');assert.equal(a.playState,'ended');assert.equal(a.active.id,'c0');});
test('exported Space on Next retains native activation instead of toggling playback',()=>{const h=fixture();let prevented=false;h.$('document').listeners.get('keydown')({key:' ',target:{tagName:'BUTTON'},preventDefault(){prevented=true}});assert.equal(prevented,false);});

test('exported Fade Stop never crosses cue End or restarts a loop',async()=>{const h=fixture(),a=h.api;await a.playNext();a.data.cues[0].loop=true;a.audio.currentTime=7.9;h.$('fade').click();a.audio.currentTime=8.1;a.audio.fire('timeupdate');assert.equal(a.audio.paused,true);assert.equal(a.audio.currentTime,2);assert.equal(a.playState,'stopped');assert.equal(a.audio.plays.length,1);});


test('exported browser pause renders paused and cue button resumes',async()=>{const h=fixture(),a=h.api;await a.playNext();a.audio.pause();assert.equal(a.playState,'paused');await h.$('grid').children[0].querySelector('button').click();await h.flush();assert.equal(a.playState,'playing');});
for(const loop of [false,true])test(`exported pause-before-ended ordering (loop=${loop})`,async()=>{const h=fixture(),a=h.api;await a.playNext();a.data.cues[0].loop=loop;a.audio.ended=true;a.audio.paused=true;a.audio.fire('pause');a.audio.fire('ended');await h.flush();assert.equal(a.playState,loop?'playing':'ended');});
