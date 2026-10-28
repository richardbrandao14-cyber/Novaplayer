/* Biblioteca webOS: DOM limitado por página, estado de navegação só em memória. */
(function () {
  "use strict";
  window.NexLibrary = function (hooks) {
    var D = window.NexDomain, state = null, stack = [], favorites = {}, filterGeneration = 0, filterTimer, queryTimer;
    var detail = null, detailGeneration = 0, season = "", episodePage = 0, pageSize = 48;
    function el(id) { return document.getElementById(id); }
    function text(id, value) { el(id).textContent = value || ""; }
    function focus(node) { if (node) { node.focus(); if (node.scrollIntoViewIfNeeded) node.scrollIntoViewIfNeeded(false); } }
    function label(kind) { return kind === "live" ? "TV ao vivo" : kind === "series" ? "Séries" : "Filmes"; }
    function name(item) { return String(item.name || item.title || "Título não fornecido"); }
    function id(item, kind) { return String(kind === "series" ? item.series_id : item.stream_id); }
    function key(item, kind) { return kind === "series" && item.series_id === undefined ? "episode:" + String(item.id) : kind + ":" + id(item, kind); }
    function image(parent, url, className) {
      parent.textContent = "";
      if (!url || typeof url !== "string") return;
      try { url = D.httpUrl(url).href; } catch (error) { return; }
      var img = document.createElement("img"); img.alt = ""; img.className = className || ""; img.referrerPolicy = "no-referrer";
      img.addEventListener("error", function () { if (img.parentNode) img.parentNode.removeChild(img); });
      img.src = url; parent.appendChild(img);
    }
    function art(item) { return item.stream_icon || item.cover || item.movie_image || ""; }
    function cancel() { hooks.cancel(); filterGeneration++; detailGeneration++; clearTimeout(filterTimer); clearTimeout(queryTimer); }
    function message(value) { text("lib-status", value); }
    function remember() {
      if (!state) return;
      state.scroll = el("library").scrollTop; state.focus = document.activeElement;
      stack.push({state:state, detail:detail, season:season, episodePage:episodePage});
      if (stack.length > 8) stack.shift();
    }
    function highlight() {
      ["lib-home","load-live","load-movies","load-series","lib-favorites"].forEach(function (button) {
        var selected = state && ((state.home && button === "lib-home") || (state.favorites && button === "lib-favorites") || (!state.home && !state.favorites && button === (state.kind === "live" ? "load-live" : state.kind === "series" ? "load-series" : "load-movies")));
        el(button).className = selected ? "selected" : "";
        if (selected) el(button).setAttribute("aria-current", "page"); else el(button).removeAttribute("aria-current");
      });
    }
    function browse() {
      detail = null; el("browse-view").hidden = false; el("details-view").hidden = true;
      el("lib-search").disabled = false; el("lib-search").value = state.query;
      el("library").className = state.kind === "live" ? "live-library" : "";
      text("catalog-title", state.favorites ? "Seus favoritos" : state.home ? "Explore seus filmes" : label(state.kind));
      text("section-label", state.favorites ? "SALVOS NESTA SESSÃO" : "DA SUA LISTA");
      var select = el("lib-category"); select.textContent = "";
      var all = document.createElement("option"); all.value = ""; all.textContent = state.favorites ? "Todos os tipos" : "Todas as categorias"; select.appendChild(all);
      state.categories.forEach(function (category) {
        var option = document.createElement("option"); option.value = String(category.category_id); option.textContent = category.category_name || "Categoria sem nome"; select.appendChild(option);
      });
      select.value = state.category; highlight(); render();
    }
    function render() {
      var items = state.filtered, total = items.length, pages = Math.max(1, Math.ceil(total / pageSize));
      state.page = Math.max(0, Math.min(state.page, pages - 1));
      var list = el("catalog-list"); list.textContent = "";
      items.slice(state.page * pageSize, (state.page + 1) * pageSize).forEach(function (item) {
        var kind = item._nexKind || state.kind, button = document.createElement("button"), picture = document.createElement("span"), title = document.createElement("strong"), subtitle = document.createElement("small");
        button.className = "tv-card"; button.setAttribute("data-nav", ""); button.setAttribute("data-content-id", id(item, kind));
        picture.className = "card-picture"; image(picture, art(item));
        if (!picture.firstChild) { var placeholder = document.createElement("span"); placeholder.className = "art-placeholder"; placeholder.textContent = kind === "live" ? "◉" : "nex."; picture.appendChild(placeholder); }
        title.textContent = name(item); subtitle.textContent = kind === "live" ? "AO VIVO" : item.year || (kind === "series" ? "Série" : "Filme");
        button.appendChild(picture); button.appendChild(title); button.appendChild(subtitle);
        button.addEventListener("click", function () { open(item, kind); if (kind === "live") { var old = list.querySelector(".selected-channel"); if (old) old.classList.remove("selected-channel"); button.classList.add("selected-channel"); } }); list.appendChild(button);
      });
      text("page-count", total ? (state.page * pageSize + 1) + "–" + Math.min(total, (state.page + 1) * pageSize) + " de " + total : "Nenhum conteúdo encontrado");
      el("page-prev").disabled = state.page === 0; el("page-next").disabled = state.page + 1 >= pages;
      var first = items[state.page * pageSize]; el("feature").hidden = !first || state.kind === "live" || !!state.query || !!state.favorites;
      if (first) {
        text("feature-title", name(first)); text("feature-label", state.home ? "SUA PRÓXIMA ESCOLHA" : "DA SUA LISTA");
        text("feature-description", first.plot || first.year || "Descubra os detalhes e escolha o que assistir."); image(el("feature-art"), art(first));
      }
    }
    function filter(restore) {
      var generation = ++filterGeneration, current = state, index = 0, result = [], query = state.query.toLowerCase();
      clearTimeout(filterTimer); message("Buscando no catálogo…");
      function chunk() {
        if (generation !== filterGeneration || current !== state) return;
        var end = Math.min(index + 1000, current.items.length);
        for (; index < end; index++) {
          var item = current.items[index];
          if ((!current.category || String(item.category_id) === current.category || (current.favorites && item._nexKind === current.category)) && (!query || name(item).toLowerCase().indexOf(query) !== -1)) result.push(item);
        }
        if (index < current.items.length) filterTimer = setTimeout(chunk, 0);
        else { current.filtered = result; if (!restore) current.page = 0; render(); message(result.length ? result.length + " conteúdos · Use as setas e OK para escolher." : "Nenhum conteúdo encontrado. Tente outra busca ou categoria."); }
      }
      chunk();
    }
    function enter(kind, home, favorite) {
      if (!hooks.config()) return;
      remember(); hooks.stopPreview(); cancel(); detail = null;
      state = {kind:kind,home:!!home,favorites:!!favorite,items:[],filtered:[],categories:[],category:"",query:"",page:0,scroll:0};
      el("home").hidden = true; el("library").hidden = false; browse(); el("library").scrollTop = 0;
      if (favorite) {
        state.items = Object.keys(favorites).map(function (k) { return favorites[k]; });
        state.categories = [{category_id:"live",category_name:"TV ao vivo"},{category_id:"movie",category_name:"Filmes"},{category_id:"series",category_name:"Séries"}];
        browse(); filter(false); focus(el("lib-favorites")); return;
      }
      message("Carregando " + label(kind).toLowerCase() + "…");
      var captured = state, action = kind === "live" ? "get_live_streams" : kind === "series" ? "get_series" : "get_vod_streams";
      function catalog() {
        hooks.request(D.api(hooks.config(), action), function (value) {
          if (captured !== state) return;
          state.items = D.records(value); browse(); filter(false);
        });
      }
      hooks.request(D.api(hooks.config(), kind === "live" ? "get_live_categories" : kind === "series" ? "get_series_categories" : "get_vod_categories"), function (value) {
        if (captured !== state) return; captured.categories = Array.isArray(value) ? value.filter(function (x) { return x && x.category_id !== undefined; }) : []; catalog();
      }, function () { if (captured === state) catalog(); });
      focus(el(kind === "live" ? "load-live" : kind === "series" ? "load-series" : home ? "lib-home" : "load-movies"));
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
        el("season-select").textContent = "";
        keys.forEach(function (k) { var option = document.createElement("option"); option.value = k; option.textContent = "Temporada " + k; el("season-select").appendChild(option); });
        season = keys.indexOf(season) !== -1 ? season : keys[0] || ""; el("season-select").value = season; renderEpisodes();
      }
    }
    function renderEpisodes() {
      var list = el("episode-list"), items = (detail && detail.episodes && detail.episodes[season] || []).filter(function (item) { return item && typeof item === "object"; }), pages = Math.max(1, Math.ceil(items.length / 24));
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
      el("browse-view").hidden = true; el("details-view").hidden = false; el("lib-search").disabled = true;
      el("library").className = ""; text("detail-title", name(detail.item)); text("detail-kind", label(detail.kind));
      el("seasons").hidden = detail.kind !== "series"; el("detail-play").disabled = detail.kind === "series";
      text("detail-play", detail.kind === "series" ? "▶ Assistir episódio" : hooks.progress(key(detail.item, detail.kind)) > 5 ? "▶ Continuar assistindo" : "▶ Assistir");
      text("detail-favorite", favorites[key(detail.item, detail.kind)] ? "♥ Favoritado" : "♡ Favoritar");
      applyDetail(detail.value); highlight();
    }
    function open(item, kind) {
      if (kind === "live") { start(item, kind, name(item), true); return; }
      remember(); cancel(); season = ""; episodePage = 0; detail = {item:item,kind:kind,value:null,playItem:item};
      detailView(); message("Buscando informações…"); el("library").scrollTop = 0; focus(el("lib-back"));
      var generation = ++detailGeneration, identifier = id(item, kind);
      if (!/^\d{1,20}$/.test(identifier)) { message("Identificador não fornecido pela fonte."); return; }
      hooks.request(D.api(hooks.config(), kind === "series" ? "get_series_info" : "get_vod_info", identifier), function (value) {
        if (generation !== detailGeneration || !detail) return;
        detail.value = value; applyDetail(value); message("Escolha o que assistir.");
      });
    }
    function start(item, kind, title, preview) {
      try {
        hooks.play(D.stream(hooks.config(), kind, item, el("live-format").value), title, kind, preview, key(item, kind));
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
      cancel();
      if (stack.length) {
        var previous = stack.pop(); state = previous.state; detail = previous.detail; season = previous.season; episodePage = previous.episodePage;
        el("home").hidden = true; el("library").hidden = false;
        if (detail) detailView(); else { if (state.favorites) state.items = Object.keys(favorites).map(function (k) { return favorites[k]; }); browse(); if (state.favorites) filter(true); }
        message("Use as setas e OK para escolher."); el("library").scrollTop = state.scroll || 0;
        focus(state.focus && document.documentElement.contains(state.focus) ? state.focus : el("lib-back"));
      } else if (state && !state.home) enter("movie", true, false);
      else { message("Você está no início. Acesse Minha fonte para trocar ou desconectar sua lista."); focus(el("lib-home")); }
    }
    el("load-live").addEventListener("click", function () { enter("live"); });
    el("load-movies").addEventListener("click", function () { enter("movie"); });
    el("load-series").addEventListener("click", function () { enter("series"); });
    el("lib-home").addEventListener("click", function () { stack = []; enter("movie", true); stack = []; });
    el("lib-favorites").addEventListener("click", function () { enter("movie", false, true); });
    el("lib-source").addEventListener("click", function () { remember(); hooks.stopPreview(); cancel(); el("library").hidden = true; el("home").hidden = false; focus(el("server")); });
    el("lib-back").addEventListener("click", function () { if (!hooks.stopPreview()) back(); });
    el("lib-category").addEventListener("change", function () { state.category = this.value; filter(false); });
    el("lib-search").addEventListener("input", function () { state.query = this.value.trim(); clearTimeout(queryTimer); queryTimer = setTimeout(function () { filter(false); }, 180); });
    ["page-prev","page-next"].forEach(function (button) { el(button).addEventListener("click", function () { state.page += button === "page-prev" ? -1 : 1; render(); focus(el("catalog-list").querySelector("button")); }); });
    el("feature-open").addEventListener("click", function () { var item = state.filtered[state.page * pageSize]; if (item) open(item, item._nexKind || state.kind); });
    el("detail-play").addEventListener("click", function () { if (!detail) return; var item = detail.kind === "series" ? (detail.episodes[season] || [])[episodePage * 24] : detail.playItem; if (item) start(item, detail.kind, name(item)); });
    function toggleFavorite(item, kind) {
      var k = key(item, kind);
      if (favorites[k]) delete favorites[k]; else { var copy = {}; Object.keys(item).forEach(function (field) { copy[field] = item[field]; }); copy._nexKind = kind; favorites[k] = copy; }
      if (detail) text("detail-favorite", favorites[k] ? "♥ Favoritado" : "♡ Favoritar");
      message("Favoritos guardados apenas nesta sessão da TV."); return !!favorites[k];
    }
    el("detail-favorite").addEventListener("click", function () { if (detail) toggleFavorite(detail.item, detail.kind); });
    el("season-select").addEventListener("change", function () { season = this.value; episodePage = 0; renderEpisodes(); });
    ["episode-prev","episode-next"].forEach(function (button) { el(button).addEventListener("click", function () { episodePage += button === "episode-prev" ? -1 : 1; renderEpisodes(); focus(el("episode-list").querySelector("button")); }); });
    return {enter:function () { stack = []; enter("movie", true); stack = []; }, back:back, message:message, cancel:cancel,
      clear:function () { cancel(); state = null; detail = null; stack = []; favorites = {}; el("library").hidden = true; el("home").hidden = false; el("catalog-list").textContent = ""; el("episode-list").textContent = ""; },
      sourceBack:function () { if (!state) return false; el("home").hidden = true; el("library").hidden = false; if (detail) detailView(); else browse(); focus(el("lib-source")); return true; }};
  };
}());
