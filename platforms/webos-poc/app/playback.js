/* Recursos dependem das faixas e formatos expostos pelo motor HTML5 da TV. */
(function () {
  "use strict";
  window.NexPlayback = function (video, hooks) {
    var ctx=null, attempts=0, retryTimer, healthTimer, stallTimer, countTimer, count=0, next=null, epgGeneration=0;
    function el(id){return document.getElementById(id);}
    function status(value){el("player-status").textContent=value;hooks.activity();}
    function cancelCountdown(){clearInterval(countTimer);el("next-prompt").hidden=true;}
    function tracks(){
      ["audio","subtitle"].forEach(function(kind){
        var select=el(kind+"-track"),list=kind==="audio"?video.audioTracks:video.textTracks;select.textContent="";
        if(kind==="subtitle"){var off=document.createElement("option");off.value="-1";off.textContent="Legendas desligadas";select.appendChild(off);}
        if(!list || !list.length){var missing=document.createElement("option");missing.textContent=kind==="audio"?"Áudio padrão da TV":"Nenhuma legenda fornecida";missing.value="-1";if(kind==="audio")select.appendChild(missing);select.disabled=true;return;}
        select.disabled=false;var selected="-1";
        for(var i=0;i<list.length;i++){var option=document.createElement("option");option.value=String(i);option.textContent=list[i].label||list[i].language||(kind==="audio"?"Áudio ":"Legenda ")+(i+1);select.appendChild(option);if(kind==="audio"?list[i].enabled:list[i].mode==="showing")selected=String(i);}
        select.value=selected;
      });
    }
    function retry(manual){
      clearTimeout(retryTimer);clearTimeout(healthTimer);if(!ctx)return;
      if(!manual && attempts>=3){status("Não foi possível recuperar a transmissão. Tente novamente ou escolha outro conteúdo.");el("retry-playback").hidden=false;return;}
      var position=video.currentTime, current=ctx;attempts++;
      status("Reconectando… tentativa "+attempts+" de 3");el("retry-playback").hidden=true;
      retryTimer=setTimeout(function(){if(ctx!==current)return;video.pause();video.removeAttribute("src");video.load();video.src=current.url;video.load();current.retryPosition=current.kind!=="live"?position:0;var p=video.play();if(p&&p.catch)p.catch(function(){status("Pressione Reproduzir para continuar.");el("retry-playback").hidden=false;});},manual?0:Math.pow(2,attempts-1)*1000);
    }
    function stop(){ctx=null;next=null;epgGeneration++;clearTimeout(retryTimer);clearTimeout(healthTimer);clearInterval(stallTimer);cancelCountdown();el("epg-panel").hidden=true;el("epg-list").textContent="";el("retry-playback").hidden=true;}
    function start(context){stop();ctx=context;attempts=0;tracks();el("show-epg").hidden=context.kind!=="live"||!context.epgUrl;el("restart-playback").hidden=context.kind==="live"||context.kind==="local";var last=0,stale=0;stallTimer=setInterval(function(){if(!ctx||video.paused||document.hidden){stale=0;return;}if(video.currentTime===last && video.readyState<3)stale+=5;else stale=0;last=video.currentTime;if(stale>=20){stale=0;retry(false);}},5000);}
    video.addEventListener("loadedmetadata",function(){tracks();if(ctx&&ctx.retryPosition&&isFinite(video.duration)&&ctx.retryPosition<video.duration-1){try{video.currentTime=ctx.retryPosition;}catch(e){status("Esta fonte não permitiu retomar a posição.");}ctx.retryPosition=0;}});
    video.addEventListener("playing",function(){el("retry-playback").hidden=true;clearTimeout(healthTimer);healthTimer=setTimeout(function(){attempts=0;},30000);});
    [video.audioTracks,video.textTracks].forEach(function(list){if(list&&list.addEventListener){list.addEventListener("addtrack",tracks);list.addEventListener("removetrack",tracks);}});
    el("audio-track").addEventListener("change",function(){var list=video.audioTracks;if(!list)return;try{for(var i=0;i<list.length;i++)list[i].enabled=i===Number(this.value);}catch(e){status("A TV não permitiu trocar a faixa de áudio desta fonte.");}hooks.activity();});
    el("subtitle-track").addEventListener("change",function(){var list=video.textTracks;if(!list)return;try{for(var i=0;i<list.length;i++)list[i].mode=i===Number(this.value)?"showing":"disabled";}catch(e){status("A TV não permitiu trocar a legenda desta fonte.");}hooks.activity();});
    el("retry-playback").addEventListener("click",function(){attempts=0;retry(true);});
    el("restart-playback").addEventListener("click",function(){try{video.currentTime=0;var p=video.play();if(p&&p.catch)p.catch(function(){status("Pressione Reproduzir.");});}catch(e){status("Esta fonte não permite reiniciar agora.");}hooks.activity();});
    function runNext(){var action=next;cancelCountdown();if(action)action();}
    el("next-now").addEventListener("click",runNext);el("next-cancel").addEventListener("click",function(){cancelCountdown();el("play-pause").focus();});
    function hideEpg(){el("epg-panel").hidden=true;el("show-epg").focus();hooks.activity();}
    el("close-epg").addEventListener("click",hideEpg);
    el("show-epg").addEventListener("click",function(){
      if(!ctx||!ctx.epgUrl)return;var generation=++epgGeneration;el("epg-panel").hidden=false;el("epg-list").textContent="";el("epg-status").textContent="Carregando programação…";el("close-epg").focus();
      hooks.request(ctx.epgUrl,function(value){if(generation!==epgGeneration||!ctx)return;var rows=window.NexDomain.epg(value);el("epg-status").textContent=rows.length?"Horários exibidos conforme os dados da fonte.":"A fonte não forneceu programação para este canal.";rows.forEach(function(row){var entry=document.createElement("article"),title=document.createElement("strong"),time=document.createElement("small"),description=document.createElement("p");title.textContent=row.title;time.textContent=row.start?new Date(row.start).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}):"Horário não informado";description.textContent=row.description;entry.appendChild(time);entry.appendChild(title);entry.appendChild(description);el("epg-list").appendChild(entry);});},function(){if(generation===epgGeneration)el("epg-status").textContent="Não foi possível consultar a programação. A reprodução continua normalmente.";});
    });
    return {start:start,stop:stop,next:function(action){next=action;},error:function(code){if(code===2&&ctx){retry(false);return true;}el("retry-playback").hidden=false;return false;},
      ended:function(){if(!next||!hooks.autoNext()||document.hidden)return false;count=10;el("next-prompt").hidden=false;el("next-countdown").textContent="Próximo episódio em "+count+" segundos";el("next-now").focus();countTimer=setInterval(function(){if(document.hidden){cancelCountdown();return;}count--;el("next-countdown").textContent="Próximo episódio em "+count+" segundos";if(count<=0)runNext();},1000);return true;},
      back:function(){if(!el("epg-panel").hidden){hideEpg();return true;}if(!el("next-prompt").hidden){cancelCountdown();el("play-pause").focus();return true;}return false;},scope:function(){return !el("epg-panel").hidden?el("epg-panel"):!el("next-prompt").hidden?el("next-prompt"):null;}};
  };
}());
