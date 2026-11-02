/* Foco e rolagem ES5: funciona sem scroll-behavior/preventScroll nativos. */
(function () {
  "use strict";
  var running=[],layoutVersion=0,preventScroll=null;
  function reduced(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
  function finish(job){window.cancelAnimationFrame(job.frame);var at=running.indexOf(job);if(at!==-1)running.splice(at,1);if(job.container._nexScrollJobs)delete job.container._nexScrollJobs[job.property];}
  function pending(container,horizontal){return container._nexScrollJobs&&container._nexScrollJobs[horizontal?"scrollLeft":"scrollTop"];}
  function scroll(container,target,smooth,horizontal){
    var property=horizontal?"scrollLeft":"scrollTop",maximum=horizontal?container.scrollWidth-container.clientWidth:container.scrollHeight-container.clientHeight;
    target=Math.max(0,Math.min(maximum,target));var job=pending(container,horizontal);
    if(!smooth||reduced()||Math.abs(container[property]-target)<.5){if(job)finish(job);container[property]=target;return;}
    if(job){job.target=target;return;}
    job={container:container,property:property,target:target,time:0,position:container[property],frame:0};
    if(!container._nexScrollJobs)container._nexScrollJobs={};container._nexScrollJobs[property]=job;running.push(job);
    function frame(now){
      var dt=job.time?Math.min(40,Math.max(1,now-job.time)):16;job.time=now;
      job.position+=(job.target-job.position)*(1-Math.exp(-dt/48));container[property]=job.position;
      if(Math.abs(job.target-job.position)<1){container[property]=job.target;finish(job);return;}
      job.frame=window.requestAnimationFrame(frame);
    }
    job.frame=window.requestAnimationFrame(frame);
  }
  function modes(node){var cached=node._nexScrollModes;if(!cached||cached.version!==layoutVersion){var style=window.getComputedStyle(node);cached=node._nexScrollModes={version:layoutVersion,x:style.overflowX,y:style.overflowY};}return cached;}
  function invalidate(){layoutVersion++;}
  function rows(list){
    var width=list.clientWidth,buttons=list.querySelectorAll("button"),cached=list._nexGrid;
    if(cached&&cached.version===layoutVersion&&cached.width===width&&cached.count===buttons.length&&cached.first===buttons[0]&&cached.last===buttons[buttons.length-1])return cached.rows;
    var result=[],row=[],top=null;
    for(var i=0;i<buttons.length;i++){var nextTop=buttons[i].offsetTop;if(top!==null&&Math.abs(nextTop-top)>10){result.push(row);row=[];}if(!row.length)top=nextTop;buttons[i]._nexGridRow=result.length;buttons[i]._nexGridColumn=row.length;row.push(buttons[i]);}
    if(row.length)result.push(row);list._nexGrid={version:layoutVersion,width:width,count:buttons.length,first:buttons[0],last:buttons[buttons.length-1],rows:result};return result;
  }
  var reveals=[];
  function reveal(node){
    if(!node||reduced())return;
    if(node._nexReveal){node._nexReveal.cancel();node._nexReveal=null;}
    if(typeof node.animate==="function"){
      var animation=node.animate([{opacity:.65,transform:"translateY(6px)"},{opacity:1,transform:"translateY(0)"}],{duration:190,easing:"cubic-bezier(.2,.7,.3,1)"});
      node._nexReveal=animation;reveals.push(animation);animation.onfinish=function(){node._nexReveal=null;var index=reveals.indexOf(animation);if(index!==-1)reveals.splice(index,1);};
      animation.oncancel=function(){var index=reveals.indexOf(animation);if(index!==-1)reveals.splice(index,1);};
    }else{node.classList.remove("nex-view-enter");window.requestAnimationFrame(function(){if(document.documentElement.contains(node))node.classList.add("nex-view-enter");});}
  }
  function focus(node,smooth){
    if(!node||node.disabled||!node.getClientRects().length)return;
    var parents=[],parent=node.parentElement,container=null,horizontalContainer=null;
    while(parent){if(preventScroll!==true)parents.push({node:parent,top:parent.scrollTop,left:parent.scrollLeft});var computed=modes(parent),overflow=computed.y;if(!container&&(overflow==="auto"||overflow==="scroll")&&parent.scrollHeight>parent.clientHeight+1)container=parent;if(!horizontalContainer&&(computed.x==="auto"||computed.x==="scroll")&&parent.scrollWidth>parent.clientWidth+1)horizontalContainer=parent;parent=parent.parentElement;}
    if(preventScroll===true)node.focus({preventScroll:true});
    else if(preventScroll===false)node.focus();
    else{var supported=false;try{var options={};Object.defineProperty(options,"preventScroll",{get:function(){supported=true;return true;}});node.focus(options);}catch(error){node.focus();}preventScroll=supported;}
    if(preventScroll!==true)parents.forEach(function(saved){saved.node.scrollTop=saved.top;saved.node.scrollLeft=saved.left;});
    var root=document.scrollingElement||document.documentElement;
    if(!container&&root.scrollHeight>window.innerHeight+1)container=root;
    if(horizontalContainer){var horizontalRect=node.getBoundingClientRect(),horizontalBounds=horizontalContainer.getBoundingClientRect(),horizontalJob=pending(horizontalContainer,true),targetLeft=horizontalJob?horizontalJob.target:horizontalContainer.scrollLeft,deltaLeft=targetLeft-horizontalContainer.scrollLeft;
      if(horizontalRect.left-deltaLeft<horizontalBounds.left+8)targetLeft=horizontalContainer.scrollLeft+horizontalRect.left-horizontalBounds.left-8;else if(horizontalRect.right-deltaLeft>horizontalBounds.right-8)targetLeft=horizontalContainer.scrollLeft+horizontalRect.right-horizontalBounds.right+8;
      if(!horizontalJob||Math.abs(targetLeft-horizontalJob.target)>.5)scroll(horizontalContainer,targetLeft,!!smooth,true);
    }
    if(!container)return;
    var rect=node.getBoundingClientRect(),bounds=container===root?{top:0,bottom:window.innerHeight}:container.getBoundingClientRect(),top=bounds.top+(container.id==="library"?100:12),bottom=bounds.bottom-24,job=pending(container,false),target=job?job.target:container.scrollTop,delta=target-container.scrollTop;
    if(container.id==="library"&&node.parentElement&&node.parentElement.classList.contains("feature-actions")){var hero=document.getElementById("feature");target=container.scrollTop+hero.getBoundingClientRect().top-top;scroll(container,target,!!smooth);return;}
    if(rect.top-delta<top)target=container.scrollTop+rect.top-top;else if(rect.bottom-delta>bottom)target=container.scrollTop+rect.bottom-bottom;
    if(!job||Math.abs(target-job.target)>.5)scroll(container,target,!!smooth);
  }
  window.NexNavigation={focus:focus,scroll:scroll,reveal:reveal,rows:rows,invalidate:invalidate,cancel:function(){running.slice().forEach(finish);reveals.slice().forEach(function(animation){animation.cancel();});}};
  window.addEventListener("resize",invalidate);
  window.addEventListener("pagehide",function(){window.NexNavigation.cancel();});
}());
