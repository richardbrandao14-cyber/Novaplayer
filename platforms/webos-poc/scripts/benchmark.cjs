// Mede a montagem real da coleção em Node, sem confundir com FPS/tempo de TV.
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const {performance}=require('node:perf_hooks');
const source=fs.readFileSync(path.join(__dirname,'../app/library.js'),'utf8');
const start=source.indexOf('    function collection() {'),end=source.indexOf('    function loadCollection()',start);
if(start<0||end<0)throw new Error('Função de coleção não encontrada para medir.');
const run=vm.runInThisContext('(function(state,hooks,catalogCache,favorites,key,id){'+source.slice(start,end)+';return collection();})');
const progress={};for(let i=1;i<=2000;i++)progress['episode:'+i]={parentId:String(i),position:30,updatedAt:i};
for(const size of [1000,10000,30000,50000]){const cache={series:{items:Array.from({length:size},(_,i)=>({series_id:i+1,name:'Série '+(i+1)}))}};const begin=performance.now();const result=run({continuing:true},{shelf:{progress:()=>progress,watchlist:()=>({})}},cache,{},(x,k)=>k+':'+x.series_id,x=>String(x.series_id));console.log(JSON.stringify({records:size,progress:2000,ms:Math.round((performance.now()-begin)*100)/100,matched:result.length}));}
