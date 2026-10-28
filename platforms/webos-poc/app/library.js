/* Biblioteca webOS: DOM limitado por página, estado de navegação só em memória. */
(function () {
  "use strict";
  window.NexLibrary = function (hooks) {
    var D = window.NexDomain, state = null, stack = [], favorites = {}, filterGeneration = 0, filterTimer, queryTimer;
    var catalogCache = {}, featureTimer,featureCache={}, subMenu=false, liveKey="", searchContext=null;
    var detail = null, detailGeneration = 0, season = "", episodePage = 0, pageSize = 48;
    function el(id) { return document.getElementById(id); }
    function text(id, value) { el(id).textContent = value || ""; }
    function focus(node) { window.NexNavigation.focus(node,true); }
    function label(kind) { return kind === "live" ? "TV ao vivo" : kind === "series" ? "Séries" : "Filmes"; }
    function name(item) { return String(item.name || item.title || "Título não fornecido"); }
    function id(item, kind) { return String(kind === "series" ? item.series_id : item.stream_id); }
    function key(item, kind) { return kind === "series" && item.series_id === undefined ? "episode:" + String(item.id) : kind + ":" + id(item, kind); }
    function image(parent, url, className) {
      parent.textContent = "";
      if (!url || typeof url !== "string") return;
      url=D.imageUrl(url,hooks.config()&&hooks.config().server);if(!url)return;
      var img = document.createElement("img"); img.alt = ""; img.className = className || ""; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () { if (img.parentNode) { var parent=img.parentNode;parent.removeChild(img);if(parent.classList.contains("card-picture")){var fallback=document.createElement("span");fallback.className="art-placeholder";fallback.textContent=parent.classList.contains("channel-logo")?"◉":"nex.";parent.appendChild(fallback);} } });
      img.src = url; parent.appendChild(img);
    }
    function art(item) { return item.stream_icon || item.logo || item["tvg-logo"] || item.cover || item.movie_image || ""; }
    function cancel() { hooks.cancel(); filterGeneration++; detailGeneration++; clearTimeout(filterTimer); clearTimeout(queryTimer);clearTimeout(featureTimer); }
    function message(value) { text("lib-status", value);el("catalog-retry").hidden=true; }
    function failed(value){if(state)state.error=value;message(value);el("catalog-retry").hidden=!state||!!detail||!!state.settings;}
    function remember() {
      if (!state) return;
      state.scroll = el("library").scrollTop; state.focus = document.activeElement;
      stack.push({state:state, detail:detail, season:season, episodePage:episodePage});
      if (stack.length > 8) stack.shift();
    }
    function highlight() {
      ["lib-home","load-live","load-movies","load-series","lib-favorites","lib-watchlist","lib-continue","lib-settings"].forEach(function (button) {
        var selected = state && ((state.home && button === "lib-home") || (state.favorites && button === "lib-favorites") || (state.watchlist && button === "lib-watchlist") || (state.continuing && button === "lib-continue") || (state.settings && button === "lib-settings") || (!state.home && !state.favorites && !state.watchlist && !state.continuing && !state.settings && button === (state.kind === "live" ? "load-live" : state.kind === "series" ? "load-series" : "load-movies")));
        el(button).className = selected ? "selected" : "";
        if (selected) el(button).setAttribute("aria-current", "page"); else el(button).removeAttribute("aria-current");
      });
    }
    function sidebar() {
      var show = subMenu && state && !state.home && !state.settings && !state.favorites && !state.watchlist && !state.continuing;
      el("sidebar-categories").hidden = !show;
      ["load-live","load-movies","load-series"].forEach(function(button){el(button).hidden=!!show;});
      if (!show) return;
      text("sidebar-title",label(state.kind));
      var list=el("sidebar-category-list"),oldFocus=document.activeElement,hadFocus=list.contains(oldFocus),oldValue=hadFocus?oldFocus.getAttribute("data-category-id"):null;list.textContent="";
      [{category_id:"",category_name:"Todos os conteúdos"}].concat(state.categories).forEach(function(category){
        var button=document.createElement("button"),value=String(category.category_id);
        button.textContent=category.category_name||"Categoria sem nome";button.setAttribute("data-nav","");button.setAttribute("data-category-id",value);
        button.className=state.category===value?"selected":"";
        if(state.category===value)button.setAttribute("aria-current","true");
        button.addEventListener("click",function(){state.category=value;el("lib-category").value=value;filter(false);
          var buttons=list.querySelectorAll("button");for(var i=0;i<buttons.length;i++){buttons[i].className=buttons[i]===button?"selected":"";buttons[i].removeAttribute("aria-current");}button.setAttribute("aria-current","true");
        });list.appendChild(button);
        if(hadFocus&&oldValue===value)focus(button);
      });
    }
    function sectionFocus(){return subMenu?el("sidebar-category-list").querySelector("button"):el(state.home?"lib-home":state.kind==="live"?"load-live":state.kind==="series"?"load-series":"load-movies");}
    function browse() {
      detail = null; el("settings-view").hidden = true; el("browse-view").hidden = false; el("details-view").hidden = true;
      el("search-open").disabled=false; el("search-panel").hidden=!state.searchOpen;
      el("lib-search").disabled = false; el("lib-search").value = state.query;
      el("library").className = state.kind === "live" ? "live-library" : "";
      text("catalog-title", state.searchOpen ? "Resultados" : state.continuing ? "Continuar assistindo" : state.watchlist ? "Minha lista" : state.favorites ? "Seus favoritos" : state.home ? "Explore seus filmes" : label(state.kind));
      text("section-label", state.continuing ? "DE ONDE VOCÊ PAROU" : state.favorites ? "SUA SELEÇÃO" : "DA SUA LISTA");
      categoriesSelect(); highlight(); render();
    }
    function categoriesSelect(){
      var select = el("lib-category"); select.textContent = "";
      var all = document.createElement("option"); all.value = ""; all.textContent = state.favorites || state.watchlist || state.continuing ? "Todos os tipos" : "Todas as categorias"; select.appendChild(all);
      state.categories.forEach(function (category) {
        var option = document.createElement("option"); option.value = String(category.category_id); option.textContent = category.category_name || "Categoria sem nome"; select.appendChild(option);
      });
      select.value = state.category; sidebar();
    }
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
      if(first)feature(first);
    }
    function feature(item,info){
      var featureKey=(item._nexKind||state.kind)+":"+id(item,item._nexKind||state.kind);
      if(info){featureCache[featureKey]=info;var cachedKeys=Object.keys(featureCache);if(cachedKeys.length>16)delete featureCache[cachedKeys[0]];}
      var changed=el("feature-title").getAttribute("data-feature-key")!==featureKey;el("feature-title").setAttribute("data-feature-key",featureKey);
      state.featureItem=item;info=info||featureCache[featureKey]||{};
      text("feature-favorite",favorites[featureKey]?"♥ Favoritado":"♡ Favoritar");text("feature-list",hooks.shelf.watchlist()[featureKey]?"✓ Na minha lista":"＋ Minha lista");
      text("feature-title",name(item));text("feature-label",state.home?"SEU UNIVERSO, NO SEU RITMO":"DA SUA LISTA");
      text("feature-description",info.plot||info.description||item.plot||item.year||"Explore os detalhes e encontre sua próxima história.");
      var backdrop=info.backdrop_path||item.backdrop_path;
      var artwork=Array.isArray(backdrop)&&backdrop[0]?backdrop[0]:art(item);
      if(el("feature-art").getAttribute("data-art")!==artwork){el("feature-art").setAttribute("data-art",artwork);image(el("feature-art"),artwork);}
      if(changed){var copy=document.querySelector(".feature-copy");copy.classList.remove("feature-updated");void copy.offsetWidth;copy.classList.add("feature-updated");}
    }

    function filter(restore) {
      var generation = ++filterGeneration, current = state, index = 0, result = [], query = state.query.toLowerCase();
      clearTimeout(filterTimer); message("Buscando no catálogo…");
      function chunk() {
        if (generation !== filterGeneration || current !== state) return;
        var end = Math.min(index + 1000, current.items.length);
        for (; index < end; index++) {
          var item = current.items[index];
          if ((!current.category || String(item.category_id) === current.category || ((current.favorites || current.continuing) && item._nexKind === current.category)) && (!query || name(item).toLowerCase().indexOf(query) !== -1)) result.push(item);
        }
        if (index < current.items.length) filterTimer = setTimeout(chunk, 0);
        else { current.filtered = result; if (!restore) current.page = 0; render(); message(result.length ? result.length + " conteúdos · Use as setas e OK para escolher." : "Nenhum conteúdo encontrado. Tente outra busca ou categoria.");if(!current.items.length&&!current.favorites&&!current.continuing){failed("A fonte respondeu com zero registros nesta seção. Você pode tentar carregar novamente.");} }
      }
      chunk();
    }
    function enter(kind, home, favorite, continuing, watchlist) {
      if (!hooks.config()) return;
      remember(); hooks.stopPreview(); cancel(); detail = null; subMenu=!home&&!favorite&&!continuing&&!watchlist;searchContext=null;
      state = {kind:kind,home:!!home,favorites:!!favorite,watchlist:!!watchlist,continuing:!!continuing,items:[],filtered:[],categories:[],category:"",query:"",page:0,scroll:0};
      el("home").hidden = true; el("library").hidden = false; browse(); el("library").scrollTop = 0;
      if (favorite || continuing || watchlist) {
        state.categories = [{category_id:"live",category_name:"TV ao vivo"},{category_id:"movie",category_name:"Filmes"},{category_id:"series",category_name:"Séries"}];
        loadCollection(); return;
      }
      var captured=state;
      function featureMetadata(){
        var item=state.items[0];if(kind!=="movie"||!item||captured!==state)return;
        hooks.request(D.api(hooks.config(),"get_vod_info",id(item,kind)),function(value){if(captured===state&&!detail&&!state.query&&state.featureItem===item)feature(item,value&&value.info);},function(){});
      }
      function categories(){
        hooks.request(D.api(hooks.config(),kind==="live"?"get_live_categories":kind==="series"?"get_series_categories":"get_vod_categories"),function(value){
          if(captured!==state)return;
          var groups;try{groups=D.records(value);}catch(error){groups=[];}
          state.categories=groups.filter(function(x){return x.category_id!==undefined;});catalogCache[kind].categories=state.categories;catalogCache[kind].categoriesLoaded=true;categoriesSelect();featureMetadata();
        },function(){if(captured===state){if(state.items.length)message(state.items.length+" conteúdos carregados. As categorias não puderam ser consultadas; você pode usar a busca.");else failed("A fonte respondeu com zero registros nesta seção. Você pode tentar carregar novamente.");}if(captured===state)featureMetadata();});
      }
      if(catalogCache[kind]){
        state.items=catalogCache[kind].items;state.categories=catalogCache[kind].categories;browse();filter(false);if(!catalogCache[kind].categoriesLoaded)categories();
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
      var items=[], progress=hooks.shelf.progress();
      ["live","movie","series"].forEach(function(kind){
        var cached=catalogCache[kind];if(!cached)return;
        cached.items.forEach(function(item){
          var k=key(item,kind),resumeId="",updated=0;
          if(state.favorites && !favorites[k])return;
          if(state.watchlist && !hooks.shelf.watchlist()[k])return;
          if(state.continuing){
            if(kind==="live")return;
            if(kind==="movie" && !(progress[k]&&progress[k].position>0))return;
            if(kind==="series"){
              Object.keys(progress).forEach(function(pk){var entry=progress[pk];if(pk.indexOf("episode:")===0 && entry.parentId===id(item,kind)&&entry.position>0&&entry.updatedAt>=updated){resumeId=pk.slice(8);updated=entry.updatedAt;}});
              if(!resumeId)return;
            }
          }
          var copy={};Object.keys(item).forEach(function(field){copy[field]=item[field];});copy._nexKind=kind;copy._nexResumeEpisode=resumeId;items.push(copy);
        });
      });return items;
    }
    function loadCollection(){
      var captured=state, keys=state.continuing?Object.keys(hooks.shelf.progress()):state.watchlist?Object.keys(hooks.shelf.watchlist()):Object.keys(favorites), needed=[];
      keys.forEach(function(k){var kind=k.indexOf("episode:")===0?"series":k.split(":")[0];if((kind==="live"||kind==="movie"||kind==="series")&&needed.indexOf(kind)===-1)needed.push(kind);});
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
      erasePending=false; subMenu=false; sidebar();
      el("browse-view").hidden=true;el("details-view").hidden=true;el("settings-view").hidden=false;el("lib-search").disabled=true;el("search-open").disabled=true;el("search-panel").hidden=true;el("library").className="";el("auto-next").checked=hooks.shelf.autoNext();el("settings-live-format").value=hooks.shelf.format();text("settings-status","");highlight();message("Preferências salvas nesta TV para sua lista.");
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
        var button = document.createElement("button"), picture = document.createElement("span"), title = document.createElement("strong"), description = document.createElement("small"), info = episode.info || {};
        button.className = "episode-card"; button.setAttribute("data-nav", ""); picture.className = "episode-image"; image(picture, info.movie_image || info.cover_big || episode.stream_icon);
        if (!picture.firstChild) picture.textContent = "▶";
        title.textContent = (episode.episode_num || episodePage * 24 + index + 1) + ". " + name(episode); description.textContent = info.plot || info.duration || "Episódio da sua fonte";
        button.appendChild(picture); button.appendChild(title); button.appendChild(description);
        button.addEventListener("click", function () { start(episode, "series", name(episode)); }); list.appendChild(button);
      });
      text("episode-count", items.length ? "Página " + (episodePage + 1) + " de " + pages + " · " + items.length + " episódios" : "Episódios não fornecidos pela fonte.");
      el("episode-prev").disabled = episodePage === 0; el("episode-next").disabled = episodePage + 1 >= pages;
      el("detail-play").disabled = !items.length;
    }
    function detailView() {
      el("settings-view").hidden = true; el("browse-view").hidden = true; el("details-view").hidden = false; el("lib-search").disabled = true;el("search-open").disabled=true;el("search-panel").hidden=true;
      el("library").className = ""; text("detail-title", name(detail.item)); text("detail-kind", label(detail.kind));
      el("seasons").hidden = detail.kind !== "series"; el("detail-play").disabled = detail.kind === "series";
      text("detail-play", detail.kind === "series" ? "▶︎ Assistir episódio" : hooks.progress(key(detail.item, detail.kind)) > 5 ? "▶︎ Continuar assistindo" : "▶︎ Assistir");
      text("detail-favorite", favorites[key(detail.item, detail.kind)] ? "♥ Favoritado" : "♡ Favoritar");
      applyDetail(detail.value); highlight();
    }
    function open(item, kind) {
      if (kind === "live") { start(item, kind, name(item), true); return; }
      remember(); cancel(); season = ""; episodePage = 0; detail = {item:item,kind:kind,value:null,playItem:item,resumeEpisode:item._nexResumeEpisode||""};
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
    function start(item, kind, title, preview) {
      try {
        if(kind==="live")liveKey=key(item,kind);
        hooks.play(D.stream(hooks.config(), kind, item, el("live-format").value), title, kind, preview, key(item, kind), kind === "series" && detail ? id(detail.item,"series") : "", kind === "live" && /^\d{1,20}$/.test(String(item.stream_id)) ? D.api(hooks.config(),"get_short_epg",String(item.stream_id))+"&limit=20" : "");
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
      if(state&&state.searchOpen&&!detail){closeSearch();return;}
      if(subMenu&&!detail&&document.querySelector(".tv-sidebar").contains(document.activeElement)){subMenu=false;sidebar();focus(el(state.kind==="live"?"load-live":state.kind==="series"?"load-series":"load-movies"));return;}
      cancel();
      if (stack.length) {
        var previous = stack.pop(); state = previous.state;searchContext=state.searchContext||null; detail = previous.detail; season = previous.season; episodePage = previous.episodePage;
        el("home").hidden = true; el("library").hidden = false;
        if(state.settings)settingsView();else if (detail) detailView(); else { if (state.favorites || state.watchlist || state.continuing) state.items = collection(); browse(); if (state.favorites || state.watchlist || state.continuing) filter(true); }
        if(state.error)failed(state.error);else message("Use as setas e OK para escolher."); el("library").scrollTop = state.scroll || 0;
        focus(state.focus && document.documentElement.contains(state.focus) ? state.focus : el("lib-back"));
      } else if (state && !state.home) enter("movie", true, false);
      else { message("Você está no início. Acesse Minha fonte para trocar ou desconectar sua lista."); focus(el("lib-home")); }
    }
    el("catalog-retry").addEventListener("click",function(){if(state){var previous=state;state=null;if(previous.favorites||previous.watchlist||previous.continuing)catalogCache={};else delete catalogCache[previous.kind];enter(previous.kind,previous.home,previous.favorites,previous.continuing,previous.watchlist);}});
    el("sidebar-main").addEventListener("click",function(){subMenu=false;sidebar();focus(el(state.kind==="live"?"load-live":state.kind==="series"?"load-series":"load-movies"));});
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
    el("erase-library").addEventListener("click",function(){if(!erasePending){erasePending=true;text("settings-status","Pressione o botão novamente para confirmar a exclusão de favoritos e progresso desta lista.");return;}hooks.shelf.erase();favorites=hooks.shelf.favorites();erasePending=false;text("settings-status","Favoritos e progresso desta lista foram apagados.");});
    el("lib-watchlist").addEventListener("click",function(){enter("movie",false,false,false,true);});
    el("lib-favorites").addEventListener("click", function () { enter("movie", false, true); });
    el("lib-source").addEventListener("click", function () { remember(); hooks.stopPreview(); cancel(); el("library").hidden = true; el("home").hidden = false; el("new-source").hidden=false;el("vault-login").hidden=true; focus(el("server")); });
    el("lib-back").addEventListener("click", function () { if (!hooks.stopPreview()) back(); });
    el("lib-category").addEventListener("change", function () { state.category = this.value; filter(false); });
    function closeSearch(){
      if(!searchContext)return;
      var saved=searchContext;searchContext=null;delete state.searchContext;state.searchOpen=false;state.query=saved.query;state.category=saved.category;state.page=saved.page;
      filterGeneration++;clearTimeout(filterTimer);clearTimeout(queryTimer);state.filtered=saved.filtered;browse();if(saved.featureItem)feature(saved.featureItem);focus(el("search-open"));
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
    el("detail-play").addEventListener("click", function () { if (!detail) return; var item = detail.kind === "series" ? (detail.episodes[season] || [])[detail.resumeIndex !== undefined ? detail.resumeIndex : episodePage * 24] : detail.playItem; if (item) start(item, detail.kind, name(item)); });
    function toggleFavorite(item, kind) {
      var k = key(item, kind);
      hooks.shelf.favorite(k,!favorites[k]); favorites=hooks.shelf.favorites();
      if (detail) text("detail-favorite", favorites[k] ? "♥ Favoritado" : "♡ Favoritar");
      message("Favoritos salvos nesta TV para sua lista."); return !!favorites[k];
    }
    el("detail-favorite").addEventListener("click", function () { if (detail) toggleFavorite(detail.item, detail.kind); });

    ["episode-prev","episode-next"].forEach(function (button) { el(button).addEventListener("click", function () { episodePage += button === "episode-prev" ? -1 : 1; renderEpisodes(); focus(el("episode-list").querySelector("button")); }); });
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
      if(active&&active.parentElement&&active.parentElement.classList.contains("feature-actions")){if(code===40){var selected=state.featureItem?el("catalog-list").querySelector('[data-content-id="'+id(state.featureItem,state.featureItem._nexKind||state.kind)+'"]'):null;focus(selected||el("catalog-list").querySelector("button"));return true;}}
      var side=document.querySelector(".tv-sidebar");
      if(side.contains(active)){
        if(code===39&&active.tagName!=="INPUT"){var target=!el("details-view").hidden?(detail&&detail.kind==="series"?selectedSeason():el("detail-play").disabled?el("episode-list").querySelector("button"):el("detail-play")):el("catalog-list").querySelector("button")||el("feature-open");focus(target);return true;}
        if(code===38||code===40){var buttons=side.querySelectorAll("[data-nav]"),visible=[];for(var i=0;i<buttons.length;i++)if(!buttons[i].hidden&&!buttons[i].disabled&&buttons[i].getClientRects().length)visible.push(buttons[i]);var index=visible.indexOf(active);focus(visible[Math.max(0,Math.min(visible.length-1,index+(code===40?1:-1)))]);return true;}
        if(code===37&&active.tagName!=="INPUT")return true;
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
          if(code===38&&state.page===0&&!active.classList.contains("episode-card")){if(state.searchOpen)focus(el("lib-search"));else if(!el("feature").hidden)focus(el("feature-open"));return true;}
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
        if(code===39){if(currentColumn+1<rows[currentRow].length)focus(rows[currentRow][currentColumn+1]);return true;}
      }
      return false;
    }
    return {zap:zap,liveFocus:liveFocus,remote:remote,connect:function(){favorites=hooks.shelf.favorites();},enter:function () { stack = []; enter("movie", true); stack = []; }, back:back, message:message, failed:failed, cancel:cancel,
      clear:function () { cancel(); searchContext=null;state = null; detail = null; stack = []; favorites = {}; catalogCache = {};featureCache={}; el("library").hidden = true; el("home").hidden = false; el("catalog-list").textContent = ""; el("episode-list").textContent = ""; },
      sourceBack:function () { if (!state) return false; el("home").hidden = true; el("library").hidden = false; if(state.settings)settingsView();else if (detail) detailView(); else browse(); focus(el("lib-source")); return true; }};
  };
}());
