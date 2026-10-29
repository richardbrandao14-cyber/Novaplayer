const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
function setup(){
 let now=0,next=1,time=0,writes=0;const timers=new Map(),events={},observed={done:0,failed:0,plays:0};
 const later=(fn,delay)=>{const id=next++;timers.set(id,{at:now+delay,fn});return id;};
 const video={readyState:0,duration:NaN,seeking:false,paused:false,acceptAfter:0,seekable:{length:0},addEventListener:(type,fn)=>{(events[type]||(events[type]=[])).push(fn);},pause(){this.paused=true;},play(){this.paused=false;observed.plays++;}};
 function emit(type){(events[type]||[]).forEach(fn=>fn({type}));}
 Object.defineProperty(video,'currentTime',{get:()=>time,set(value){writes++;if(writes<=video.acceptAfter)return;time=value;video.seeking=true;later(()=>{video.seeking=false;emit('seeked');},20);}});
 const context={window:{},Date:{now:()=>now},setTimeout:later,clearTimeout:id=>timers.delete(id)};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/resume.js'),'utf8'),context);
 const controller=context.window.NexResume(video,{done:()=>observed.done++,failed:()=>observed.failed++,message:()=>{}});
 function advance(ms){const end=now+ms;for(let turns=0;turns<1000;turns++){const pending=Array.from(timers.entries()).sort((a,b)=>a[1].at-b[1].at)[0];if(!pending||pending[1].at>end)break;now=pending[1].at;timers.delete(pending[0]);pending[1].fn();}now=end;}
 return {video,controller,emit,advance,observed,writes:()=>writes,timers};
}
test('retomada aguarda duração e tenta novamente quando o decoder ignora seek inicial',()=>{
 const s=setup();s.controller.begin(120);s.emit('loadedmetadata');s.emit('playing');s.advance(2000);assert.equal(s.writes(),0);assert.equal(s.video.paused,true);assert.equal(s.controller.blocksProgress(),true);
 s.video.readyState=1;s.video.duration=600;s.video.acceptAfter=2;s.emit('durationchange');s.advance(3500);
 assert.equal(s.video.currentTime,120);assert.equal(s.writes(),3);assert.equal(s.observed.done,1);assert.equal(s.controller.blocksProgress(),false);assert.equal(s.observed.plays,1);
});
test('sem seek disponível falha visível preserva progresso e permite nova tentativa',()=>{
 const s=setup();s.controller.begin(90);s.advance(20001);assert.equal(s.observed.failed,1);assert.equal(s.controller.failed(),true);assert.equal(s.controller.blocksProgress(),true);assert.equal(s.video.paused,true);assert.equal(s.observed.plays,0);
 s.video.readyState=1;s.video.duration=300;s.controller.retry();s.advance(50);assert.equal(s.video.currentTime,90);assert.equal(s.observed.done,1);assert.equal(s.controller.blocksProgress(),false);
 s.controller.begin(180);s.controller.cancel();const writes=s.writes();s.advance(30000);assert.equal(s.writes(),writes);assert.equal(s.controller.blocksProgress(),false);
});
test('confirmação depende do seek real, respeita pausa e rejeita posição fora da duração',()=>{
 const s=setup();s.video.readyState=1;s.video.duration=300;s.controller.begin(40);s.controller.toggle();s.advance(0);assert.equal(s.observed.done,0);assert.equal(s.controller.blocksProgress(),true);s.advance(25);assert.equal(s.observed.done,1);assert.equal(s.observed.plays,0);
 s.controller.begin(400);s.advance(1);assert.equal(s.controller.failed(),true);assert.equal(s.controller.blocksProgress(),true);assert.equal(s.observed.failed,1);
});
