(function () {
  "use strict";
  var D = window.NexDomain, video = document.getElementById("video"), player = document.getElementById("player");
  var disabledHome = [];
  var config = null, activeRequest = null, requestGeneration = 0, currentKind = "local", returnFocus = null, confirmed = {live:false,movie:false,series:false};
  function el(id) { return document.getElementById(id); }
  function status(text) { el("status").textContent = text; }
  function playerStatus(text) { el("player-status").textContent = text; }
  function clock(value) { value = isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return Math.floor(value / 60) + ":" + (value % 60 < 10 ? "0" : "") + value % 60; }
  function focus(node) { if (node) { node.focus(); if (node.scrollIntoViewIfNeeded) node.scrollIntoViewIfNeeded(false); } }
  function clearVideo() { video.pause(); video.removeAttribute("src"); video.load(); }
  function stop() {
    clearVideo(); player.hidden = true; el("home").removeAttribute("aria-hidden");
    disabledHome.forEach(function (entry) { entry.node.disabled = entry.disabled; }); disabledHome = [];
    focus(returnFocus || el("local-test"));
  }
  function play(url, title, kind) {
    requestGeneration++; if (activeRequest) activeRequest.abort(); activeRequest = null;
    returnFocus = document.activeElement; currentKind = kind;
    clearVideo(); video.loop = kind === "local"; video.muted = false;
    player.hidden = false; el("home").setAttribute("aria-hidden", "true");
    var controls = el("home").querySelectorAll("button,input,select");
    for (var i = 0; i < controls.length; i++) { disabledHome.push({node:controls[i],disabled:controls[i].disabled}); controls[i].disabled = true; }
    el("playing-title").textContent = title; playerStatus("Preparando reprodução…");
    el("confirm-av").disabled = true;
    video.src = url; video.load();
    var promise = video.play();
    if (promise && promise.catch) promise.catch(function () { playerStatus("Pressione Reproduzir. Se persistir, confira fonte, rede e formato."); });
    focus(el("play-pause"));
  }
  function request(url, callback) {
    if (activeRequest) activeRequest.abort();
    var generation = ++requestGeneration, xhr = new XMLHttpRequest(), ended = false;
    activeRequest = xhr; xhr.open("GET", url, true); xhr.timeout = 25000;
    function fail(message) { if (generation === requestGeneration && !ended) { ended = true; activeRequest = null; status(message); } }
    xhr.onprogress = function (event) { if (event.loaded > 8 * 1024 * 1024) { fail("Resposta grande demais para esta prova (limite 8 MB). Use uma URL direta."); xhr.abort(); } };
    xhr.onerror = function () { fail("Não foi possível consultar a fonte. Pode ser rede, TLS ou bloqueio CORS do servidor."); };
    xhr.ontimeout = function () { fail("O servidor demorou demais para responder. Tente novamente."); };
    xhr.onload = function () {
      if (generation !== requestGeneration || ended) return;
      if (xhr.status < 200 || xhr.status >= 300) { fail("O servidor recusou a consulta (HTTP " + xhr.status + "). Confira o acesso à fonte."); return; }
      if (xhr.responseText.length > 8 * 1024 * 1024) { fail("Resposta grande demais para esta prova."); return; }
      try { var parsed = JSON.parse(xhr.responseText); ended = true; activeRequest = null; callback(parsed); }
      catch (error) { status("A resposta não pôde ser usada nesta prova. Confira o formato da fonte."); }
    };
    xhr.send(null);
  }
  function showList(items, kind, episodes) {
    var list = el("catalog-list"); list.textContent = "";
    el("catalog-title").textContent = episodes ? "Escolha um episódio" : kind === "live" ? "Escolha um canal" : kind === "movie" ? "Escolha um filme" : "Escolha uma série";
    items.forEach(function (item) {
      var button = document.createElement("button"); button.setAttribute("data-nav", "");
      button.textContent = item.name || item.title || "Nome não fornecido";
      button.addEventListener("click", function () {
        if (!config) { status("Conecte a fonte novamente."); return; }
        if (kind === "series" && !episodes) {
          var id = String(item.series_id);
          if (!/^\d{1,20}$/.test(id)) { status("Identificador da série não fornecido."); return; }
          status("Buscando episódios…");
          request(D.api(config, "get_series_info", id), function (value) { showList(D.episodes(value), "series", true); });
        } else {
          try { play(D.stream(config, kind, item, el("live-format").value), button.textContent, kind); }
          catch (error) { status(error.message); }
        }
      }); list.appendChild(button);
    });
    status(items.length ? items.length + " opções disponíveis neste teste. Selecione com OK." : "Nenhum registro fornecido nesta resposta.");
    focus(list.querySelector("button"));
  }
  function load(kind) {
    if (!config) return;
    el("catalog-list").textContent = "";
    status("Carregando " + (kind === "live" ? "canais" : kind === "movie" ? "filmes" : "séries") + "…");
    request(D.api(config, kind === "live" ? "get_live_streams" : kind === "movie" ? "get_vod_streams" : "get_series"), function (value) { showList(D.records(value), kind, false); });
  }
  function clearSource() {
    requestGeneration++; if (activeRequest) activeRequest.abort(); activeRequest = null; config = null;
    el("source-form").reset(); el("direct-url").value = ""; el("catalog-list").textContent = "";
    el("catalog-title").textContent = "Sua fonte aparecerá aqui";
    ["load-live","load-movies","load-series"].forEach(function (id) { el(id).disabled = true; });
    status("Dados de acesso removidos desta sessão.");
  }
  el("source-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var next;
    try {
      next = {server:D.base(el("server").value.trim()),user:el("username").value.trim(),password:el("password").value};
      if (!next.user || !next.password) throw new Error("Informe usuário e senha.");
    } catch (error) { status(error.message); return; }
    config = null; ["load-live","load-movies","load-series"].forEach(function (id) { el(id).disabled = true; });
    status("Verificando acesso à fonte…");
    request(D.api(next), function (value) {
      var info = value && value.user_info;
      if (!info || !(info.auth === true || String(info.auth) === "1") || (info.status && String(info.status).toLowerCase() !== "active")) { status("A fonte não confirmou uma conta ativa. Confira os dados."); return; }
      config = next; el("password").value = "";
      ["load-live","load-movies","load-series"].forEach(function (id) { el(id).disabled = false; });
      status("Fonte conectada. Teste um canal, um filme e um episódio."); focus(el("load-live"));
    });
  });
  el("clear-source").addEventListener("click", clearSource);
  el("load-live").addEventListener("click", function () { load("live"); });
  el("load-movies").addEventListener("click", function () { load("movie"); });
  el("load-series").addEventListener("click", function () { load("series"); });
  el("direct-form").addEventListener("submit", function (event) {
    event.preventDefault();
    try { var url = D.httpUrl(el("direct-url").value.trim()).href; el("direct-url").value = ""; play(url, "Conteúdo da sua fonte", el("direct-kind").value); }
    catch (error) { status(error.message); }
  });
  el("local-test").addEventListener("click", function () { play("media/player-av.mp4", "Teste local · Imagem sintética e áudio", "local"); });
  el("local-hls").addEventListener("click", function () { play("media/hls/index.m3u8", "Teste HLS local · Compatibilidade do aparelho", "local"); });
  el("source-focus").addEventListener("click", function () { focus(el("server")); });
  el("back").addEventListener("click", stop);
  function toggle() { if (video.paused) { var result = video.play(); if (result && result.catch) result.catch(function () { playerStatus("Não foi possível iniciar. Confira a fonte e o formato."); }); } else video.pause(); }
  el("play-pause").addEventListener("click", toggle);
  function seek(delta) {
    if (!video.seekable.length) { playerStatus("Esta fonte não oferece avanço ou retrocesso agora."); return; }
    try { video.currentTime = Math.max(video.seekable.start(0), Math.min(video.seekable.end(video.seekable.length - 1), video.currentTime + delta)); } catch (error) { playerStatus("Não foi possível mudar a posição nesta fonte."); }
  }
  el("seek-back").addEventListener("click", function () { seek(-10); });
  el("seek-forward").addEventListener("click", function () { seek(10); });
  el("confirm-av").addEventListener("click", function () {
    if (currentKind !== "local") confirmed[currentKind] = true;
    el("checks").textContent = "TV: " + (confirmed.live ? "OK" : "pendente") + " · Filme: " + (confirmed.movie ? "OK" : "pendente") + " · Episódio: " + (confirmed.series ? "OK" : "pendente");
    stop(); status("Confirmação manual registrada nesta sessão. Teste o próximo tipo.");
  });
  video.addEventListener("playing", function () { el("confirm-av").disabled = currentKind === "local" || video.videoWidth === 0; playerStatus("Reproduzindo. Confirme imagem e áudio na TV."); });
  video.addEventListener("waiting", function () { playerStatus("Aguardando dados da transmissão…"); });
  video.addEventListener("error", function () { playerStatus(D.mediaError(video.error && video.error.code)); });
  video.addEventListener("pause", function () { el("play-pause").textContent = "Reproduzir"; });
  video.addEventListener("play", function () { el("play-pause").textContent = "Pausar"; });
  video.addEventListener("loadedmetadata", function () { playerStatus("Vídeo reconhecido: " + video.videoWidth + " × " + video.videoHeight + ". Confira o áudio na TV."); });
  video.addEventListener("timeupdate", function () { el("time").textContent = clock(video.currentTime) + (isFinite(video.duration) ? " / " + clock(video.duration) : " · AO VIVO"); });
  video.addEventListener("ended", function () { playerStatus("Reprodução concluída. Confirme imagem e áudio ou volte."); });
  document.addEventListener("visibilitychange", function () { if (document.hidden) video.pause(); });
  window.addEventListener("pagehide", function () { clearSource(); clearVideo(); });
  function visible(node) {
    if (node.disabled || !node.getClientRects().length) return false;
    for (var parent = node; parent; parent = parent.parentElement) if (parent.hidden) return false;
    return true;
  }
  document.addEventListener("keydown", function (event) {
    var code = event.keyCode || event.which, active = document.activeElement;
    if (code === 461 || code === 27) { if (!player.hidden) { event.preventDefault(); stop(); } return; }
    if (!player.hidden && (code === 415 || code === 19 || code === 10252)) {
      event.preventDefault();
      if (code === 10252 || (code === 415 && video.paused) || (code === 19 && !video.paused)) toggle();
      return;
    }
    if (code < 37 || code > 40) return;
    if ((code === 37 || code === 39) && active.tagName === "INPUT") return;
    if ((code === 37 || code === 39) && active.tagName === "SELECT") {
      event.preventDefault(); active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + (code === 39 ? 1 : -1))); return;
    }
    var scope = player.hidden ? el("home") : player, candidates = scope.querySelectorAll("[data-nav]"), from = active.getBoundingClientRect(), best = null, bestScore = Infinity;
    for (var i = 0; i < candidates.length; i++) {
      var node = candidates[i]; if (node === active || !visible(node)) continue;
      var r = node.getBoundingClientRect(), dx = r.left + r.width / 2 - (from.left + from.width / 2), dy = r.top + r.height / 2 - (from.top + from.height / 2);
      var main = code === 37 ? -dx : code === 39 ? dx : code === 38 ? -dy : dy, cross = code === 37 || code === 39 ? Math.abs(dy) : Math.abs(dx);
      if (main <= 2) continue; var score = main + cross * 3;
      if (score < bestScore) { best = node; bestScore = score; }
    }
    if (best) { event.preventDefault(); focus(best); }
  });
  focus(el("local-test"));
}());
