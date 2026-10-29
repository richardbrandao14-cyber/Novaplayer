/* Biblioteca webOS: DOM limitado por página, estado de navegação só em memória. */
(function () {
  "use strict";
  window.NexLibrary = function (hooks) {
    var D = window.NexDomain, state = null, stack = [], favorites = {}, filterGeneration = 0, filterTimer, queryTimer;
    var catalogCache = {}, featureTimer,featureCache={}, subMenu=false, liveKey="", searchContext=null, resumePending=null, categoryParent="";
    var detail = null, detailGeneration = 0, season = "", episodePage = 0, pageSize = 48,profiles,home,homeLive=null;
    function el(id) { return document.getElementById(id); }
    function text(id, value) { if(!window.NexIcons.set(id,value))el(id).textContent = value || ""; }
    function focus(node) { if(node&&document.querySelector(".tv-sidebar").contains(node))compact(false);window.NexNavigation.focus(node,true); }
    function label(kind) { return kind === "live" ? "TV ao vivo" : kind === "series" ? "Séries" : "Filmes"; }
    function name(item) { return String(item.name || item.title || "Título não fornecido"); }
    function id(item, kind) { return String(kind === "series" ? item.series_id : item.stream_id); }
    function key(item, kind) { return kind === "series" && item.series_id === undefined ? "episode:" + String(item.id) : kind + ":" + id(item, kind); }
    function image(parent, url, className) {
      parent.textContent="";var urls=(Array.isArray(url)?url:[url]).map(function(value){return D.imageUrl(value,hooks.config()&&hooks.config().server);}).filter(function(value,index,all){return value&&all.indexOf(value)===index;}).slice(0,8);if(!urls.length)return;
      var img=document.createElement("img"),index=0;img.alt="";img.className=className||"";img.referrerPolicy="no-referrer";
      img.addEventListener("error",function(){if(!img.parentNode)return;if(++index<urls.length){img.removeAttribute("src");window.NexArtwork.add(img,urls[index],parent.classList.contains("episode-image")?5:0);return;}parent.removeChild(img);var fallback=document.createElement("span");fallback.className="art-placeholder";fallback.textContent=parent.classList.contains("episode-image")?"Imagem indisponível":parent.classList.contains("channel-logo")?"TV":"nex.";parent.appendChild(fallback);});
      parent.appendChild(img);window.NexArtwork.add(img,urls[0],parent.id==="feature-art"||parent.id==="detail-art"?10:parent.classList.contains("episode-image")?5:0);
    }
    function art(item) { return item.stream_icon || item.logo || item["tvg-logo"] || item.cover || item.movie_image || ""; }
    function cancel() { if(home)home.cancel(); resumePending=null;el("resume-choice").hidden=true;hooks.cancel(); filterGeneration++; detailGeneration++; clearTimeout(filterTimer); clearTimeout(queryTimer);clearTimeout(featureTimer); }
    function message(value) { text("lib-status", value);el("catalog-retry").hidden=true; }
    function failed(value){if(state)state.error=value;message(value);el("catalog-retry").hidden=!state||!!detail||!!state.settings;}
    function remember() {
      if (!state) return;
      state.scroll = el("library").scrollTop; state.focus = document.activeElement;
      stack.push({state:state, detail:detail, season:season, episodePage:episodePage});
      if (stack.length > 8) stack.shift();
    }
    function highlight() {
      ["lib-home","load-live","load-movies","load-series","lib-favorites","lib-watchlist","lib-continue","lib-profiles","lib-settings"].forEach(function (button) {
        var selected = (button==="lib-profiles"&&!el("profiles-view").hidden)||state && ((state.home && button === "lib-home") || (state.favorites && button === "lib-favorites") || (state.watchlist && button === "lib-watchlist") || (state.continuing && button === "lib-continue") || (state.settings && button === "lib-settings") || (!state.home && !state.favorites && !state.watchlist && !state.continuing && !state.settings && button === (state.kind === "live" ? "load-live" : state.kind === "series" ? "load-series" : "load-movies")));
        el(button).classList.toggle("selected",!!selected);
        if (selected) el(button).setAttribute("aria-current", "page"); else el(button).removeAttribute("aria-current");
      });
    }
    function parentCategory(value){var entry=state.categories.filter(function(c){return String(c.category_id)===value;})[0];var parent=entry&&String(entry.parent_id||entry.parent_category_id||"");return parent&&parent!=="0"?parent:"";}
    function mother(){return el(state&&state.home?"lib-home":state&&state.favorites?"lib-favorites":state&&state.continuing?"lib-continue":state&&state.watchlist?"lib-watchlist":state&&state.kind==="live"?"load-live":state&&state.kind==="series"?"load-series":"load-movies");}
    function compact(value){el("library").classList.toggle("nav-auto",!!state&&state.kind!=="live"&&!state.settings);el("library").classList.toggle("nav-compact",!!value&&!!state&&state.kind!=="live"&&!state.settings);}
    document.querySelector(".tv-sidebar").addEventListener("mouseenter",function(){compact(false);});
    document.querySelector(".tv-sidebar").addEventListener("mouseleave",function(){compact(true);});
    document.addEventListener("focusin",function(event){if(el("library").hidden||!el("profiles-view").hidden)return;compact(!document.querySelector(".tv-sidebar").contains(event.target));});
    function sidebar() {
      var show = subMenu && state && !state.home && !state.settings && !state.favorites && !state.watchlist && !state.continuing;
      el("sidebar-categories").hidden = !show;
      el("library").classList.toggle("tv-category-menu",!!show&&state.kind==="live");
      ["load-live","load-movies","load-series"].forEach(function(button){el(button).hidden=!!show&&state.kind!=="live";});
      if (!show) return;
      text("sidebar-title",categoryParent?(state.categories.filter(function(c){return String(c.category_id)===categoryParent;})[0]||{}).category_name||label(state.kind):label(state.kind));
      text("sidebar-main",categoryParent?"← Categorias de TV":"← Menu principal");
      var list=el("sidebar-category-list"),oldFocus=document.activeElement,hadFocus=list.contains(oldFocus),oldValue=hadFocus?oldFocus.getAttribute("data-category-id"):null;list.textContent="";
      var groups=state.categories;
      if(state.kind==="live")groups=groups.filter(function(c){var parent=String(c.parent_id||c.parent_category_id||"");return categoryParent?parent===categoryParent:!parent||parent==="0"||!state.categories.some(function(other){return String(other.category_id)===parent;});});
      [{category_id:"",category_name:categoryParent?"Todos nesta categoria":"Todos os conteúdos"}].concat(groups).forEach(function(category){
        var button=document.createElement("button"),value=String(category.category_id);
        button.textContent=category.category_name||"Categoria sem nome";button.setAttribute("data-nav","");button.setAttribute("data-category-id",value);
        button.className=state.category===value?"selected":"";
        if(state.category===value)button.setAttribute("aria-current","true");
        button.addEventListener("click",function(){if(state.kind==="live"&&value&&state.categories.some(function(c){return String(c.parent_id||c.parent_category_id||"")===value;})){categoryParent=value;sidebar();focus(list.querySelector("button"));return;}state.category=value||categoryParent;el("lib-category").value=value;filter(false);
          var buttons=list.querySelectorAll("button");for(var i=0;i<buttons.length;i++){buttons[i].className=buttons[i]===button?"selected":"";buttons[i].removeAttribute("aria-current");}button.setAttribute("aria-current","true");
        });list.appendChild(button);
        if(hadFocus&&oldValue===value)focus(button);
      });
    }
    function sectionFocus(){return subMenu?el("sidebar-category-list").querySelector("button"):el(state.home?"lib-home":state.kind==="live"?"load-live":state.kind==="series"?"load-series":"load-movies");}
    function browse() {
      el("profiles-view").hidden=true;
      detail = null; el("settings-view").hidden = true; el("browse-view").hidden = false; el("details-view").hidden = true;
      el("search-open").disabled=false; el("search-panel").hidden=!state.searchOpen;
      el("lib-search").disabled = false; el("lib-search").value = state.query;
      el("library").className = state.kind === "live" ? "live-library" : "nav-auto";
      text("catalog-title", state.searchOpen ? "Resultados" : state.continuing ? "Continue" : state.watchlist ? "Minha lista" : state.favorites ? "Seus favoritos" : state.home ? "Explore seus filmes" : label(state.kind));
      text("section-label", state.continuing ? "DE ONDE VOCÊ PAROU" : state.favorites ? "SUA SELEÇÃO" : "DA SUA LISTA");
      var typeButtons=el("continue-types").querySelectorAll("button");for(var typeIndex=0;typeIndex<typeButtons.length;typeIndex++)typeButtons[typeIndex].setAttribute("aria-pressed",typeButtons[typeIndex].getAttribute("data-continue-type")===state.category?"true":"false");
      el("continue-types").hidden=!state.continuing&&!state.favorites;el("favorite-tv-type").hidden=!state.favorites;el("continue-types").setAttribute("aria-label",state.favorites?"Categorias de favoritos":"Categorias de Continue");categoriesSelect(); highlight(); render();
    }
    function categoriesSelect(){
      var select = el("lib-category"); select.textContent = "";
      var all = document.createElement("option"); all.value = ""; all.textContent = state.favorites || state.watchlist || state.continuing ? "Todos os tipos" : "Todas as categorias"; select.appendChild(all);
      state.categories.forEach(function (category) {
        var option = document.createElement("option"); option.value = String(category.category_id); option.textContent = category.category_name || "Categoria sem nome"; select.appendChild(option);
      });
      select.value = state.category; sidebar();
    }
    function recentSeries(){
      var section=el("back-series"),list=el("back-series-list");list.textContent="";section.hidden=true;if(!state||!state.home||state.searchOpen||detail)return;
      var latest={},progress=hooks.shelf.progress();Object.keys(progress).forEach(function(k){var p=progress[k];if(k.indexOf("episode:")===0&&p.parentId&&p.updatedAt>0&&(!latest[p.parentId]||p.updatedAt>latest[p.parentId].updatedAt))latest[p.parentId]=p;});
      var ids=Object.keys(latest).sort(function(a,b){return latest[b].updatedAt-latest[a].updatedAt;}).slice(0,12);if(!ids.length)return;section.hidden=false;
      if(!catalogCache.series){text("back-series-status","Carregando suas últimas séries…");return;}
      var titles={};catalogCache.series.items.forEach(function(item){if(latest[String(item.series_id)])titles[String(item.series_id)]=item;});
      ids.forEach(function(id){var item=titles[id];if(!item)return;var button=document.createElement("button"),picture=document.createElement("span"),title=document.createElement("strong"),saved=latest[id];button.className="recent-series-card";button.setAttribute("data-nav","");button.setAttribute("data-series-id",id);picture.className="card-picture";image(picture,art(item));if(!picture.firstChild){var placeholder=document.createElement("span");placeholder.className="art-placeholder";placeholder.textContent="nex.";picture.appendChild(placeholder);}if(saved.position>0&&saved.duration>0){var bar=document.createElement("progress");bar.max=saved.duration;bar.value=saved.position;picture.appendChild(bar);}title.textContent=name(item);button.appendChild(picture);button.appendChild(title);button.addEventListener("focus",function(){clearTimeout(featureTimer);var captured=state;featureTimer=setTimeout(function(){if(state!==captured||detail)return;var copy={};Object.keys(item).forEach(function(k){copy[k]=item[k];});copy._nexKind="series";feature(copy);},110);});button.addEventListener("click",function(){open(item,"series");});list.appendChild(button);});
      text("back-series-status",list.firstChild?"":"As séries do histórico não estão disponíveis no catálogo atual.");
    }
    function homeVisible(){return !!state&&state.home&&!state.searchOpen&&!detail;}
    home=window.NexHome({visible:homeVisible,catalog:function(kind){return catalogCache[kind];},cache:function(kind,items){catalogCache[kind]={items:items,categories:[],categoriesLoaded:false};},request:function(kind,success,failure){hooks.request(D.api(hooks.config(),kind==="series"?"get_series":"get_live_streams"),function(value){success(D.records(value));},failure);},image:image,art:art,focus:focus,feature:function(item,kind){var copy={};Object.keys(item).forEach(function(k){copy[k]=item[k];});copy._nexKind=kind;feature(copy);},open:function(item,kind){if(kind==="live"){enter("live");homeLive=item;filter(true);}else open(item,kind);},loaded:recentSeries});
    function loadRecentSeries(){if(homeVisible())home.load();}
    function render() {
      var items = state.filtered, total = items.length, pages = Math.max(1, Math.ceil(total / pageSize));
      state.page = Math.max(0, Math.min(state.page, pages - 1));
      var list = el("catalog-list"); list.textContent = "";
      items.slice(state.page * pageSize, (state.page + 1) * pageSize).forEach(function (item) {
        var kind = item._nexKind || state.kind, button = document.createElement("button"), picture = document.createElement("span"), title = document.createElement("strong"), subtitle = document.createElement("small");
        button.className = "tv-card"+(kind==="live"&&key(item,kind)===liveKey?" selected-channel":""); button.setAttribute("data-nav", ""); button.setAttribute("data-content-id", id(item, kind));
        picture.className = kind==="live"?"card-picture channel-logo":"card-picture"; image(picture, art(item));
        if (!picture.firstChild) { var placeholder = document.createElement("span"); placeholder.className = "art-placeholder"; placeholder.textContent = kind === "live" ? "◉" : "nex."; picture.appendChild(placeholder); }
        var saved=hooks.shelf.progress()[key(item,kind)];
        if(saved&&saved.position>0&&saved.duration>0){var bar=document.createElement("span");bar.className="saved-progress";var fill=document.createElement("progress");fill.max=saved.duration;fill.value=saved.position;bar.appendChild(fill);picture.appendChild(bar);}
        title.textContent = name(item); subtitle.textContent = kind === "live" ? "AO VIVO" : item.year || (kind === "series" ? "Série" : "Filme");
        button.appendChild(picture); button.appendChild(title); button.appendChild(subtitle);
        button.addEventListener("focus",function(){
          clearTimeout(featureTimer);var captured=state;
          if(!detail&&!state.searchOpen&&!state.query&&!state.favorites&&!state.watchlist&&!state.continuing&&kind!=="live"){
            state.featureItem=item;text("feature-title",name(item));var selectedKey=key(item,kind),cached=featureCache[selectedKey]||{};
            text("feature-description",cached.plot||cached.description||item.plot||item.year||"Explore os detalhes e encontre sua próxima história.");
            text("feature-favorite",favorites[selectedKey]?"♥ Favoritado":"♡ Favoritar");text("feature-list",hooks.shelf.watchlist()[selectedKey]?"✓ Na minha lista":"＋ Minha lista");
            featureTimer=setTimeout(function(){if(captured===state&&!detail&&state.featureItem===item)feature(item);},110);
          }
        });
        button.addEventListener("click", function () { open(item, kind); if (kind === "live") { var old = list.querySelector(".selected-channel"); if (old) old.classList.remove("selected-channel"); button.classList.add("selected-channel"); } }); list.appendChild(button);
      });
      text("page-count", total ? (state.page * pageSize + 1) + "–" + Math.min(total, (state.page + 1) * pageSize) + " de " + total : "Nenhum conteúdo encontrado");
      el("page-prev").disabled = state.page === 0; el("page-next").disabled = state.page + 1 >= pages;
      var first = items[state.page * pageSize]; el("feature").hidden = !first || state.kind === "live" || !!state.searchOpen || !!state.query || !!state.favorites || !!state.watchlist || !!state.continuing;
      if(first)feature(first);recentSeries();el("library").classList.toggle("home-view",homeVisible());el("home-collections").hidden=!homeVisible();if(homeVisible())home.render();if(homeLive&&state.kind==="live"){var pending=homeLive;homeLive=null;var buttons=list.querySelectorAll("button");for(var liveIndex=0;liveIndex<buttons.length;liveIndex++)if(buttons[liveIndex].getAttribute("data-content-id")===id(pending,"live"))focus(buttons[liveIndex]);start(pending,"live",name(pending),true);}
    }
    function feature(item,info){
      var featureKey=(item._nexKind||state.kind)+":"+id(item,item._nexKind||state.kind);
      if(info){featureCache[featureKey]=info;var cachedKeys=Object.keys(featureCache);if(cachedKeys.length>16)delete featureCache[cachedKeys[0]];}
      el("feature-title").setAttribute("data-feature-key",featureKey);
      state.featureItem=item;info=info||featureCache[featureKey]||{};
      text("feature-favorite",favorites[featureKey]?"♥ Favoritado":"♡ Favoritar");text("feature-list",hooks.shelf.watchlist()[featureKey]?"✓ Na minha lista":"＋ Minha lista");
      text("feature-title",name(item));text("feature-label",state.home?"SEU UNIVERSO, NO SEU RITMO":"DA SUA LISTA");
      text("feature-description",info.plot||info.description||item.plot||item.year||"Explore os detalhes e encontre sua próxima história.");
      var backdrop=info.backdrop_path||item.backdrop_path;
      var artwork=Array.isArray(backdrop)&&backdrop[0]?backdrop[0]:art(item);
      if(el("feature-art").getAttribute("data-art")!==artwork){el("feature-art").setAttribute("data-art",artwork);image(el("feature-art"),artwork);}

    }

    function categoryMatches(item,current){var value=String(item.category_id||"");if(!current.category||value===current.category)return true;if(current.kind!=="live")return false;for(var depth=0;depth<current.categories.length;depth++){var entry=current.categories.filter(function(c){return String(c.category_id)===value;})[0];if(!entry)return false;value=String(entry.parent_id||entry.parent_category_id||"");if(!value)return false;if(value===current.category)return true;}return false;}
    function filter(restore) {
      var generation = ++filterGeneration, current = state, index = 0, result = [], query = state.query.toLowerCase();
      clearTimeout(filterTimer); message("Buscando no catálogo…");
      function chunk() {
        if (generation !== filterGeneration || current !== state) return;
        var end = Math.min(index + 1000, current.items.length);
        for (; index < end; index++) {
          var item = current.items[index];
          if ((categoryMatches(item,current) || ((current.favorites || current.continuing) && item._nexKind === current.category)) && (!query || name(item).toLowerCase().indexOf(query) !== -1)) result.push(item);
        }
        if (index < current.items.length) filterTimer = setTimeout(chunk, 0);
        else { current.filtered = result; if (!restore) current.page = 0; render(); message(result.length ? result.length + " conteúdos · Use as setas e OK para escolher." : "Nenhum conteúdo encontrado. Tente outra busca ou categoria.");if(!current.items.length&&!current.favorites&&!current.watchlist&&!current.continuing){failed("A fonte respondeu com zero registros nesta seção. Você pode tentar carregar novamente.");} }
      }
      chunk();
    }
    function enter(kind, home, favorite, continuing, watchlist) {
      if (!hooks.config()) return;
      remember(); hooks.stopPreview(); cancel(); detail = null;categoryParent="";compact(false); subMenu=!home&&!favorite&&!continuing&&!watchlist;searchContext=null;
      state = {kind:kind,home:!!home,favorites:!!favorite,watchlist:!!watchlist,continuing:!!continuing,items:[],filtered:[],categories:[],category:"",query:"",page:0,scroll:0};
      el("home").hidden = true; el("library").hidden = false; browse(); el("library").scrollTop = 0;
      if (favorite || continuing || watchlist) {
        state.categories = (continuing?[]:[{category_id:"live",category_name:"TV ao vivo"}]).concat([{category_id:"movie",category_name:"Filmes"},{category_id:"series",category_name:"Séries"}]);
        loadCollection(); return;
      }
      var captured=state;
      function featureMetadata(){
        var item=state.items[0];if(kind!=="movie"||!item||captured!==state)return;
        hooks.request(D.api(hooks.config(),"get_vod_info",id(item,kind)),function(value){if(captured===state&&!detail&&!state.query&&state.featureItem===item)feature(item,value&&value.info);loadRecentSeries();},function(){loadRecentSeries();});
      }
      function categories(){
        hooks.request(D.api(hooks.config(),kind==="live"?"get_live_categories":kind==="series"?"get_series_categories":"get_vod_categories"),function(value){
          if(captured!==state)return;
          var groups;try{groups=D.records(value);}catch(error){groups=[];}
          state.categories=groups.filter(function(x){return x.category_id!==undefined;});catalogCache[kind].categories=state.categories;catalogCache[kind].categoriesLoaded=true;categoriesSelect();featureMetadata();
        },function(){if(captured===state){if(state.items.length)message(state.items.length+" conteúdos carregados. As categorias não puderam ser consultadas; você pode usar a busca.");else failed("A fonte respondeu com zero registros nesta seção. Você pode tentar carregar novamente.");}if(captured===state)featureMetadata();});
      }
      if(catalogCache[kind]){
        state.items=catalogCache[kind].items;state.categories=catalogCache[kind].categories;browse();filter(false);if(!catalogCache[kind].categoriesLoaded)categories();else loadRecentSeries();
        focus(sectionFocus());return;
      }
      message("Carregando "+label(kind).toLowerCase()+"…");
      hooks.request(D.api(hooks.config(),kind==="live"?"get_live_streams":kind==="series"?"get_series":"get_vod_streams"),function(value){
        if(captured!==state)return;
        state.items=D.records(value);catalogCache[kind]={items:state.items,categories:[],categoriesLoaded:false};browse();filter(false);categories();
      });
      focus(sectionFocus());
    }
    function collection() {
      var items=[],progress=hooks.shelf.progress(),latest={},watchlist=hooks.shelf.watchlist();
      if(state.continuing)Object.keys(progress).forEach(function(pk){var entry=progress[pk];if(pk.indexOf("episode:")===0&&entry.parentId&&entry.position>0&&(!latest[entry.parentId]||entry.updatedAt>=latest[entry.parentId].updatedAt))latest[entry.parentId]={id:pk.slice(8),updatedAt:entry.updatedAt};});
      ["live","movie","series"].forEach(function(kind){
        if(state.continuing&&kind==="live")return;
        var cached=catalogCache[kind];if(!cached)return;
        cached.items.forEach(function(item){
          var k=key(item,kind),resumeId="";
          if(state.favorites&&!favorites[k]||state.watchlist&&!watchlist[k])return;
          if(state.continuing){if(kind==="movie"&&!(progress[k]&&progress[k].position>0))return;if(kind==="series"){var saved=latest[id(item,kind)];if(!saved)return;resumeId=saved.id;}}
          var copy={};Object.keys(item).forEach(function(field){copy[field]=item[field];});copy._nexKind=kind;copy._nexResumeEpisode=resumeId;items.push(copy);
        });
      });return items;
    }
    function loadCollection(){
      var captured=state, keys=state.continuing?Object.keys(hooks.shelf.progress()):state.watchlist?Object.keys(hooks.shelf.watchlist()):Object.keys(favorites), needed=[];
      keys.forEach(function(k){var kind=k.indexOf("episode:")===0?"series":k.split(":")[0];if((kind==="movie"||kind==="series"||kind==="live"&&!state.continuing)&&needed.indexOf(kind)===-1)needed.push(kind);});
      function next(){
        if(captured!==state)return;
        if(!needed.length){state.items=collection();browse();filter(false);focus(el(state.continuing?"lib-continue":state.watchlist?"lib-watchlist":"lib-favorites"));return;}
        var kind=needed.shift();if(catalogCache[kind]){next();return;}
        message("Recuperando "+label(kind).toLowerCase()+" da sua lista…");
        function catalog(categories){hooks.request(D.api(hooks.config(),kind==="live"?"get_live_streams":kind==="series"?"get_series":"get_vod_streams"),function(value){catalogCache[kind]={items:D.records(value),categories:categories};next();});}
        hooks.request(D.api(hooks.config(),kind==="live"?"get_live_categories":kind==="series"?"get_series_categories":"get_vod_categories"),function(value){catalog(Array.isArray(value)?value:[]);},function(){catalog([]);});
      }next();
    }
    function settingsView(){
      el("profiles-view").hidden=true;erasePending=false; subMenu=false; sidebar();
      el("browse-view").hidden=true;el("details-view").hidden=true;el("settings-view").hidden=false;el("lib-search").disabled=true;el("search-open").disabled=true;el("search-panel").hidden=true;el("library").className="";el("auto-next").checked=hooks.shelf.autoNext();el("settings-live-format").value=hooks.shelf.format();text("settings-status","");highlight();message("Preferências salvas nesta TV para seu perfil.");
    }
    function applyDetail(value) {
      if (!detail) return;
      var info = value && value.info || {}, item = detail.item;
      text("detail-description", info.plot || info.description || item.plot || "Sinopse não fornecida pela sua fonte.");
      var meta = [info.releaseDate || info.releasedate || item.year, info.duration, info.genre].filter(function (x) { return typeof x === "string" && x; });
      text("detail-meta", meta.join(" · "));
      var backdrop = info.backdrop_path;
      image(el("detail-art"), Array.isArray(backdrop) && backdrop.length ? backdrop[0] : art(item) || info.cover || info.movie_image);
      if (detail.kind === "movie" && value && value.movie_data) {
        detail.playItem = {};
        Object.keys(item).forEach(function (k) { detail.playItem[k] = item[k]; });
        ["stream_id","container_extension","direct_source"].forEach(function (k) { if (value.movie_data[k]) detail.playItem[k] = value.movie_data[k]; });
      }
      if (detail.kind === "series") {
        detail.episodes = value && value.episodes || {};
        var keys = Object.keys(detail.episodes).filter(function (k) { return Array.isArray(detail.episodes[k]); }).sort(function (a,b) { return Number(a) - Number(b); });

        season = keys.indexOf(season) !== -1 ? season : keys[0] || "";
        if(detail.resumeEpisode){keys.forEach(function(k){detail.episodes[k].forEach(function(ep,index){if(ep&&String(ep.id)===detail.resumeEpisode){season=k;episodePage=Math.floor(index/24);detail.resumeIndex=index;}});});}
        renderSeasonOptions(keys);renderEpisodes();
      }
    }
    function durationText(value){var seconds=Math.max(0,Math.floor(value||0)),minutes=Math.floor(seconds/60);return minutes?minutes+" min "+(seconds%60)+" s":seconds+" s";}
    function seriesProgress(){
      el("series-progress").hidden=true;if(!detail||detail.kind!=="series")return;
      text("detail-play","▶︎ Assistir episódio");
      var episodes=detail.episodes&&detail.episodes[season]||[],episode=null;
      for(var i=0;i<episodes.length;i++)if(episodes[i]&&String(episodes[i].id)===detail.resumeEpisode)episode=episodes[i];
      if(!episode)return;var saved=hooks.shelf.progress()[key(episode,"series")];if(!saved||saved.position<=2)return;
      el("series-progress").hidden=false;text("series-resume-title","Temporada "+season+" · "+name(episode));text("series-elapsed",durationText(saved.position)+" assistidos");
      var known=saved.duration>saved.position;el("series-resume-bar").hidden=!known;if(known){el("series-resume-bar").max=saved.duration;el("series-resume-bar").value=saved.position;}
      text("series-remaining",known?"Faltam "+durationText(saved.duration-saved.position):"Duração não disponível");text("detail-play","▶︎ Continuar episódio");
    }
    function closeResume(restore){var pending=resumePending;resumePending=null;el("resume-choice").hidden=true;if(restore&&pending)focus(pending.focus&&document.documentElement.contains(pending.focus)?pending.focus:el("detail-play"));}
    function askStart(item,kind,title){
      var saved=hooks.shelf.progress()[key(item,kind)];if(kind!=="series"||!saved||saved.position<=2||saved.duration>0&&saved.position>=saved.duration){start(item,kind,title);return;}
      resumePending={item:item,kind:kind,title:title,position:saved.position,focus:document.activeElement};text("resume-choice-title",title);text("resume-choice-time",durationText(saved.position)+" já assistidos"+(saved.duration>saved.position?" · Faltam "+durationText(saved.duration-saved.position):""));el("resume-choice").hidden=false;focus(el("resume-continue"));
    }
    el("resume-continue").addEventListener("click",function(){var pending=resumePending;if(!pending)return;closeResume(false);focus(el("detail-play"));start(pending.item,pending.kind,pending.title,false,pending.position);});
    el("resume-start").addEventListener("click",function(){var pending=resumePending;if(!pending)return;closeResume(false);focus(el("detail-play"));start(pending.item,pending.kind,pending.title,false,0);});
    el("resume-cancel").addEventListener("click",function(){closeResume(true);});
    function selectedSeason(){return el("season-options").querySelector('[aria-pressed="true"]')||el("season-options").querySelector("button");}
    function renderSeasonOptions(keys){
      var list=el("season-options");list.textContent="";
      keys.forEach(function(k){var button=document.createElement("button"),title=document.createElement("strong"),count=document.createElement("small");button.className="season-option";button.setAttribute("data-nav","");button.setAttribute("data-season",k);button.setAttribute("aria-pressed",k===season?"true":"false");title.textContent="Temporada "+k;var total=detail.episodes[k].filter(function(ep){return ep&&typeof ep==="object";}).length;count.textContent=total+(total===1?" episódio":" episódios");button.appendChild(title);button.appendChild(count);button.addEventListener("click",function(){season=k;episodePage=0;detail.resumeEpisode="";delete detail.resumeIndex;renderEpisodes();});list.appendChild(button);});
    }
    function renderEpisodes() {
      var list = el("episode-list"), items = (detail && detail.episodes && detail.episodes[season] || []).filter(function (item) { return item && typeof item === "object"; }), pages = Math.max(1, Math.ceil(items.length / 24));
      text("season-current",season?"Temporada "+season+" · "+items.length+(items.length===1?" episódio":" episódios"):"Temporadas não fornecidas pela fonte.");
      var seasonButtons=el("season-options").querySelectorAll("button");for(var seasonIndex=0;seasonIndex<seasonButtons.length;seasonIndex++)seasonButtons[seasonIndex].setAttribute("aria-pressed",seasonButtons[seasonIndex].getAttribute("data-season")===season?"true":"false");
      episodePage = Math.max(0, Math.min(episodePage, pages - 1)); list.textContent = "";
      items.slice(episodePage * 24, episodePage * 24 + 24).forEach(function (episode, index) {
        var button = document.createElement("button"), picture = document.createElement("span"), title = document.createElement("strong"), description = document.createElement("small"), info = D.episodeInfo(episode);
        button.className = "episode-card"; button.setAttribute("data-nav", "");button.setAttribute("data-episode-id",String(episode.id)); picture.className = "episode-image"; image(picture, D.episodeArt(episode,hooks.config().server),"episode-still");
        if (!picture.firstChild){picture.classList.add("episode-placeholder");picture.textContent="Imagem não fornecida";}
        title.textContent = (episode.episode_num || episodePage * 24 + index + 1) + ". " + name(episode); description.textContent = info.plot || info.duration || "Episódio da sua fonte";
        button.appendChild(picture); button.appendChild(title); button.appendChild(description);
        button.addEventListener("click", function () { askStart(episode, "series", name(episode)); }); list.appendChild(button);
      });
      text("episode-count", items.length ? "Página " + (episodePage + 1) + " de " + pages + " · " + items.length + " episódios" : "Episódios não fornecidos pela fonte.");
      el("episode-prev").disabled = episodePage === 0; el("episode-next").disabled = episodePage + 1 >= pages;
      el("detail-play").disabled = !items.length;seriesProgress();
    }
    function detailView() {
      el("profiles-view").hidden=true;
      el("settings-view").hidden = true; el("browse-view").hidden = true; el("details-view").hidden = false; el("lib-search").disabled = true;el("search-open").disabled=true;el("search-panel").hidden=true;
      el("library").className = "nav-auto"; text("detail-title", name(detail.item)); text("detail-kind", label(detail.kind));
      el("seasons").hidden = detail.kind !== "series"; el("detail-play").disabled = detail.kind === "series";
      text("detail-play", detail.kind === "series" ? "▶︎ Assistir episódio" : hooks.progress(key(detail.item, detail.kind)) > 5 ? "▶︎ Continuar assistindo" : "▶︎ Assistir");
      text("detail-favorite", favorites[key(detail.item, detail.kind)] ? "♥ Favoritado" : "♡ Favoritar");
      applyDetail(detail.value);seriesProgress();highlight();
    }
    function open(item, kind) {
      if (kind === "live") { start(item, kind, name(item), true); return; }
      remember(); cancel(); season = ""; episodePage = 0; detail = {item:item,kind:kind,value:null,playItem:item,resumeEpisode:item._nexResumeEpisode||""};
      if(kind==="series"&&!detail.resumeEpisode){var savedProgress=hooks.shelf.progress(),latestTime=-1;Object.keys(savedProgress).forEach(function(k){var entry=savedProgress[k];if(k.indexOf("episode:")===0&&entry.parentId===id(item,"series")&&entry.position>2&&entry.updatedAt>=latestTime){detail.resumeEpisode=k.slice(8);latestTime=entry.updatedAt;}});}
      detailView(); message("Buscando informações…"); el("library").scrollTop = 0; focus(el("lib-back"));
      var generation = ++detailGeneration, identifier = id(item, kind);
      if (!/^\d{1,20}$/.test(identifier)) { message("Identificador não fornecido pela fonte."); return; }
      hooks.request(D.api(hooks.config(), kind === "series" ? "get_series_info" : "get_vod_info", identifier), function (value) {
        if (generation !== detailGeneration || !detail) return;
        detail.value = value; applyDetail(value);if(kind==="series"&&document.activeElement===el("lib-back"))focus(selectedSeason());message("Escolha o que assistir.");
        window.NexTmdb.lookup(item, kind, value && value.info || {}, function (metadata) {
          if (generation !== detailGeneration || !detail || !metadata) return;
          var info = value && value.info || {};
          if (!info.plot && !info.description && !item.plot && metadata.overview) text("detail-description", metadata.overview);
          var artwork = window.NexTmdb.image(metadata.backdrop_path);
          if (artwork) image(el("detail-art"), artwork);
          message("Escolha o que assistir. Metadados complementares: TMDB.");
        });
      });
    }
    function start(item, kind, title, preview, resumePosition) {
      try {
        if(kind==="live")liveKey=key(item,kind);
        hooks.play(D.stream(hooks.config(), kind, item, el("live-format").value), title, kind, preview, key(item, kind), kind === "series" && detail ? id(detail.item,"series") : "", kind === "live" && /^\d{1,20}$/.test(String(item.stream_id)) ? D.api(hooks.config(),"get_short_epg",String(item.stream_id))+"&limit=20" : "",resumePosition);
        hooks.favorite(kind === "live" ? function () { return toggleFavorite(item, kind); } : null, !!favorites[key(item, kind)]);
        var next = null;
        if (kind === "series" && detail && detail.value) {
          var episodes = D.episodes(detail.value);
          for (var i = 0; i < episodes.length - 1; i++) if (String(episodes[i].id) === String(item.id)) { next = episodes[i + 1]; break; }
        }
        hooks.next(next ? function () { start(next, "series", name(next)); } : null);
      }
      catch (error) { message(error.message); }
    }
    function back() {
      if(resumePending){closeResume(true);return;}
      if(!el("profiles-view").hidden){if(profiles.back())return;state=null;enter("movie",true);stack=[];return;}
      if(state&&state.searchOpen&&!detail){closeSearch();return;}
      if(state&&!detail&&!state.settings){if(categoryParent){categoryParent=parentCategory(categoryParent);sidebar();focus(el("sidebar-category-list").querySelector("button"));return;}if(!document.querySelector(".tv-sidebar").contains(document.activeElement)){subMenu=false;sidebar();compact(false);focus(mother());return;}}
      if(subMenu&&!detail&&document.querySelector(".tv-sidebar").contains(document.activeElement)){subMenu=false;sidebar();focus(el(state.kind==="live"?"load-live":state.kind==="series"?"load-series":"load-movies"));return;}
      cancel();
      if (stack.length) {
        var previous = stack.pop(); state = previous.state;searchContext=state.searchContext||null; detail = previous.detail; season = previous.season; episodePage = previous.episodePage;
        el("home").hidden = true; el("library").hidden = false;
        if(state.settings)settingsView();else if (detail) detailView(); else { if (state.favorites || state.watchlist || state.continuing) state.items = collection(); browse(); if (state.favorites || state.watchlist || state.continuing) filter(true); }
        if(homeVisible())loadRecentSeries();if(state.error)failed(state.error);else message("Use as setas e OK para escolher."); el("library").scrollTop = state.scroll || 0;
        focus(state.focus && document.documentElement.contains(state.focus) ? state.focus : el("lib-back"));
      } else if (state && !state.home) enter("movie", true, false);
      else { message("Você está no início. Acesse Minha fonte para trocar ou desconectar sua lista."); focus(el("lib-home")); }
    }
    function showProfiles(){
      if(!hooks.config())return;hooks.stopPreview();cancel();detail=null;state=null;stack=[];searchContext=null;subMenu=false;sidebar();el("home").hidden=true;el("library").hidden=false;el("library").className="profile-mode";el("profiles-view").hidden=false;el("browse-view").hidden=true;el("details-view").hidden=true;el("settings-view").hidden=true;el("search-open").disabled=true;el("lib-search").disabled=true;el("library").scrollTop=0;profiles.open();highlight();message("Escolha seu perfil para continuar.");
    }
    profiles=window.NexProfiles(hooks.shelf,{select:function(id){hooks.stopPreview();cancel();if(!hooks.shelf.selectProfile(id)){el("profile-status").hidden=false;text("profile-status","Não foi possível selecionar o perfil nesta TV.");return;}favorites=hooks.shelf.favorites();stack=[];state=null;detail=null;searchContext=null;liveKey="";el("live-format").value=hooks.shelf.format();var names=hooks.shelf.profiles();for(var i=0;i<names.length;i++)if(names[i].id===id){text("active-profile-label",names[i].name);el("active-profile-avatar").className="avatar-art "+(names[i].avatar||"avatar-1");}enter("movie",true);stack=[];}});
    el("lib-profiles").addEventListener("click",showProfiles);
    var continueButtons=el("continue-types").querySelectorAll("button");for(var continueIndex=0;continueIndex<continueButtons.length;continueIndex++)continueButtons[continueIndex].addEventListener("click",function(){if(state&&(state.continuing||state.favorites)){state.category=this.getAttribute("data-continue-type");el("lib-category").value=state.category;filter(false);for(var i=0;i<continueButtons.length;i++)continueButtons[i].setAttribute("aria-pressed",continueButtons[i]===this?"true":"false");}});
    el("catalog-retry").addEventListener("click",function(){if(state){var previous=state;state=null;if(previous.favorites||previous.watchlist||previous.continuing)catalogCache={};else delete catalogCache[previous.kind];enter(previous.kind,previous.home,previous.favorites,previous.continuing,previous.watchlist);}});
    el("sidebar-main").addEventListener("click",function(){if(categoryParent){categoryParent=parentCategory(categoryParent);sidebar();focus(el("sidebar-category-list").querySelector("button"));return;}subMenu=false;sidebar();focus(el(state.kind==="live"?"load-live":state.kind==="series"?"load-series":"load-movies"));});
    el("load-live").addEventListener("click", function () { enter("live"); });
    el("load-movies").addEventListener("click", function () { enter("movie"); });
    el("load-series").addEventListener("click", function () { enter("series"); });
    el("lib-home").addEventListener("click", function () { stack = []; enter("movie", true); stack = []; });
    el("lib-continue").addEventListener("click",function(){enter("movie",false,false,true);});
    el("tmdb-connect").addEventListener("click",function(){
      var input=el("tmdb-token"),value=input.value;input.value="";text("tmdb-status","Conectando ao TMDB…");
      window.NexTmdb.configure(value,function(ok){text("tmdb-status",ok?"TMDB conectado nesta sessão. Abra um filme ou série para consultar seus dados.":"Não foi possível conectar ao TMDB. Verifique token, conexão e permissão de acesso à API.");});
    });
    el("tmdb-disconnect").addEventListener("click",function(){window.NexTmdb.clear();el("tmdb-token").value="";text("tmdb-status","TMDB desconectado.");});
    el("lib-settings").addEventListener("click",function(){remember();hooks.stopPreview();cancel();state={kind:"movie",settings:true};detail=null;settingsView();focus(el("auto-next"));});
    el("settings-live-format").addEventListener("change",function(){hooks.shelf.format(this.value);el("live-format").value=this.value;});
    el("auto-next").addEventListener("change",function(){hooks.shelf.autoNext(this.checked);});
    el("refresh-catalog").addEventListener("click",function(){catalogCache={};enter("movie",true);});
    var erasePending=false;
    el("erase-library").addEventListener("click",function(){if(!erasePending){erasePending=true;text("settings-status","Pressione o botão novamente para confirmar a exclusão de favoritos e progresso deste perfil.");return;}hooks.shelf.erase();favorites=hooks.shelf.favorites();erasePending=false;text("settings-status","Favoritos, Minha lista e progresso deste perfil foram apagados.");});
    el("lib-watchlist").addEventListener("click",function(){enter("movie",false,false,false,true);});
    el("lib-favorites").addEventListener("click", function () { enter("movie", false, true); });
    el("lib-source").addEventListener("click", function () { remember(); hooks.stopPreview(); cancel(); el("library").hidden = true; el("home").hidden = false; el("new-source").hidden=false;el("vault-login").hidden=true; focus(el("server")); });
    el("lib-back").addEventListener("click", function () { if (!hooks.stopPreview()) back(); });
    el("lib-category").addEventListener("change", function () { state.category = this.value; filter(false); });
    function closeSearch(){
      if(!searchContext)return;
      var saved=searchContext;searchContext=null;delete state.searchContext;state.searchOpen=false;state.query=saved.query;state.category=saved.category;state.page=saved.page;
      filterGeneration++;clearTimeout(filterTimer);clearTimeout(queryTimer);state.filtered=saved.filtered;browse();filter(true);if(homeVisible())loadRecentSeries();if(saved.featureItem)feature(saved.featureItem);focus(el("search-open"));
    }
    el("search-open").addEventListener("click",function(){
      if(!state||detail||state.settings)return;
      if(!state.searchOpen){searchContext={query:state.query,category:state.category,page:state.page,filtered:state.filtered,featureItem:state.featureItem};state.searchContext=searchContext;state.searchOpen=true;state.category="";state.query="";state.page=0;hooks.stopPreview();browse();filter(false);}
      text("search-title","Buscar em "+(state.watchlist?"Minha lista":state.favorites?"Favoritos":label(state.kind)));el("library").scrollTop=0;focus(el("lib-search"));
    });
    el("lib-search").addEventListener("focus",function(){this.parentNode.classList.add("search-focused");});
    el("lib-search").addEventListener("blur",function(){this.parentNode.classList.remove("search-focused");});
    el("lib-search").addEventListener("input", function () { state.query = this.value.trim(); clearTimeout(queryTimer); queryTimer = setTimeout(function () { filter(false); }, 180); });
    ["page-prev","page-next"].forEach(function (button) { el(button).addEventListener("click", function () { state.page += button === "page-prev" ? -1 : 1; render(); focus(el("catalog-list").querySelector("button")); }); });
    el("feature-open").addEventListener("click", function () { var item = state.featureItem || state.filtered[state.page * pageSize]; if (item) open(item, item._nexKind || state.kind); });
    el("feature-favorite").addEventListener("click",function(){if(state.featureItem){toggleFavorite(state.featureItem,state.featureItem._nexKind||state.kind);feature(state.featureItem);}});
    el("feature-list").addEventListener("click",function(){if(state.featureItem){var item=state.featureItem,k=key(item,item._nexKind||state.kind);hooks.shelf.list(k,!hooks.shelf.watchlist()[k]);feature(item);message("Minha lista atualizada nesta TV.");}});
    el("detail-play").addEventListener("click", function () { if (!detail) return; var item = detail.kind === "series" ? (detail.episodes[season] || [])[detail.resumeIndex !== undefined ? detail.resumeIndex : episodePage * 24] : detail.playItem; if (item) askStart(item, detail.kind, name(item)); });
    function toggleFavorite(item, kind) {
      var k = key(item, kind);
      hooks.shelf.favorite(k,!favorites[k]); favorites=hooks.shelf.favorites();
      if (detail) text("detail-favorite", favorites[k] ? "♥ Favoritado" : "♡ Favoritar");
      message("Favoritos salvos nesta TV para sua lista."); return !!favorites[k];
    }
    el("detail-favorite").addEventListener("click", function () { if (detail) toggleFavorite(detail.item, detail.kind); });

    ["episode-prev","episode-next"].forEach(function (button) { el(button).addEventListener("click", function () { episodePage += button === "episode-prev" ? -1 : 1; renderEpisodes(); focus(el("episode-list").querySelector("button")); }); });
    function refreshProgress(){
      if(!detail||detail.kind!=="series"||!detail.value)return null;
      var progress=hooks.shelf.progress(),latest="",stamp=-1;
      Object.keys(progress).forEach(function(k){var entry=progress[k];if(k.indexOf("episode:")===0&&entry.parentId===id(detail.item,"series")&&entry.position>2&&entry.updatedAt>=stamp){latest=k.slice(8);stamp=entry.updatedAt;}});
      if(!latest){detail.resumeEpisode="";delete detail.resumeIndex;seriesProgress();return null;}
      detail.resumeEpisode=latest;var keys=Object.keys(detail.episodes);keys.forEach(function(k){if(Array.isArray(detail.episodes[k]))detail.episodes[k].forEach(function(ep,index){if(ep&&String(ep.id)===latest){season=k;episodePage=Math.floor(index/24);detail.resumeIndex=index;}});});
      renderSeasonOptions(keys);renderEpisodes();return /^\d{1,20}$/.test(latest)?el("episode-list").querySelector('[data-episode-id="'+latest+'"]'):selectedSeason();
    }
    function liveFocus(){
      var identifier=liveKey.slice(5);
      return /^\d{1,20}$/.test(identifier)?el("catalog-list").querySelector('[data-content-id="'+identifier+'"]'):null;
    }
    function zap(direction,current){
      if(!state||state.kind!=="live"||!state.filtered.length)return false;
      var items=state.filtered,index=-1;
      for(var i=0;i<items.length;i++)if(key(items[i],"live")===current){index=i;break;}
      if(index<0)return false;
      index=(index+direction+items.length)%items.length;
      if(items.length===1)return true;
      liveKey=key(items[index],"live");state.page=Math.floor(index/pageSize);render();start(items[index],"live",name(items[index]),false);return true;
    }
    function remote(code,active){
      if(home.remote(code,active))return true;
      if(active&&active.classList.contains("recent-series-card")){var recent=el("back-series-list").querySelectorAll("button"),recentIndex=Array.prototype.indexOf.call(recent,active);if(code===37){focus(recentIndex>0?recent[recentIndex-1]:mother());return true;}if(code===39){focus(recent[Math.min(recent.length-1,recentIndex+1)]);return true;}if(code===38){focus(homeVisible()?home.last():el("feature-open"));return true;}if(code===40){focus(homeVisible()?home.last():el("catalog-list").querySelector("button"));return true;}}

      if(resumePending){var choices=[el("resume-start"),el("resume-continue"),el("resume-cancel")],choiceIndex=choices.indexOf(active);if(code>=37&&code<=40){focus(choices[Math.max(0,Math.min(choices.length-1,choiceIndex+((code===39||code===40)?1:-1)))]);return true;}return false;}
      if(profiles.remote(code,active))return true;
      if(state&&(state.continuing||state.favorites)&&active&&active.hasAttribute("data-continue-type")){var typeTabs=Array.prototype.filter.call(el("continue-types").querySelectorAll("button"),function(button){return !button.hidden;}),tabIndex=typeTabs.indexOf(active);if(code===37||code===39){focus(typeTabs[Math.max(0,Math.min(typeTabs.length-1,tabIndex+(code===39?1:-1)))]);return true;}if(code===40){focus(el("catalog-list").querySelector("button"));return true;}if(code===38){focus(mother());return true;}}

      if(detail&&detail.kind==="series"){
        if(active===el("lib-back")&&code===40){focus(selectedSeason()||el("detail-play"));return true;}
        if((active===el("detail-play")||active===el("detail-favorite"))&&code===40){focus(selectedSeason());return true;}
        if(active&&active.classList.contains("season-option")){
          var seasons=el("season-options").querySelectorAll("button"),seasonPosition=Array.prototype.indexOf.call(seasons,active);
          if(code===37||code===39){focus(seasons[Math.max(0,Math.min(seasons.length-1,seasonPosition+(code===39?1:-1)))]);return true;}
          if(code===38){focus(el("detail-play").disabled?el("lib-back"):el("detail-play"));return true;}
          if(code===40){focus(el("episode-list").querySelector("button"));return true;}
        }
      }

      if(active===el("lib-search")){if(code===40){focus(el("catalog-list").querySelector("button"));return true;}if(code===38){focus(el("search-open"));return true;}return false;}
      if(active&&active.parentElement&&active.parentElement.classList.contains("feature-actions")){if(code===40){var selected=state.featureItem?el("catalog-list").querySelector('[data-content-id="'+id(state.featureItem,state.featureItem._nexKind||state.kind)+'"]'):null;focus(homeVisible()?home.first():!el("back-series").hidden?el("back-series-list").querySelector("button")||el("catalog-list").querySelector("button"):selected||el("catalog-list").querySelector("button"));return true;}}
      var side=document.querySelector(".tv-sidebar");
      if(side.contains(active)){
        if(code===39&&active.tagName!=="INPUT"){if(state&&state.kind==="live"&&subMenu&&!el("sidebar-categories").contains(active)){focus(el("sidebar-category-list").querySelector(".selected")||el("sidebar-category-list").querySelector("button"));return true;}var target=homeVisible()?home.first():!el("details-view").hidden?(detail&&detail.kind==="series"?selectedSeason():el("detail-play").disabled?el("episode-list").querySelector("button"):el("detail-play")):state&&(state.continuing||state.favorites)?el("continue-types").querySelector('[aria-pressed="true"]'):el("catalog-list").querySelector("button")||el("feature-open");focus(target);return true;}
        if(code===38||code===40){var buttons=side.querySelectorAll("[data-nav]"),visible=[];for(var i=0;i<buttons.length;i++)if(!buttons[i].hidden&&!buttons[i].disabled&&buttons[i].getClientRects().length)visible.push(buttons[i]);var index=visible.indexOf(active);focus(visible[Math.max(0,Math.min(visible.length-1,index+(code===40?1:-1)))]);return true;}
        if(code===37&&active.tagName!=="INPUT"){if(state&&state.kind==="live"&&el("sidebar-categories").contains(active))focus(mother());return true;}
      }
      if(active&&(active.classList.contains("tv-card")||active.classList.contains("episode-card"))){
        var list=active.parentElement,gridButtons=list.querySelectorAll("button"),rows=[],row=[],top=null,currentRow=0,currentColumn=0;
        for(var j=0;j<gridButtons.length;j++){
          if(top!==null&&Math.abs(gridButtons[j].offsetTop-top)>10){rows.push(row);row=[];}
          if(!row.length)top=gridButtons[j].offsetTop;
          row.push(gridButtons[j]);if(gridButtons[j]===active){currentRow=rows.length;currentColumn=row.length-1;}
        }
        if(row.length)rows.push(row);
        if(code===38||code===40){
          var targetRow=rows[currentRow+(code===40?1:-1)];
          if(targetRow){focus(targetRow[Math.min(currentColumn,targetRow.length-1)]);return true;}
          if(code===38&&state.page===0&&!active.classList.contains("episode-card")){if(state.searchOpen)focus(el("lib-search"));else if(state.continuing||state.favorites)focus(el("continue-types").querySelector('[aria-pressed="true"]'));else if(!el("back-series").hidden&&el("back-series-list").firstChild)focus(el("back-series-list").querySelector("button"));else if(!el("feature").hidden)focus(el("feature-open"));return true;}
          if(code===38&&active.classList.contains("episode-card")&&episodePage===0){focus(selectedSeason());return true;}
          var episodes=active.classList.contains("episode-card"),nextPage=code===40?(episodes?"episode-next":"page-next"):(episodes?"episode-prev":"page-prev");
          if(!el(nextPage).disabled){
            if(episodes){episodePage+=code===40?1:-1;renderEpisodes();}else{state.page+=code===40?1:-1;render();}
            var updated=list.querySelectorAll("button"),columns=rows[0].length,targetIndex=code===40?Math.min(currentColumn,updated.length-1):Math.min(Math.floor((updated.length-1)/columns)*columns+currentColumn,updated.length-1);
            focus(updated[targetIndex]);
          }
          return true;
        }
        if(code===37){if(currentColumn>0)focus(rows[currentRow][currentColumn-1]);else focus(subMenu?el("sidebar-category-list").querySelector(".selected")||el("sidebar-main"):el("lib-home"));return true;}
        if(code===39){if(currentColumn+1<rows[currentRow].length)focus(rows[currentRow][currentColumn+1]);else if(state.kind==="live"&&el("library").classList.contains("with-preview"))focus(el("expand-player"));return true;}
      }
      return false;
    }
    return {refreshProgress:refreshProgress,zap:zap,liveFocus:liveFocus,remote:remote,connect:function(){favorites=hooks.shelf.favorites();},enter:showProfiles, back:back, message:message, failed:failed, cancel:cancel,
      clear:function () { home.reset();window.NexArtwork.clear();cancel(); searchContext=null;state = null; detail = null; stack = []; favorites = {}; catalogCache = {};featureCache={}; el("profiles-view").hidden=true;el("library").hidden = true; el("home").hidden = false; el("catalog-list").textContent = ""; el("episode-list").textContent = ""; },
      sourceBack:function () { if (!state) return false; el("home").hidden = true; el("library").hidden = false; if(state.settings)settingsView();else if (detail) detailView(); else browse(); focus(el("lib-source")); return true; }};
  };
}());
