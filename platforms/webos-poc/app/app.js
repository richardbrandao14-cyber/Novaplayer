(function () {
  "use strict";
  var D = window.NexDomain, video = document.getElementById("video"), player = document.getElementById("player");
  var config = null, library, activeRequest = null, requestGeneration = 0, playbackDeadline, hudTimer;
  var disabledHome = [], currentKind = "local", returnFocus = null, preview = false, playingKey = "", resume = {}, pendingResume = 0;
  var favoriteAction = null, nextAction = null;
  var confirmed = {live:false,movie:false,series:false};
  function el(id) { return document.getElementById(id); }
  function focus(node) { if (node) { node.focus(); if (node.scrollIntoViewIfNeeded) node.scrollIntoViewIfNeeded(false); } }
  function status(text) { el("status").textContent = text; el("source-status").textContent = text; if (library) library.message(text); }
  function playerStatus(text) { el("player-status").textContent = text; }
  function clock(value) { value = isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return Math.floor(value / 60) + ":" + (value % 60 < 10 ? "0" : "") + value % 60; }
  function localMedia(name) { var page = window.location.href.split("#")[0].split("?")[0]; return page.slice(0, page.lastIndexOf("/") + 1) + name; }
  function cancel() { requestGeneration++; if (activeRequest) activeRequest.abort(); activeRequest = null; }
  function request(url, callback, failure) {
    cancel(); var generation = requestGeneration, xhr = new XMLHttpRequest(), ended = false; activeRequest = xhr;
    function fail(message) { if (generation !== requestGeneration || ended) return; ended = true; activeRequest = null; if (failure) failure(message); else status(message); }
    try { xhr.open("GET", url, true); xhr.timeout = 30000; }
    catch (error) { fail("Não foi possível iniciar a consulta. Confira o endereço do servidor."); return; }
    xhr.onprogress = function (event) { if (event.loaded > 32 * 1024 * 1024) { fail("Resposta acima do limite de memória de 32 MB. Consulte o provedor para dividir o catálogo."); xhr.abort(); } };
    xhr.onerror = function () { fail("Não foi possível consultar a fonte. Confira rede, TLS e permissão CORS do servidor."); };
    xhr.ontimeout = function () { fail("O servidor demorou para responder. Tente novamente."); };
    xhr.onload = function () {
      if (generation !== requestGeneration || ended) return;
      if (xhr.status < 200 || xhr.status >= 300) { fail("O servidor recusou a consulta (HTTP " + xhr.status + "). Confira o acesso."); return; }
      if (xhr.responseText.length > 32 * 1024 * 1024) { fail("Resposta acima do limite de memória de 32 MB."); return; }
      var parsed;
      try { parsed = JSON.parse(xhr.responseText); } catch (error) { fail("A fonte não retornou dados válidos para esta operação."); return; }
      ended = true; activeRequest = null;
      try { callback(parsed); } catch (error) { status("Não foi possível usar os dados desta resposta. Tente outra seção."); }
    };
    try { xhr.send(null); } catch (error) { fail("A TV bloqueou a consulta. Confira endereço e permissões do servidor."); }
  }
  function saveProgress() { if (playingKey && currentKind !== "live" && currentKind !== "local" && video.currentTime > 5) resume[playingKey] = video.ended ? 0 : video.currentTime; }
  function clearVideo() { saveProgress(); clearTimeout(playbackDeadline); clearTimeout(hudTimer); video.pause(); video.removeAttribute("src"); video.load(); }
  function unlock() { disabledHome.forEach(function (entry) { entry.node.disabled = entry.disabled; }); disabledHome = []; el("home").removeAttribute("aria-hidden"); el("library").removeAttribute("aria-hidden"); }
  function lock() {
    unlock(); var controls = document.querySelectorAll("#home button,#home input,#home select,#library button,#library input,#library select");
    for (var i = 0; i < controls.length; i++) { disabledHome.push({node:controls[i],disabled:controls[i].disabled}); controls[i].disabled = true; }
    el("home").setAttribute("aria-hidden", "true"); el("library").setAttribute("aria-hidden", "true");
  }
  function hud() {
    player.classList.remove("hud-hidden"); clearTimeout(hudTimer);
    if (!preview && !player.hidden) hudTimer = setTimeout(function () { player.classList.add("hud-hidden"); }, 5000);
  }
  function stop() {
    if (player.hidden) return false;
    clearVideo(); favoriteAction = null; nextAction = null; player.hidden = true; player.className = ""; preview = false; playingKey = ""; unlock();
    focus(returnFocus && document.documentElement.contains(returnFocus) ? returnFocus : el("source-focus")); return true;
  }
  function fullscreen() { preview = false; player.className = ""; el("library").classList.remove("with-preview"); lock(); el("expand-player").hidden = true; hud(); focus(el("play-pause")); }
  function playbackBack() {
    if (!player.hidden && currentKind === "live" && !preview && !el("library").hidden) {
      unlock(); preview = true; player.className = "is-preview"; el("library").classList.add("with-preview"); el("expand-player").hidden = false; hud(); focus(returnFocus); return;
    }
    if (stop()) { el("library").classList.remove("with-preview"); return; }
    if (!el("library").hidden) library.back();
    else if (!library.sourceBack()) { status("Você está na tela inicial. Conecte sua lista para começar."); focus(el("source-focus")); }
  }
  function play(url, title, kind, inline, key) {
    if (!player.hidden && inline && playingKey === key) { fullscreen(); return; }
    cancel(); var target = document.activeElement;
    if (!player.hidden) stop(); returnFocus = target; currentKind = kind; preview = !!inline; playingKey = key || "";
    pendingResume = resume[playingKey] || 0; video.loop = kind === "local"; video.muted = false; video.playbackRate = 1; el("play-speed").value = "1";
    player.hidden = false; player.className = preview ? "is-preview" : ""; el("library").classList.toggle("with-preview", preview);
    if (!preview) lock();
    el("expand-player").hidden = !preview; el("playing-title").textContent = title; playerStatus(pendingResume ? "Retomando de " + clock(pendingResume) + "…" : "Preparando reprodução…");
    el("confirm-av").disabled = true; el("confirm-av").hidden = kind !== "local" && !el("home").hidden ? false : !el("library").hidden;
    el("player-favorite").hidden = true; el("next-episode").hidden = true;
    el("timeline").disabled = true; el("time").textContent = "0:00";
    video.src = url; video.load();
    playbackDeadline = setTimeout(function () { playerStatus("O vídeo não iniciou. Estado de mídia " + video.readyState + "/" + video.networkState + ". Tente outra fonte ou formato."); hud(); }, 15000);
    var promise = video.play(); if (promise && promise.catch) promise.catch(function () { playerStatus("Pressione Reproduzir. Confira fonte, rede e formato se persistir."); hud(); });
    hud(); if (!preview) focus(el("play-pause"));
  }
  library = window.NexLibrary({config:function () { return config; },request:request,cancel:cancel,play:play,progress:function (key) { return resume[key] || 0; }, favorite:function (action, selected) { favoriteAction = action; el("player-favorite").hidden = !action; el("player-favorite").textContent = selected ? "♥ Favoritado" : "♡ Favoritar canal"; }, next:function (action) { nextAction = action; el("next-episode").hidden = !action; },stopPreview:function () { if (!player.hidden) { stop(); el("library").classList.remove("with-preview"); return true; } return false; }});
  function clearSource() {
    stop(); cancel(); config = null; resume = {}; library.clear();
    el("source-form").reset(); el("direct-url").value = ""; status("Dados de acesso removidos desta sessão.");
  }
  el("source-form").addEventListener("submit", function (event) {
    event.preventDefault(); var next;
    try { if (!el("server").value.trim()) throw new Error("Informe o servidor da sua lista."); next = {server:D.base(el("server").value.trim()),user:el("username").value.trim(),password:el("password").value}; if (!next.user || !next.password) throw new Error("Informe usuário e senha."); }
    catch (error) { status(error.message); return; }
    library.clear(); config = null; resume = {}; status("Verificando acesso à fonte…");
    request(D.api(next), function (value) {
      var info = value && value.user_info;
      if (!info || !(info.auth === true || String(info.auth) === "1") || (info.status && String(info.status).toLowerCase() !== "active")) { status("A fonte não confirmou uma conta ativa. Confira os dados."); return; }
      config = next; el("password").value = ""; status("Fonte conectada."); library.enter();
    });
  });
  el("clear-source").addEventListener("click", clearSource);
  el("direct-form").addEventListener("submit", function (event) { event.preventDefault(); try { var url = D.httpUrl(el("direct-url").value.trim()).href; el("direct-url").value = ""; play(url, "Conteúdo da sua fonte", el("direct-kind").value); } catch (error) { status(error.message); } });
  el("local-test").addEventListener("click", function () { play(localMedia("media/player-av.mp4"), "Teste local · Imagem sintética e áudio", "local"); });
  el("local-hls").addEventListener("click", function () { play(localMedia("media/hls/index.m3u8"), "Teste HLS local", "local"); });
  el("toggle-tools").addEventListener("click", function () { var open = el("test-tools").hidden; el("test-tools").hidden = !open; this.setAttribute("aria-expanded", String(open)); this.textContent = open ? "Fechar ferramentas de teste" : "Abrir ferramentas de teste"; });
  el("source-focus").addEventListener("click", function () { focus(el("server")); });
  el("player-favorite").addEventListener("click", function () { if (favoriteAction) this.textContent = favoriteAction() ? "♥ Favoritado" : "♡ Favoritar canal"; hud(); });
  el("next-episode").addEventListener("click", function () { if (nextAction) nextAction(); });
  el("back").addEventListener("click", playbackBack); el("expand-player").addEventListener("click", fullscreen);
  function toggle() { if (video.paused) { var result = video.play(); if (result && result.catch) result.catch(function () { playerStatus("Não foi possível iniciar a reprodução."); }); } else video.pause(); hud(); }
  el("play-pause").addEventListener("click", toggle);
  function seek(delta) { if (!video.seekable.length) { playerStatus("Esta fonte não oferece avanço ou retrocesso agora."); return; } try { video.currentTime = Math.max(video.seekable.start(0), Math.min(video.seekable.end(video.seekable.length - 1), video.currentTime + delta)); } catch (error) { playerStatus("Não foi possível mudar a posição."); } hud(); }
  el("seek-back").addEventListener("click", function () { seek(-10); }); el("seek-forward").addEventListener("click", function () { seek(10); });
  el("timeline").addEventListener("change", function () { if (isFinite(video.duration) && video.duration > 0) { try { video.currentTime = Number(this.value) * video.duration / 1000; } catch (error) { playerStatus("Esta fonte não permite buscar essa posição."); } } hud(); });
  el("play-speed").addEventListener("change", function () { try { video.playbackRate = Number(this.value); } catch (error) { playerStatus("Velocidade não suportada nesta fonte."); } hud(); });
  el("confirm-av").addEventListener("click", function () { if (currentKind !== "local") confirmed[currentKind] = true; el("checks").textContent = "TV: " + (confirmed.live ? "OK" : "pendente") + " · Filme: " + (confirmed.movie ? "OK" : "pendente") + " · Episódio: " + (confirmed.series ? "OK" : "pendente"); stop(); status("Confirmação manual registrada nesta sessão."); });
  video.addEventListener("playing", function () { clearTimeout(playbackDeadline); el("confirm-av").disabled = currentKind === "local" || video.videoWidth === 0; playerStatus(currentKind === "live" ? "AO VIVO" : "Reproduzindo"); });
  video.addEventListener("waiting", function () { playerStatus("Carregando transmissão…"); hud(); });
  video.addEventListener("error", function () { clearTimeout(playbackDeadline); playerStatus(D.mediaError(video.error && video.error.code)); hud(); });
  video.addEventListener("pause", function () { el("play-pause").textContent = "Reproduzir"; }); video.addEventListener("play", function () { el("play-pause").textContent = "Pausar"; });
  video.addEventListener("loadedmetadata", function () { if (pendingResume && isFinite(video.duration) && pendingResume < video.duration - 10) { try { video.currentTime = pendingResume; } catch (error) { playerStatus("Retomada indisponível nesta fonte."); } } pendingResume = 0; });
  video.addEventListener("timeupdate", function () { el("time").textContent = clock(video.currentTime) + (isFinite(video.duration) ? " / " + clock(video.duration) : " · AO VIVO"); el("timeline").disabled = currentKind === "live" || !isFinite(video.duration) || !video.seekable.length; if (!el("timeline").disabled && document.activeElement !== el("timeline")) el("timeline").value = String(Math.floor(video.currentTime / video.duration * 1000)); });
  video.addEventListener("ended", function () { saveProgress(); playerStatus("Reprodução concluída."); hud(); });
  player.addEventListener("mousemove", hud); player.addEventListener("click", hud);
  document.addEventListener("visibilitychange", function () { if (document.hidden) { saveProgress(); video.pause(); } });
  window.addEventListener("pagehide", function () { clearSource(); });
  function visible(node) { if (node.disabled || !node.getClientRects().length) return false; for (var parent = node; parent; parent = parent.parentElement) if (parent.hidden) return false; return true; }
  document.addEventListener("keydown", function (event) {
    var code = event.keyCode || event.which, active = document.activeElement;
    if (code === 461 || code === 27 || event.key === "GoBack") { event.preventDefault(); event.stopPropagation(); if (!event.repeat) playbackBack(); return; }
    var hiddenHud = player.classList.contains("hud-hidden"); if (!player.hidden) hud();
    if (hiddenHud && !preview && (code === 13 || code >= 37 && code <= 40)) { event.preventDefault(); focus(el("play-pause")); return; }
    if (code === 13 && active && active.tagName === "BUTTON" && !active.disabled) { event.preventDefault(); if (!event.repeat) active.click(); return; }
    if (!player.hidden && (code === 415 || code === 19 || code === 10252)) { event.preventDefault(); if (code === 10252 || code === 415 && video.paused || code === 19 && !video.paused) toggle(); return; }
    if (code < 37 || code > 40) return;
    if ((code === 37 || code === 39) && active.tagName === "INPUT") return;
    if ((code === 37 || code === 39) && active.tagName === "SELECT") { event.preventDefault(); active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + (code === 39 ? 1 : -1))); var change = document.createEvent("HTMLEvents"); change.initEvent("change", true, false); active.dispatchEvent(change); return; }
    var scope = !player.hidden && !preview ? player : !el("library").hidden ? el("library") : el("home");
    var candidates = scope.querySelectorAll("[data-nav]"), from = active.getBoundingClientRect(), best = null, bestScore = Infinity;
    if (preview) candidates = document.querySelectorAll("#library [data-nav],#player [data-nav]");
    for (var i = 0; i < candidates.length; i++) { var node = candidates[i]; if (node === active || !visible(node)) continue; var r = node.getBoundingClientRect(), dx = r.left + r.width / 2 - (from.left + from.width / 2), dy = r.top + r.height / 2 - (from.top + from.height / 2); var main = code === 37 ? -dx : code === 39 ? dx : code === 38 ? -dy : dy, cross = code === 37 || code === 39 ? Math.abs(dy) : Math.abs(dx); if (main <= 2) continue; var score = main + cross * 3; if (score < bestScore) { best = node; bestScore = score; } }
    if (best) { event.preventDefault(); focus(best); }
  }, true);
  document.addEventListener("keyup", function (event) { if ((event.keyCode || event.which) === 461) { event.preventDefault(); event.stopPropagation(); } }, true);
  window.addEventListener("popstate", function () { playbackBack(); });
  window.nexReady = true; var styled = parseInt(window.getComputedStyle(document.querySelector(".brand")).fontSize, 10) >= 30;
  el("initialization-status").textContent = "Versão 0.2.0 · JavaScript OK · " + (styled ? "Estilo OK" : "Estilo não carregado"); focus(el("source-focus"));
}());
