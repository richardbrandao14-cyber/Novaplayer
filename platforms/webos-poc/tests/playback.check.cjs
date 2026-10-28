const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom'); // Ferramenta de QA já usada pelo repositório, não embarcada na TV.
function setup(t){
 t.mock.timers.enable({apis:['setTimeout','setInterval']});
 const dom=new JSDOM(fs.readFileSync(path.join(__dirname,'../app/index.html'),'utf8'),{url:'https://fixture.invalid',pretendToBeVisual:true});
 const video=dom.window.document.getElementById('video'),audio=[{label:'Português',enabled:true},{label:'English',enabled:false}],subtitles=[{label:'Português',mode:'disabled'}];
 let plays=0;
 Object.defineProperties(video,{paused:{value:false,writable:true},readyState:{value:1},audioTracks:{value:audio},textTracks:{value:subtitles}});
 video.pause=()=>{video.paused=true;};video.load=()=>{};video.play=()=>{plays++;video.paused=false;return Promise.resolve();};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/playback.js'),'utf8'),{window:dom.window,document:dom.window.document,setTimeout,clearTimeout,setInterval,clearInterval,Promise,Date});
 const engine=dom.window.NexPlayback(video,{activity(){},autoNext:()=>true,request(){}});
 t.after(()=>{engine.stop();dom.window.close();});
 return{engine,video,audio,subtitles,doc:dom.window.document,window:dom.window,plays:()=>plays};
}
test('falha de rede tenta reconectar três vezes e parar cancela temporizadores',t=>{
 const f=setup(t);f.engine.start({kind:'live',url:'https://fixture.invalid/channel',epgUrl:''});
 for(const ms of [1000,2000,4000]){assert.equal(f.engine.error(2),true);t.mock.timers.tick(ms);}
 assert.equal(f.plays(),3);f.engine.error(2);t.mock.timers.tick(60000);assert.equal(f.plays(),3);assert.equal(f.doc.getElementById('retry-playback').hidden,false);
 f.engine.stop();t.mock.timers.tick(60000);assert.equal(f.plays(),3);
});
test('seleção de áudio/legenda modifica as faixas expostas e erro de codec não entra em loop',t=>{
 const f=setup(t);f.engine.start({kind:'movie',url:'https://fixture.invalid/movie',epgUrl:''});
 const audio=f.doc.getElementById('audio-track');audio.value='1';audio.dispatchEvent(new f.window.Event('change'));assert.equal(f.audio[0].enabled,false);assert.equal(f.audio[1].enabled,true);
 const subtitle=f.doc.getElementById('subtitle-track');subtitle.value='0';subtitle.dispatchEvent(new f.window.Event('change'));assert.equal(f.subtitles[0].mode,'showing');subtitle.value='-1';subtitle.dispatchEvent(new f.window.Event('change'));assert.equal(f.subtitles[0].mode,'disabled');
 assert.equal(f.engine.error(3),false);t.mock.timers.tick(7000);assert.equal(f.plays(),0);
});
test('próximo episódio respeita contagem, cancelamento e encerramento da sessão',t=>{
 const f=setup(t);let next=0;f.engine.start({kind:'series',url:'https://fixture.invalid/episode',epgUrl:''});f.engine.next(()=>next++);
 assert.equal(f.engine.ended(),true);t.mock.timers.tick(9000);assert.equal(next,0);f.doc.getElementById('next-cancel').click();t.mock.timers.tick(2000);assert.equal(next,0);
 f.engine.ended();t.mock.timers.tick(10000);assert.equal(next,1);assert.equal(f.doc.getElementById('next-prompt').hidden,true);
 f.engine.ended();f.engine.stop();t.mock.timers.tick(10000);assert.equal(next,1);
});
