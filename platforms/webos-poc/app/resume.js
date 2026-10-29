/* Retomada confirmada: metadados e seek nem sempre ficam disponíveis juntos na TV. */
(function(){
  "use strict";
  window.NexResume=function(video,hooks){
    var target=0,pending=false,failed=false,wanted=true,attempted=false,lastAttempt=-1,started=0,timer=0;
    function clearTimer(){if(timer)clearTimeout(timer);timer=0;}
    function play(){if(!wanted)return;var result=video.play();if(result&&result.catch)result.catch(function(){hooks.message("Pressione reproduzir para continuar.");});}
    function finish(){pending=false;failed=false;clearTimer();hooks.done();play();}
    function fail(){pending=false;failed=true;clearTimer();video.pause();hooks.failed("Não foi possível retomar o ponto salvo. Pressione reproduzir para tentar novamente ou use Ajustes → Do início.");}
    function tick(event){
      if(!pending)return;clearTimer();var now=Date.now(),type=event&&event.type;
      if(attempted&&(type==="seeked"||type==="timeupdate")&&!video.seeking&&Math.abs(video.currentTime-target)<=1){finish();return;}
      if(now-started>=20000){fail();return;}
      if(video.readyState>=1&&(lastAttempt<0||now-lastAttempt>=1500)&&!video.seeking){
        var duration=video.duration,within=false;
        if(isFinite(duration)&&duration>0){if(target>=duration){fail();return;}within=true;}
        else if(video.seekable&&video.seekable.length){for(var i=0;i<video.seekable.length;i++)if(target>=video.seekable.start(i)&&target<=video.seekable.end(i))within=true;}
        if(within){lastAttempt=now;attempted=true;try{video.currentTime=target;}catch(error){/* Aguarda janela/decoder disponível; não descarta o ponto salvo. */}}
      }
      if(pending)timer=setTimeout(tick,250);
    }
    function begin(position){clearTimer();target=Number(position)||0;pending=isFinite(target)&&target>0;failed=false;wanted=true;attempted=false;lastAttempt=-1;started=Date.now();if(pending)timer=setTimeout(tick,0);return pending;}
    ["loadedmetadata","durationchange","progress","canplay","loadeddata","seeked","timeupdate"].forEach(function(type){video.addEventListener(type,tick);});
    video.addEventListener("playing",function(){if(pending||failed)video.pause();if(pending)tick();});
    return {begin:begin,cancel:function(){clearTimer();pending=false;failed=false;target=0;},pending:function(){return pending;},failed:function(){return failed;},blocksProgress:function(){return pending||failed;},wanted:function(){return wanted;},toggle:function(){wanted=!wanted;return wanted;},retry:function(){return begin(target);}};
  };
}());
