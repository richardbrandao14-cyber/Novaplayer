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

test('Minha lista é distinta dos favoritos e persiste apenas IDs por conta',()=>{
 const storage=memory(),shelf=S.create(storage,()=>{});shelf.connect(config);shelf.list('movie:8',true);shelf.favorite('movie:9',true);shelf.list('movie:../../secret',true);
 assert.deepEqual(shelf.watchlist(),{'movie:8':true});assert.deepEqual(shelf.favorites(),{'movie:9':true});
 const next=S.create(storage,()=>{});next.connect(config);assert.deepEqual(next.watchlist(),{'movie:8':true});next.connect({...config,user:'another-account'});assert.deepEqual(next.watchlist(),{});next.connect(config);next.erase();assert.deepEqual(next.watchlist(),{});
});

test('cinco perfis isolam favoritos, Minha lista, progresso e preferências sem migrar o perfil original',()=>{
 const storage=memory(),shelf=S.create(storage,()=>{});shelf.connect(config);shelf.favorite('movie:12',true);shelf.list('series:7',true);shelf.save('episode:5',40,800,'7');shelf.autoNext(false);shelf.format('ts');
 const legacyKey='nex.shelf.v1.'+S.fingerprint(config.server+'\n'+config.user);const legacy=storage.values[legacyKey];
 const ids=[];for(let i=2;i<=5;i++)ids.push(shelf.createProfile('Pessoa '+i));assert.ok(ids.every(Boolean));assert.equal(shelf.profiles().length,5);assert.equal(shelf.createProfile('Sexto'),'');assert.equal(shelf.createProfile('Pessoa 2'),'');
 for(const [index,id] of ids.entries()){assert.equal(shelf.selectProfile(id),true);assert.deepEqual(shelf.favorites(),{});assert.deepEqual(shelf.watchlist(),{});assert.deepEqual(shelf.progress(),{});assert.equal(shelf.format(),'ts');shelf.favorite('movie:'+index,true);shelf.list('series:'+index,true);shelf.save('movie:'+index,20+index,800,'');}
 assert.equal(storage.values[legacyKey],legacy);assert.equal(shelf.selectProfile('default'),true);assert.equal(shelf.favorites()['movie:12'],true);assert.equal(shelf.progress()['episode:5'].position,40);assert.equal(shelf.autoNext(),false);
 assert.equal(shelf.renameProfile('default','Principal'),true);assert.equal(shelf.renameProfile(ids[0],'Principal'),false);
 shelf.selectProfile(ids[1]);const next=S.create(storage,()=>{});next.connect(config);assert.equal(next.activeProfile(),ids[1]);assert.deepEqual(next.favorites(),{'movie:1':true});assert.equal(next.progress()['movie:1'].position,21);next.erase();assert.deepEqual(next.favorites(),{});next.selectProfile('default');assert.equal(next.favorites()['movie:12'],true);
 next.connect({...config,user:'outra-conta'});assert.equal(next.profiles().length,1);assert.deepEqual(next.favorites(),{});assert.ok(!JSON.stringify(storage.values).includes(config.password));
});
test('perfil inválido ou falha de gravação nunca troca os dados em memória',()=>{
 const storage=memory(),messages=[],shelf=S.create(storage,x=>messages.push(x));shelf.connect(config);shelf.favorite('movie:1',true);assert.equal(shelf.selectProfile('../outro'),false);assert.equal(shelf.renameProfile('default','\n'),false);
 storage.setItem=()=>{throw new Error('quota');};assert.equal(shelf.createProfile('Teste'),'');assert.equal(shelf.profiles().length,1);assert.equal(shelf.activeProfile(),'default');assert.equal(shelf.favorites()['movie:1'],true);assert.ok(messages.length);
});
