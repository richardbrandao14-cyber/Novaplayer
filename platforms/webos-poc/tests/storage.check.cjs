const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const S=require('../app/storage.js');
function memory(){const values={};return{values,getItem:k=>values[k]||null,setItem:(k,v)=>{values[k]=v;}};}
const config={server:'https://private-provider.invalid:8080',user:'sensitive-user',password:'sensitive-password'};
test('namespace SHA-256 confere com implementação padrão, incluindo UTF-8',()=>{
 for(const text of ['', 'abc', 'português 😀', 'a'.repeat(4000),...Array.from({length:20},()=>crypto.randomBytes(50).toString('hex'))])assert.equal(S.fingerprint(text),crypto.createHash('sha256').update(text).digest('hex'));
});
test('favoritos, progresso e preferências sobrevivem a nova instância sem guardar acesso ou metadados',()=>{
 const storage=memory(),shelf=S.create(storage,()=>{});shelf.connect(config);shelf.favorite('movie:12',true);shelf.save('episode:99',135,900,'4');shelf.autoNext(false);shelf.format("ts");shelf.disconnect();
 const raw=JSON.stringify(storage.values);for(const secret of [config.server,config.user,config.password,'http','stream_icon','direct_source'])assert.ok(!raw.includes(secret));
 const next=S.create(storage,()=>{});next.connect(config);assert.equal(next.favorites()['movie:12'],true);assert.equal(next.progress()['episode:99'].position,135);assert.equal(next.progress()['episode:99'].parentId,'4');assert.equal(next.autoNext(),false);assert.equal(next.format(),"ts");
 next.connect({...config,user:'another-account'});assert.deepEqual(next.favorites(),{});next.connect(config);next.erase();assert.deepEqual(next.progress(),{});assert.deepEqual(next.favorites(),{});assert.equal(next.autoNext(),false);assert.equal(next.format(),"ts");
});
test('dados danificados, chaves inválidas e armazenamento indisponível não interrompem o app',()=>{
 const storage=memory();const key='nex.shelf.v1.'+S.fingerprint(config.server+'\n'+config.user);storage.values[key]='{invalid';const messages=[];const shelf=S.create(storage,x=>messages.push(x));shelf.connect(config);assert.ok(messages.length);shelf.favorite('movie:../../secret',true);shelf.save('javascript:1',1,1,'');assert.deepEqual(shelf.favorites(),{});assert.deepEqual(shelf.progress(),{});
 const blocked=S.create({getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}},x=>messages.push(x));assert.doesNotThrow(()=>{blocked.connect(config);blocked.favorite('live:1',true);});assert.ok(messages.length>=3);
});
