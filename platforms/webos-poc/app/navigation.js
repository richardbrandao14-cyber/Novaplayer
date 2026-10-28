/* Foco e rolagem ES5: funciona sem scroll-behavior/preventScroll nativos. */
(function () {
  "use strict";
  var running=[];
  function reduced(){return window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;}
  function cancel(container){if(container._nexScrollFrame){window.cancelAnimationFrame(container._nexScrollFrame);container._nexScrollFrame=0;}var index=running.indexOf(container);if(index!==-1)running.splice(index,1);}
  function scroll(container,target,smooth,horizontal){
    var property=horizontal?"scrollLeft":"scrollTop",maximum=horizontal?container.scrollWidth-container.clientWidth:container.scrollHeight-container.clientHeight;
    cancel(container);target=Math.max(0,Math.min(maximum,target));
    var from=container[property],start=null;
    if(!smooth||reduced()||Math.abs(from-target)<2){container[property]=target;return;}
    running.push(container);
    function frame(now){if(start===null)start=now;var p=Math.min(1,(now-start)/200);container[property]=from+(target-from)*(1-Math.pow(1-p,3));if(p<1)container._nexScrollFrame=window.requestAnimationFrame(frame);else cancel(container);}
    container._nexScrollFrame=window.requestAnimationFrame(frame);
  }
  function focus(node,smooth){
    if(!node||node.disabled||!node.getClientRects().length)return;
    var parents=[],parent=node.parentElement,container=null,horizontalContainer=null;
    while(parent){parents.push({node:parent,top:parent.scrollTop,left:parent.scrollLeft});var overflow=window.getComputedStyle(parent).overflowY;if(!container&&(overflow==="auto"||overflow==="scroll")&&parent.scrollHeight>parent.clientHeight+1)container=parent;if(!horizontalContainer&&window.getComputedStyle(parent).overflowX==="auto"&&parent.scrollWidth>parent.clientWidth+1)horizontalContainer=parent;parent=parent.parentElement;}
    node.focus();
    parents.forEach(function(saved){saved.node.scrollTop=saved.top;saved.node.scrollLeft=saved.left;});
    var root=document.scrollingElement||document.documentElement;
    if(!container&&root.scrollHeight>window.innerHeight+1)container=root;
    if(horizontalContainer){var horizontalRect=node.getBoundingClientRect(),horizontalBounds=horizontalContainer.getBoundingClientRect(),targetLeft=horizontalContainer.scrollLeft;if(horizontalRect.left<horizontalBounds.left+8)targetLeft+=horizontalRect.left-horizontalBounds.left-8;else if(horizontalRect.right>horizontalBounds.right-8)targetLeft+=horizontalRect.right-horizontalBounds.right+8;scroll(horizontalContainer,targetLeft,!!smooth,true);}
    if(!container)return;
    var rect=node.getBoundingClientRect(),bounds=container===root?{top:0,bottom:window.innerHeight}:container.getBoundingClientRect(),top=bounds.top+(container.id==="library"?100:12),bottom=bounds.bottom-24,target=container.scrollTop;
    if(rect.top<top)target+=rect.top-top;else if(rect.bottom>bottom)target+=rect.bottom-bottom;
    scroll(container,target,!!smooth);
  }
  window.NexNavigation={focus:focus,scroll:scroll,cancel:function(){running.slice().forEach(cancel);}};
  window.addEventListener("pagehide",function(){window.NexNavigation.cancel();});
}());
