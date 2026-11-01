/* Atualização serial em segundo plano: TTL, limites, cancelamento e snapshot por seção. */
(function(){
  "use strict";
  function fetch(url,success,failure){
    var xhr=new XMLHttpRequest(),done=false;
    function fail(){if(done)return;done=true;failure();}
    try{xhr.open("GET",url,true);xhr.timeout=30000;xhr.onprogress=function(event){if(event.loaded>32*1024*1024){fail();xhr.abort();}};xhr.onerror=fail;xhr.ontimeout=fail;
      xhr.onload=function(){if(done)return;if(xhr.status<200||xhr.status>=300||xhr.responseText.length>32*1024*1024){fail();return;}var value;try{value=JSON.parse(xhr.responseText);}catch(error){fail();return;}done=true;success(value);};xhr.send(null);
    }catch(error){fail();}return xhr;
  }
  window.NexCatalogRefresh=function(hooks){
    var ttl=30*60*1000,retry=5*60*1000,clock=hooks.now||Date.now,later=hooks.later||setTimeout,clear=hooks.clear||clearTimeout;
    var times={},attempts={},timer=0,generation=0,running=false,active=false,xhr=null,fetcher=hooks.fetch||fetch;
    function schedule(delay){clear(timer);if(active)timer=later(check,delay);}
    function stop(){active=false;generation++;clear(timer);if(xhr)xhr.abort();xhr=null;running=false;times={};attempts={};}
    function fresh(kind){times[kind]=clock();delete attempts[kind];}
    function check(){
      if(!active)return;if(running||hooks.blocked()){schedule(30000);return;}
      var now=clock(),kinds=["movie","series","live"],kind="";
      for(var i=0;i<kinds.length;i++){var candidate=kinds[i];if(!hooks.cache(candidate))continue;if(times[candidate]===undefined){times[candidate]=now;continue;}if(now-times[candidate]>=ttl&&(attempts[candidate]===undefined||now-attempts[candidate]>=retry)){kind=candidate;break;}}
      if(!kind){schedule(30000);return;}
      running=true;attempts[kind]=now;var captured=generation;
      function current(){return active&&generation===captured;}
      function failed(){if(!current())return;running=false;xhr=null;if(hooks.status)hooks.status(false,kind);schedule(30000);}
      function valid(value){return window.NexDomain.records(value);}
      var action=kind==="live"?"get_live_streams":kind==="series"?"get_series":"get_vod_streams";
      xhr=fetcher(hooks.url(action),function(value){
        if(!current())return;var items;try{items=valid(value);}catch(error){failed();return;}
        if(hooks.blocked()){running=false;xhr=null;delete attempts[kind];schedule(30000);return;}
        xhr=fetcher(hooks.url(kind==="live"?"get_live_categories":kind==="series"?"get_series_categories":"get_vod_categories"),function(groups){
          if(!current())return;var categories;try{categories=valid(groups).filter(function(group){return group.category_id!==undefined;});}catch(error){failed();return;}
          running=false;xhr=null;if(hooks.blocked()){delete attempts[kind];schedule(30000);return;}
          hooks.commit(kind,{items:items,categories:categories,categoriesLoaded:true});fresh(kind);if(hooks.status)hooks.status(true,kind);schedule(1000);
        },failed);
      },failed);
    }
    return {start:function(){stop();active=true;schedule(ttl);},stop:stop,fresh:fresh,check:check};
  };
}());
