/* Até três imagens em voo; carrega somente a área visível e sua vizinhança. */
(function(){
  "use strict";
  var queue=[],active=[],frame=0;
  function schedule(){if(!frame)frame=window.requestAnimationFrame(pump);}
  function connected(img){return document.documentElement.contains(img);}
  function finish(job){if(job.done)return;job.done=true;clearTimeout(job.timer);var index=active.indexOf(job);if(index!==-1)active.splice(index,1);schedule();}
  function pump(){
    frame=0;active.slice().forEach(function(job){if(!connected(job.img)){finish(job);job.img.removeAttribute("src");}});
    queue=queue.filter(function(job){return connected(job.img);});
    queue.sort(function(a,b){return b.priority-a.priority;});
    for(var i=0;i<queue.length&&active.length<3;){var job=queue[i],rect=job.img.getBoundingClientRect();if(!rect.width||!rect.height||rect.bottom< -160||rect.top>window.innerHeight+160){i++;continue;}queue.splice(i,1);active.push(job);job.img.addEventListener("load",job.end);job.img.addEventListener("error",job.end);job.timer=setTimeout(job.timeout,10000);job.img.src=job.url;}
  }
  window.NexArtwork={add:function(img,url,priority){var job={img:img,url:url,priority:priority||0,done:false,timer:0};job.end=function(){finish(job);};job.timeout=function(){finish(job);img.removeAttribute("src");var event=document.createEvent("Event");event.initEvent("error",false,false);img.dispatchEvent(event);};queue.push(job);schedule();},clear:function(){queue=[];active.slice().forEach(function(job){finish(job);job.img.removeAttribute("src");});if(frame)window.cancelAnimationFrame(frame);frame=0;}};
  document.addEventListener("scroll",schedule,true);window.addEventListener("resize",schedule);window.addEventListener("pagehide",function(){window.NexArtwork.clear();});
}());
