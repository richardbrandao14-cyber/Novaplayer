const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {JSDOM}=require('jsdom');
test('capas respeitam três conexões, prioridade, visibilidade e cancelamento de itens removidos',async()=>{
 const dom=new JSDOM('<body></body>',{pretendToBeVisual:true,runScripts:'outside-only'}),win=dom.window,started=[],inflight=new Set();let peak=0;
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/artwork.js'),'utf8'),dom.getInternalVMContext());
 const images=[];for(let i=0;i<7;i++){const img=win.document.createElement('img');img.getBoundingClientRect=()=>({top:i===0?3000:100,bottom:i===0?3200:300,width:200,height:200});Object.defineProperty(img,'src',{set(value){started.push({img,value});inflight.add(img);peak=Math.max(peak,inflight.size);}});const remove=img.removeAttribute.bind(img);img.removeAttribute=name=>{if(name==='src')inflight.delete(img);remove(name);};win.document.body.appendChild(img);images.push(img);win.NexArtwork.add(img,'https://fixture.example/'+i+'.png',i===6?10:0);}
 const wait=()=>new Promise(resolve=>setTimeout(resolve,45));
 await wait();assert.equal(started.length,3);assert.equal(started[0].img,images[6]);assert.ok(!started.some(entry=>entry.img===images[0]));assert.equal(peak,3);
 const first=started[0].img;inflight.delete(first);first.dispatchEvent(new win.Event('load'));await wait();assert.equal(started.length,4);assert.ok(peak<=3);
 const detached=Array.from(inflight)[0];detached.remove();win.document.dispatchEvent(new win.Event('scroll'));await wait();assert.equal(started.length,5);assert.ok(!inflight.has(detached));assert.ok(peak<=3);
 win.NexArtwork.clear();assert.equal(inflight.size,0);dom.window.close();
});
