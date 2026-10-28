/* Foco e rolagem ES5: funciona sem scroll-behavior/preventScroll nativos. */
(function () {
  "use strict";
  var running=[];
  function reduced(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
  function cancel(container){if(container._nexScrollFrame){window.cancelAnimationFrame(container._nexScrollFrame);container._nexScrollFrame=0;}var index=running.indexOf(container);if(index!==-1)running.splice(index,1);}
  function scroll(container,target,smooth){
    cancel(container);target=Math.max(0,Math.min(container.scrollHeight-container.clientHeight,target));
    var from=container.scrollTop,start=null;
    if(!smooth||reduced()||Math.abs(from-target)<2){container.scrollTop=target;return;}
    running.push(container);
    function frame(now){if(start===null)start=now;var p=Math.min(1,(now-start)/200);container.scrollTop=from+(target-from)*(1-Math.pow(1-p,3));if(p<1)container._nexScrollFrame=window.requestAnimationFrame(frame);else cancel(container);}
    container._nexScrollFrame=window.requestAnimationFrame(frame);
  }
  function focus(node,smooth){
    if(!node||node.disabled||!node.getClientRects().length)return;
    var parents=[],parent=node.parentElement,container=null;
    while(parent){parents.push({node:parent,top:parent.scrollTop,left:parent.scrollLeft});var overflow=window.getComputedStyle(parent).overflowY;if(!container&&(overflow==="auto"||overflow==="scroll")&&parent.scrollHeight>parent.clientHeight+1)container=parent;parent=parent.parentElement;}
    node.focus();
    parents.forEach(function(saved){saved.node.scrollTop=saved.top;saved.node.scrollLeft=saved.left;});
    var root=document.scrollingElement||document.documentElement;
    if(!container&&root.scrollHeight>window.innerHeight+1)container=root;
    if(!container)return;
    var rect=node.getBoundingClientRect(),bounds=container===root?{top:0,bottom:window.innerHeight}:container.getBoundingClientRect(),top=bounds.top+(container.id==="library"?100:12),bottom=bounds.bottom-24,target=container.scrollTop;
    if(rect.top<top)target+=rect.top-top;else if(rect.bottom>bottom)target+=rect.bottom-bottom;
    scroll(container,target,!!smooth);
  }
  window.NexNavigation={focus:focus,scroll:scroll,cancel:function(){running.slice().forEach(cancel);}};
  window.addEventListener("pagehide",function(){window.NexNavigation.cancel();});
}());
