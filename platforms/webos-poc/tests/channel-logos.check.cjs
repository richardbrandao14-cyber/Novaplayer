const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/channel-logos.js'),'utf8'),context);const logos=context.window.NexChannelLogos;
test('Reconhece aliases e qualidade sem confundir números, regiões ou outros canais',()=>{
 assert.match(logos.lookup('BR | TV Globo [FHD]'),/tvglobo/);assert.match(logos.lookup('HBO 2 HD'),/hbo2/);assert.match(logos.lookup('ESPN 2 4K'),/espn2/);assert.notEqual(logos.lookup('ESPN 2'),logos.lookup('ESPN'));
 for(const name of ['Globo SP','Globo Portugal','HBO 20','ESPN 200','Discovery Kids','Animal Planet +1','CNN Brasil','Canal desconhecido'])assert.equal(logos.lookup(name),'');
});
test('Prioriza imagens da fonte e usa logo local no fim; arquivos locais limitados ao catálogo',()=>{
 const candidates=Array.from(logos.candidates({name:'Globo',stream_icon:'https://fixture.example/one.png',logo:'https://fixture.example/one.png','tvg-logo':'https://fixture.example/two.png'}));assert.equal(candidates.length,3);assert.equal(candidates[0],'https://fixture.example/one.png');assert.ok(logos.isLocal(candidates[2]));assert.equal(logos.isLocal('assets/channel-logos/../../vault.js'),false);
 assert.equal(logos.candidates({name:'Globo',stream_icon:'null'}).length,1);assert.equal(logos.candidates({name:'Sem canal'}).length,0);assert.equal(logos.initials('Canal Local HD'),'CL');
});
test('Banco tem arquivos originais íntegros, procedência e SVG sem conteúdo ativo',()=>{
 const root=path.join(__dirname,'../app/assets/channel-logos'),sources=JSON.parse(fs.readFileSync(path.join(root,'SOURCES.json'),'utf8'));assert.equal(sources.files.length,logos.count);let bytes=0;
 for(const file of sources.files){const data=fs.readFileSync(path.join(root,file.file));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),file.sha256);assert.ok(file.source.includes(sources.revision));assert.ok(!/<script|<foreignObject|\bon\w+\s*=|(?:href|url)\s*[=(]\s*["']?https?:/i.test(data.toString()));bytes+=data.length;}
 assert.ok(bytes<600000,'Banco inicial deve ser compacto');
});
test('Índice do arquivo do usuário contém somente referências de logos e evita colisões',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../app/channel-logo-data.js'),'utf8'),scope={window:{}};vm.runInNewContext(code,scope);assert.ok(scope.window.NexChannelLogoData.length>1000);
 for(const [name,url] of scope.window.NexChannelLogoData){const parsed=new URL(url);assert.ok(name.length<=200);assert.ok(['http:','https:'].includes(parsed.protocol));assert.equal(parsed.username,'');assert.equal(parsed.password,'');assert.equal(parsed.search,'');assert.ok(!/\.(m3u8?|mp4|ts)(?:$|\?)/i.test(parsed.pathname));}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/channel-logos.js'),'utf8'),scope);
 const found=scope.window.NexChannelLogos.candidates({name:'Canal UOL HD'});assert.ok(found.some(url=>url.startsWith('https://')));
 const conflict={window:{NexChannelLogoData:[['Canal Ambíguo HD','https://fixture.example/a.png'],['Canal Ambíguo FHD','https://fixture.example/b.png']]}};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/channel-logos.js'),'utf8'),conflict);assert.equal(conflict.window.NexChannelLogos.candidates({name:'Canal Ambíguo'}).length,0);
});
