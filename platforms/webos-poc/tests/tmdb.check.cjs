const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const acorn=require('acorn');
const source=fs.readFileSync(path.join(__dirname,'../app/tmdb.js'),'utf8');
function setup(){
 const requests=[];
 function XHR(){requests.push(this);this.headers={};}
 XHR.prototype.open=function(method,url){this.url=url;};
 XHR.prototype.setRequestHeader=function(k,v){this.headers[k]=v;};
 XHR.prototype.send=function(){};
 XHR.prototype.abort=function(){this.aborted=true;};
 const context={window:{},XMLHttpRequest:XHR};vm.runInNewContext(source,context);
 function reply(body,status=200){const xhr=requests.at(-1);xhr.status=status;xhr.responseText=JSON.stringify(body);xhr.onload();}
 return {api:context.window.NexTmdb,requests,reply};
}
test('TMDB ES5: token enviado apenas no header, falha e desconexão removem acesso',()=>{
 acorn.parse(source,{ecmaVersion:5});const {api,requests,reply}=setup();
 let ok;api.configure('fixture-secret',v=>ok=v);assert.equal(requests[0].headers.Authorization,'Bearer fixture-secret');assert.ok(!requests[0].url.includes('fixture-secret'));
 reply({images:{}});assert.equal(ok,true);api.clear();api.lookup({name:'Movie'},'movie',{},v=>assert.equal(v,null));assert.equal(requests.length,1);
 api.configure('invalid',v=>ok=v);reply({},401);assert.equal(ok,false);api.lookup({},'movie',{},v=>assert.equal(v,null));assert.equal(requests.length,2);
});
test('TMDB prioriza ID; pesquisa ambígua não associa filme errado; cache e imagem são limitados',()=>{
 const {api,requests,reply}=setup();api.configure('fixture',()=>{});reply({images:{}});
 let data;api.lookup({name:'Movie'},'movie',{tmdb_id:42},v=>data=v);assert.match(requests.at(-1).url,/movie\/42\?/);reply({id:42,overview:'Synopsis'});assert.equal(data.overview,'Synopsis');
 const count=requests.length;api.lookup({name:'Movie'},'movie',{tmdb_id:42},()=>{});assert.equal(requests.length,count);
 api.lookup({name:'Same'},'movie',{},v=>data=v);reply({results:[{id:1,title:'Same'},{id:2,title:'Same'}]});assert.equal(data,null);
 assert.equal(api.image('//evil.example/a.jpg'),'');assert.equal(api.image('/valid.jpg'),'https://image.tmdb.org/t/p/w1280/valid.jpg');
});
test('CSS legado fixa a tela inteira sem inset/clamp/hex com alpha',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../app/style.css'),'utf8');
 assert.doesNotMatch(css,/\binset\s*:|clamp\s*\(|#[a-f\d]{8}\b/i);
 assert.match(css,/#library\{top:0;right:0;bottom:0;left:0;width:100%;height:100%\}/);
});
