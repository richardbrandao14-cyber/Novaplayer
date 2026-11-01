// Capturas reais do app com fonte fictícia interceptada; nada é enviado a provedores.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../dist/app');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.png')?'image/png':file.endsWith('.mp4')?'video/mp4':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(bytes);});
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({executablePath:process.env.NOVA_CHROMIUM_PATH||undefined,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const base='http://127.0.0.1:'+server.address().port;
    const names=['Além do horizonte','Luzes da cidade','Maré noturna','Entre mundos','O último sinal','Caminhos de luz'];
    const colors=['#b95a27','#247a89','#4f5791','#945447','#42675a','#917748'];
    const art='https://fixture.example/cinema.png';
    const movies=names.map((name,index)=>({stream_id:index+1,name,category_id:'1',added:String(1700000000+index),stream_icon:'https://fixture.example/poster-'+index+'.svg',backdrop_path:[art],plot:'Uma jornada para descobrir o que existe além do conhecido. Conteúdo fictício usado apenas nesta prévia visual.'}));
    await page.route('**://fixture.example/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname==='/cinema.png'){await route.fulfill({contentType:'image/png',body:fs.readFileSync(path.join(root,'assets/login-cinema.png'))});return;}
      if(url.pathname==='/missing.svg'){await route.fulfill({status:404,body:'missing'});return;}
      if(url.pathname.endsWith('.svg')){
        const index=Number((url.pathname.match(/\d+/)||['0'])[0])%6;
        await route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600"><defs><linearGradient id="g" x2=".8" y2="1"><stop stop-color="${colors[index]}"/><stop offset="1" stop-color="#101722"/></linearGradient></defs><rect width="400" height="600" fill="url(#g)"/><circle cx="280" cy="210" r="150" fill="none" stroke="#ffffff" stroke-opacity=".25" stroke-width="2"/><circle cx="220" cy="190" r="80" fill="#ffffff" fill-opacity=".08"/><path d="M0 430 180 260 400 480V600H0Z" fill="#080c14" fill-opacity=".6"/><text x="32" y="60" font-size="16" letter-spacing="4" fill="#fff">NEX · DEMONSTRAÇÃO</text><text x="32" y="506" font-size="29" font-family="Arial" fill="#fff">${names[index]}</text><text x="32" y="540" font-size="16" font-family="Arial" fill="#ffffff" fill-opacity=".6">ARTE ABSTRATA DE TESTE</text></svg>`});return;
      }
      const action=url.searchParams.get('action');
      const info={plot:movies[0].plot,backdrop_path:[art],genre:'Ficção · Demonstração'};
      const value=!action?{user_info:{auth:1,status:'Active'}}:/categories$/.test(action)?[{category_id:'1',category_name:'Todos os gêneros'},{category_id:'2',category_name:'Aventura'},{category_id:'3',category_name:'Drama'}]:action==='get_live_streams'?movies.map((item,index)=>({...item,name:['Globo HD','HBO 2 FHD','ESPN 2','GloboNews','AXN HD','Canal Demo'][index],stream_icon:index===1?'https://fixture.example/missing.svg':'',direct_source:base+'/media/player-av.mp4'})):action==='get_vod_streams'?movies:action==='get_vod_info'?{info,movie_data:movies[0]}:action==='get_series'?movies.map(item=>({...item,series_id:item.stream_id,cover:item.stream_icon})):action==='get_series_info'?{info,episodes:{1:movies.map((item,index)=>({id:index+1,title:item.name,episode_num:index+1,container_extension:'mp4',info:{movie_image:item.stream_icon,plot:'Episódio demonstrativo para avaliar a interface.'}})),2:[]}}:[];
      await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
    });
    await page.goto(base);await page.locator('#server').fill('https://fixture.example');await page.locator('#username').fill('visual-demo');await page.locator('#password').fill('visual-demo');await page.locator('#remember-access').uncheck();await page.locator('#connect-source').click();await page.locator('#profile-list [data-profile="default"]').click();
    await page.locator('#home-movies .home-card').first().waitFor();
    await page.locator('#load-movies').click();await page.locator('#catalog-list button').first().waitFor();
    await page.waitForFunction(()=>document.querySelector('#feature-art img')?.naturalWidth>0);
    await page.locator('#feature-open').focus();await page.evaluate(()=>document.getElementById('library').scrollTop=0);await page.waitForTimeout(300);
    await page.locator('#lib-status').evaluate(node=>node.textContent='PRÉVIA VISUAL · Conteúdo e artes demonstrativos · Interface real no Chromium');
    const capture=async name=>page.screenshot({path:path.resolve(__dirname,'../dist/nex-webos-glass-'+name+'.png')});
    await capture('filmes');
    await page.locator('#lib-home').click();await page.locator('#home-movies .home-card').first().waitFor();await page.locator('#feature-open').focus();await page.evaluate(()=>document.getElementById('library').scrollTop=0);await page.waitForTimeout(250);await capture('inicio');
    await page.locator('#load-series').click();await page.locator('#catalog-list button').first().focus();await page.keyboard.press('Enter');await page.locator('#episode-list button').first().waitFor();await page.locator('#season-options button').first().focus();await page.evaluate(()=>document.getElementById('library').scrollTop=0);await page.waitForTimeout(250);await capture('serie');
    await page.locator('#load-live').click();await page.locator('#catalog-list button').first().focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#player video').videoWidth>0);await page.locator('#load-live').focus();await page.evaluate(()=>document.getElementById('library').scrollTop=0);await page.waitForFunction(()=>{const imgs=Array.from(document.querySelectorAll('#catalog-list .channel-logo img'));return imgs.length===5&&imgs.every(img=>img.naturalWidth>0);});await page.locator('#lib-status').evaluate(node=>node.textContent='PRÉVIA · Logos reais locais · Vídeo sintético de teste, sem transmissão dos canais');await page.locator('#catalog-list button').first().focus();await page.waitForTimeout(240);await capture('tv');
    const sources=JSON.parse(fs.readFileSync(path.join(root,'assets/channel-logos/SOURCES.json'),'utf8'));
    await page.evaluate(async files=>{await Promise.all(files.map(file=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>img.naturalWidth>0?resolve():reject(new Error('Logo vazio'));img.onerror=()=>reject(new Error('Logo não decodificou: '+file));img.src='assets/channel-logos/'+file;})));},sources.files.map(file=>file.file));
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('PASS: quatro capturas da interface real e 51 logos locais decodificados; fonte fictícia interceptada, sem API externa.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
