const {test}=require('node:test');
const assert=require('node:assert/strict');
const {webcrypto}=require('node:crypto');
const V=require('../app/vault.js');
function memory(){const values={};return{values,getItem:k=>values[k]||null,setItem:(k,v)=>{values[k]=v;},removeItem:k=>delete values[k]};}
const config={server:'https://secret-server.invalid',user:'private-user',password:'private-pass',apiQuery:[['token','private-query-token']]};
test('cofre AES-GCM nativo grava somente cifra e desbloqueia em nova instância',async()=>{
 const storage=memory(),vault=V.create(webcrypto,storage);assert.equal(vault.available(),true);await vault.save(config,'senha forte 123');const raw=JSON.stringify(storage.values);for(const secret of [...Object.values(config),'senha forte 123'])assert.ok(!raw.includes(secret));
 assert.deepEqual(await V.create(webcrypto,storage).open('senha forte 123'),config);await vault.save(config,'senha forte 123');assert.notEqual(JSON.stringify(storage.values),raw,'Cada gravação precisa de sal/IV novos');assert.equal(vault.forget(),true);assert.equal(vault.exists(),false);
});
test('senha incorreta e cifra alterada falham sem expor acesso',async()=>{
 const storage=memory(),vault=V.create(webcrypto,storage);await vault.save(config,'senha forte 123');await assert.rejects(vault.open('incorreta'),/incorreta|danificado/);const data=JSON.parse(storage.values['nex.vault.v1']);data.cipher[0]^=1;storage.values['nex.vault.v1']=JSON.stringify(data);await assert.rejects(vault.open('senha forte 123'),/incorreta|danificado/);
});
test('sem WebCrypto ou com senha curta não existe fallback em texto aberto',async()=>{
 const storage=memory();assert.equal(V.create(null,storage).available(),false);await assert.rejects(V.create(null,storage).save(config,'senha forte 123'));await assert.rejects(V.create(webcrypto,storage).save(config,'123'));assert.deepEqual(storage.values,{});await assert.rejects(V.create(webcrypto,storage).save(config,"senha forte 123",()=>false),/cancelada/);assert.deepEqual(storage.values,{});
});
