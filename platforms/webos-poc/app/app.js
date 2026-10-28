(function () {
  "use strict";
  var D = window.NexDomain, video = document.getElementById("video"), player = document.getElementById("player");
  var config = null, library, activeRequest = null, requestGeneration = 0, playbackDeadline, hudTimer;
  var disabledHome = [], currentKind = "local", returnFocus = null, preview = false, playingKey = "", playingParent = "", pendingResume = 0, lastSaved = 0;
  var favoriteAction = null, nextAction = null, authGeneration=0, seekMode=false;
  var shelf = window.NexShelf.browser(status), vault = window.NexVault.browser(), playback;
  var confirmed = {live:false,movie:false,series:false};
  function el(id) { return document.getElementById(id); }
  function focus(node) { window.NexNavigation.focus(node,true); }
  function status(text) { el("status").textContent = text; el("source-status").textContent = text; el("vault-status").textContent=text; if (library) library.message(text); }
  function playerStatus(text) { el("player-status").textContent = text; }
  function clock(value) { value = isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return Math.floor(value / 60) + ":" + (value % 60 < 10 ? "0" : "") + value % 60; }
  function localMedia(name) { var page = window.location.href.split("#")[0].split("?")[0]; return page.slice(0, page.lastIndexOf("/") + 1) + name; }
  function cancel() { requestGeneration++; if (activeRequest) activeRequest.abort(); activeRequest = null; }
  function request(url, callback, failure) {
    cancel(); var generation = requestGeneration, xhr = new XMLHttpRequest(), ended = false; activeRequest = xhr;
    function fail(message) { if (generation !== requestGeneration || ended) return; ended = true; activeRequest = null; if (failure) failure(message); else {status(message);if(library)library.failed(message);} }
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
      try { callback(parsed); } catch (error) { library.failed(error.code==="CATALOG_FORMAT"?error.message:"Não foi possível usar os dados desta resposta. Tente atualizar o catálogo."); }
    };
    try { xhr.send(null); } catch (error) { fail("A TV bloqueou a consulta. Confira endereço e permissões do servidor."); }
  }
  function saveProgress() { if (playingKey && currentKind !== "live" && currentKind !== "local" && video.currentTime > 2) { shelf.save(playingKey,video.ended ? 0 : video.currentTime,video.duration,playingParent); lastSaved=Date.now(); } }
  function clearVideo() { saveProgress(); clearTimeout(playbackDeadline); clearTimeout(hudTimer); video.pause(); video.removeAttribute("src"); video.load(); }
  function unlock() { disabledHome.forEach(function (entry) { entry.node.disabled = entry.disabled; }); disabledHome = []; el("home").removeAttribute("aria-hidden"); el("library").removeAttribute("aria-hidden"); }
  function lock() {
    unlock(); var controls = document.querySelectorAll("#home button,#home input,#home select,#library button,#library input,#library select");
    for (var i = 0; i < controls.length; i++) { disabledHome.push({node:controls[i],disabled:controls[i].disabled}); controls[i].disabled = true; }
    el("home").setAttribute("aria-hidden", "true"); el("library").setAttribute("aria-hidden", "true");
  }
  function hud() {
    player.classList.remove("hud-hidden"); clearTimeout(hudTimer);
    if (!preview && !player.hidden && el("player-settings").hidden && !seekMode) hudTimer = setTimeout(function () { player.classList.add("hud-hidden"); }, 5000);
  }
  function stop() {
    if (player.hidden) return false;
    if(playback)playback.stop();
    closeSettings(false);exitSeek();clearVideo(); favoriteAction = null; nextAction = null; player.hidden = true; player.className = ""; preview = false; playingKey = ""; unlock();
    focus(returnFocus && document.documentElement.contains(returnFocus) ? returnFocus : el("source-focus")); return true;
  }
  function videoGeometry(){
    if(player.hidden)return;
    var rect=player.getBoundingClientRect();
    video.style.width=Math.round(rect.width)+"px";video.style.height=Math.round(rect.height)+"px";
  }
  window.addEventListener("resize",videoGeometry);
  function fullscreen() { preview = false; player.className = ""; el("library").classList.remove("with-preview"); lock(); el("expand-player").hidden = true; videoGeometry(); hud(); focus(el("play-pause")); }
  function playbackBack() {
    if(!el("player-settings").hidden){closeSettings(true);return;}
    if(seekMode){exitSeek();hud();focus(el("play-pause"));return;}
    if(playback && playback.back())return;
    if (!player.hidden && currentKind === "live" && !preview && !el("library").hidden) {
      unlock(); preview = true; player.className = "is-preview"; el("library").classList.add("with-preview"); el("expand-player").hidden = false; videoGeometry(); hud(); focus(library.liveFocus()||returnFocus); return;
    }
    if (stop()) { el("library").classList.remove("with-preview"); return; }
    if (!el("library").hidden) library.back();
    else if (!library.sourceBack()) { status("Você está na tela inicial. Conecte sua lista para começar."); focus(el("source-focus")); }
  }
  function play(url, title, kind, inline, key, parentId, epgUrl) {
    if (!player.hidden && inline && playingKey === key) { fullscreen(); return; }
    cancel(); var target = kind==="live"&&library.liveFocus()?library.liveFocus():document.activeElement;
    if (!player.hidden) stop(); returnFocus = target; currentKind = kind; preview = !!inline; playingKey = key || ""; playingParent=parentId||""; lastSaved=0;
    pendingResume = shelf.progress()[playingKey] ? shelf.progress()[playingKey].position : 0; video.loop = kind === "local"; video.muted = false; video.playbackRate = 1; el("play-speed").value = "1";
    closeSettings(false);exitSeek();player.hidden = false; player.className = preview ? "is-preview" : ""; el("library").classList.toggle("with-preview", preview);
    if (!preview) lock();
    el("expand-player").hidden = !preview; el("playing-title").textContent = title; playerStatus(pendingResume ? "Retomando de " + clock(pendingResume) + "…" : "Preparando reprodução…");
    el("confirm-av").disabled = true; el("confirm-av").hidden = kind !== "local" && !el("home").hidden ? false : !el("library").hidden;
    el("player-favorite").hidden = true; el("next-episode").hidden = true;
    el("video-quality").textContent="Resolução aguardando…";
    el("timeline").disabled = true; el("time").textContent = "0:00";
    playback.start({url:url,kind:kind,epgUrl:epgUrl||""});
    videoGeometry(); video.src = url; video.load();
    playbackDeadline = setTimeout(function () { playerStatus("O vídeo não iniciou. Estado de mídia " + video.readyState + "/" + video.networkState + ". Tente outra fonte ou formato."); hud(); }, 15000);
    var promise = video.play(); if (promise && promise.catch) promise.catch(function () { playerStatus("Pressione Reproduzir. Confira fonte, rede e formato se persistir."); hud(); });
    hud(); if (!preview) focus(el("play-pause"));
  }
  playback=window.NexPlayback(video,{request:request,autoNext:function(){return shelf.autoNext();},activity:function(){clearTimeout(playbackDeadline);hud();}});
  library = window.NexLibrary({shelf:shelf,config:function () { return config; },request:request,cancel:cancel,play:play,progress:function (key) { return shelf.progress()[key] ? shelf.progress()[key].position : 0; }, favorite:function (action, selected) { favoriteAction = action; el("player-favorite").hidden = !action; el("player-favorite").textContent = selected ? "♥ Favoritado" : "♡ Favoritar canal"; }, next:function (action) { nextAction = action; playback.next(action); el("next-episode").hidden = !action; },stopPreview:function () { if (!player.hidden) { stop(); el("library").classList.remove("with-preview"); return true; } return false; }});
  function clearSource() {
    authGeneration++;
    stop(); cancel(); config = null; shelf.disconnect(); library.clear();
    el("source-form").reset(); el("direct-url").value = ""; status("Dados de acesso removidos desta sessão.");
  }
  function connect(next, remember, pass, fromVault) {
    var generation=++authGeneration;
    stop();library.clear();config=null;shelf.disconnect();status("Verificando acesso à fonte…");
    request(D.api(next),function(value){
      var info=value&&value.user_info;
      if(!info||!(info.auth===true||String(info.auth)==="1")||(info.status&&String(info.status).toLowerCase()!=="active")){status("A fonte não confirmou uma conta ativa. Confira os dados.");return;}
      function ready(){if(generation!==authGeneration)return;config=next;el("server").value=next.server;el("username").value=next.user;shelf.connect(next);if(fromVault)el("live-format").value=shelf.format();else shelf.format(el("live-format").value);library.connect();el("password").value="";el("vault-create").value="";status("Fonte conectada.");library.enter();}
      if(remember){status("Protegendo seu acesso…");vault.save(next,pass,function(){return generation===authGeneration;}).then(function(){el("vault-login").hidden=false;ready();},function(error){if(generation===authGeneration){el("vault-capability").textContent=error.message;ready();}});}else ready();
    });
  }
  el("source-form").addEventListener("submit",function(event){
    event.preventDefault();var next,remember=el("remember-access").checked,pass=el("vault-create").value;
    try{if(!el("server").value.trim())throw new Error("Informe o servidor da sua lista.");next=D.source(el("server").value,el("username").value.trim(),el("password").value);if(config&&next.server===config.server&&next.user===config.user&&!next.apiQuery&&config.apiQuery)next.apiQuery=config.apiQuery;if(next.liveFormat)el("live-format").value=next.liveFormat;if(!next.user||!next.password){focus(el(!next.user?"username":"password"));throw new Error("Informe usuário e senha.");}if(remember&&(!vault.available()||pass.length<8))throw new Error("Para lembrar o acesso, crie uma senha de desbloqueio com pelo menos oito caracteres.");}catch(error){status(error.message);return;}
    connect(next,remember,pass);
  });
  el("vault-form").addEventListener("submit",function(event){event.preventDefault();var generation=++authGeneration,pass=el("vault-password").value;el("vault-password").value="";status("Desbloqueando acesso…");vault.open(pass).then(function(next){if(generation!==authGeneration)return;try{next.server=D.base(next.server);if(!next.user||!next.password)throw new Error();connect(next,false,"",true);}catch(error){status("Acesso salvo inválido. Cadastre a lista novamente.");}},function(error){if(generation===authGeneration)status(error.message);});});
  el("vault-forget").addEventListener("click",function(){authGeneration++;cancel();if(!vault.forget()){status("Não foi possível apagar o acesso salvo.");return;}el("vault-login").hidden=true;el("new-source").hidden=false;status("Acesso salvo removido. Seus favoritos e progresso não foram apagados.");focus(el("server"));});
  el("vault-other").addEventListener("click",function(){authGeneration++;cancel();el("vault-login").hidden=true;el("new-source").hidden=false;focus(el("server"));});
  el("remember-access").addEventListener("change",function(){el("vault-create").hidden=!this.checked;if(!this.checked)el("vault-create").value="";else focus(el("vault-create"));});
  el("vault-create").hidden=true;el("vault-login").hidden=!vault.exists();el("new-source").hidden=vault.exists()&&vault.available();
  if(!vault.available()){el("remember-access").disabled=true;el("vault-unlock").disabled=true;el("vault-capability").textContent="O motor desta TV não disponibiliza o cofre criptografado. O app não grava senhas em texto aberto.";}
  el("clear-source").addEventListener("click", clearSource);
  el("direct-form").addEventListener("submit", function (event) { event.preventDefault(); try { var url = D.httpUrl(el("direct-url").value.trim()).href; el("direct-url").value = ""; play(url, "Conteúdo da sua fonte", el("direct-kind").value); } catch (error) { status(error.message); } });
  el("local-test").addEventListener("click", function () { play(localMedia("media/player-av.mp4"), "Teste local · Imagem sintética e áudio", "local"); });
  el("local-uhd").addEventListener("click",function(){play(localMedia("media/player-uhd.mp4"),"Teste 4K · 3840 × 2160 · Imagem sintética e áudio","local");});
  el("local-hls").addEventListener("click", function () { play(localMedia("media/hls/index.m3u8"), "Teste HLS local", "local"); });
  el("toggle-tools").addEventListener("click", function () { var open = el("test-tools").hidden; el("test-tools").hidden = !open; this.setAttribute("aria-expanded", String(open)); this.textContent = open ? "Fechar ferramentas de teste" : "Abrir ferramentas de teste"; });
  el("source-focus").addEventListener("click", function () { el("new-source").hidden=false;el("vault-login").hidden=true;focus(el("server")); });
  el("player-favorite").addEventListener("click", function () { if (favoriteAction) this.textContent = favoriteAction() ? "♥ Favoritado" : "♡ Favoritar canal"; hud(); });
  el("next-episode").addEventListener("click", function () { if (nextAction) nextAction(); });
  el("back").addEventListener("click", playbackBack); el("expand-player").addEventListener("click", fullscreen);
  function toggle() { if (video.paused) { var result = video.play(); if (result && result.catch) result.catch(function () { playerStatus("Não foi possível iniciar a reprodução."); }); } else video.pause(); hud(); }
  el("play-pause").addEventListener("click", toggle);
  function seek(delta) { if (!video.seekable.length) { playerStatus("Esta fonte não oferece avanço ou retrocesso agora."); return; } try { video.currentTime = Math.max(video.seekable.start(0), Math.min(video.seekable.end(video.seekable.length - 1), video.currentTime + delta)); } catch (error) { playerStatus("Não foi possível mudar a posição."); } hud(); }
  el("seek-back").addEventListener("click", function () { seek(-10); }); el("seek-forward").addEventListener("click", function () { seek(10); });
  el("timeline").addEventListener("change", function () { if (isFinite(video.duration) && video.duration > 0) { try { video.currentTime = Number(this.value) * video.duration / 1000; } catch (error) { playerStatus("Esta fonte não permite buscar essa posição."); } } hud(); });
  el("play-speed").addEventListener("change", function () { try { video.playbackRate = Number(this.value); } catch (error) { playerStatus("Velocidade não suportada nesta fonte."); } hud(); });
  function exitSeek(){seekMode=false;el("timeline").setAttribute("aria-valuetext",clock(video.currentTime));player.classList.remove("seeking");el("seek-help").textContent="↑ Progresso · OK na barra para ajustar · ↓ Controles";}
  function closeSettings(restore){el("player-settings").hidden=true;if(restore){hud();focus(el("player-settings-open"));}}
  el("player-settings-open").addEventListener("click",function(){exitSeek();el("player-settings").hidden=false;hud();focus(el("play-speed"));});
  el("player-settings-close").addEventListener("click",function(){closeSettings(true);});
  function playerRemote(code,active){
    if(player.hidden||preview||playback.scope())return false;
    if(!el("player-settings").hidden){
      if(code===38||code===40){var settings=el("player-settings").querySelectorAll("[data-nav]"),items=[];for(var i=0;i<settings.length;i++)if(visible(settings[i]))items.push(settings[i]);var at=items.indexOf(active);focus(items[Math.max(0,Math.min(items.length-1,at+(code===40?1:-1)))]);return true;}
      if(code===37||code===39){if(active.tagName==="SELECT"){active.selectedIndex=Math.max(0,Math.min(active.options.length-1,active.selectedIndex+(code===39?1:-1)));var change=document.createEvent("HTMLEvents");change.initEvent("change",true,false);active.dispatchEvent(change);}return true;}
      return false;
    }
    if(active===el("timeline")){
      if(code===13){if(seekMode){exitSeek();focus(el("play-pause"));}else{seekMode=true;player.classList.add("seeking");el("seek-help").textContent="← −10 s · +10 s → · OK ou ↓ para concluir";}hud();return true;}
      if(code===37||code===39){if(seekMode)seek(code===39?10:-10);else focus(code===37?el("seek-back"):el("player-settings-open"));return true;}
      if(code===38||code===40){exitSeek();focus(code===38?el("back"):el("play-pause"));hud();return true;}
    }
    if(code<37||code>40)return false;
    var controls=player.querySelectorAll(".player-bottom .actions button"),buttons=[];
    for(var j=0;j<controls.length;j++)if(visible(controls[j]))buttons.push(controls[j]);
    var index=buttons.indexOf(active);
    if(index!==-1){if(code===37||code===39)focus(buttons[Math.max(0,Math.min(buttons.length-1,index+(code===39?1:-1)))]);else if(code===38)focus(el("timeline").disabled?el("back"):el("timeline"));return true;}
    if(active===el("back")&&(code===40||code===39)){focus(el("play-pause"));return true;}
    return false;
  }
  el("confirm-av").addEventListener("click", function () { if (currentKind !== "local") confirmed[currentKind] = true; el("checks").textContent = "TV: " + (confirmed.live ? "OK" : "pendente") + " · Filme: " + (confirmed.movie ? "OK" : "pendente") + " · Episódio: " + (confirmed.series ? "OK" : "pendente"); stop(); status("Confirmação manual registrada nesta sessão."); });
  function quality(){var label=D.resolution(video.videoWidth,video.videoHeight);if(el("video-quality").textContent!==label)el("video-quality").textContent=label;}
  video.addEventListener("loadedmetadata",videoGeometry);video.addEventListener("playing",videoGeometry);video.addEventListener("resize",quality);video.addEventListener("loadedmetadata",quality);video.addEventListener("playing",quality);video.addEventListener("timeupdate",quality);
  video.addEventListener("playing", function () { clearTimeout(playbackDeadline); el("confirm-av").disabled = currentKind === "local" || video.videoWidth === 0; playerStatus(currentKind === "live" ? "AO VIVO" : "Reproduzindo"); });
  video.addEventListener("waiting", function () { playerStatus("Carregando transmissão…"); hud(); });
  video.addEventListener("error", function () { clearTimeout(playbackDeadline); if(playback.error(video.error&&video.error.code))return; playerStatus(D.mediaError(video.error && video.error.code)); hud(); });
  video.addEventListener("pause", function () { playerStatus("Pausado");saveProgress(); el("play-pause").textContent = "Reproduzir"; }); video.addEventListener("play", function () { el("play-pause").textContent = "Pausar"; });
  video.addEventListener("loadedmetadata", function () { if (pendingResume && isFinite(video.duration) && pendingResume < video.duration - Math.min(10,Math.max(1,video.duration*0.03))) { try { video.currentTime = pendingResume; } catch (error) { playerStatus("Retomada indisponível nesta fonte."); } } pendingResume = 0; });
  video.addEventListener("timeupdate", function () { if(Date.now()-lastSaved>10000)saveProgress(); el("time").textContent = clock(video.currentTime) + (isFinite(video.duration) ? " / " + clock(video.duration) : " · AO VIVO"); el("timeline").disabled = currentKind === "live" || !isFinite(video.duration) || !video.seekable.length; if (!el("timeline").disabled && document.activeElement !== el("timeline")) el("timeline").value = String(Math.floor(video.currentTime / video.duration * 1000)); });
  video.addEventListener("ended", function () { exitSeek();closeSettings(false);saveProgress(); if(!playback.ended())playerStatus("Reprodução concluída."); hud(); });
  player.addEventListener("mousemove", hud); player.addEventListener("click", hud);
  document.addEventListener("visibilitychange", function () { if (document.hidden) { saveProgress(); video.pause(); } });
  window.addEventListener("pagehide", function () { clearSource(); });
  function visible(node) { if (node.disabled || !node.getClientRects().length) return false; for (var parent = node; parent; parent = parent.parentElement) if (parent.hidden) return false; return true; }
  document.addEventListener("keydown", function (event) {
    var code = event.keyCode || event.which, active = document.activeElement;
    if (code === 461 || code === 27 || event.key === "GoBack") { event.preventDefault(); event.stopPropagation(); if (!event.repeat) playbackBack(); return; }
    if(!player.hidden&&!preview&&currentKind==="live"&&el("player-settings").hidden&&!playback.scope()&&(code===38||code===40)){
      event.preventDefault();event.stopPropagation();if(!event.repeat)library.zap(code===40?1:-1,playingKey);return;
    }
    var hiddenHud = player.classList.contains("hud-hidden"); if (!player.hidden) hud();
    if (hiddenHud && !preview && !playback.scope() && (code === 13 || code >= 37 && code <= 40)) { event.preventDefault(); focus(el("play-pause")); return; }
    if(!player.hidden&&playerRemote(code,active)){event.preventDefault();return;}
    if(code===13&&active&&active.tagName==="INPUT"&&active.type==="checkbox"&&!active.disabled){event.preventDefault();if(!event.repeat)active.click();return;}
    if (code === 13 && active && active.tagName === "BUTTON" && !active.disabled) { event.preventDefault(); if (!event.repeat) active.click(); return; }
    if (!player.hidden && (code === 415 || code === 19 || code === 10252)) { event.preventDefault(); if (code === 10252 || code === 415 && video.paused || code === 19 && !video.paused) toggle(); return; }
    if (code < 37 || code > 40) return;
    if(!el("library").hidden&&(player.hidden||preview)&&!playback.scope()&&library.remote(code,active)){event.preventDefault();return;}
    if(code===38||code===40){
      var form=active;while(form&&form.tagName!=="FORM")form=form.parentElement;
      if(form){var ordered=form.querySelectorAll("[data-nav]"),fields=[];for(var fieldIndex=0;fieldIndex<ordered.length;fieldIndex++)if(visible(ordered[fieldIndex]))fields.push(ordered[fieldIndex]);var current=fields.indexOf(active),nextField=fields[current+(code===40?1:-1)];if(current!==-1&&nextField){event.preventDefault();focus(nextField);return;}}
    }
    if ((code === 37 || code === 39) && active.tagName === "INPUT") return;
    if ((code === 37 || code === 39) && active.tagName === "SELECT") { event.preventDefault(); active.selectedIndex = Math.max(0, Math.min(active.options.length - 1, active.selectedIndex + (code === 39 ? 1 : -1))); var change = document.createEvent("HTMLEvents"); change.initEvent("change", true, false); active.dispatchEvent(change); return; }
    var scope = !player.hidden && !preview ? player : !el("library").hidden ? el("library") : el("home");
    if(playback.scope())scope=playback.scope();
    var candidates = scope.querySelectorAll("[data-nav]"), from = active.getBoundingClientRect(), best = null, bestScore = Infinity;
    if (preview && !playback.scope()) candidates = document.querySelectorAll("#library [data-nav],#player [data-nav]");
    for (var i = 0; i < candidates.length; i++) { var node = candidates[i]; if (node === active || !visible(node)) continue; var r = node.getBoundingClientRect(), dx = r.left + r.width / 2 - (from.left + from.width / 2), dy = r.top + r.height / 2 - (from.top + from.height / 2); var main = code === 37 ? -dx : code === 39 ? dx : code === 38 ? -dy : dy, cross = code === 37 || code === 39 ? Math.abs(dy) : Math.abs(dx); if (main <= 2) continue; var score = main + cross * 3; if (score < bestScore) { best = node; bestScore = score; } }
    if (best) { event.preventDefault(); focus(best); }
  }, true);
  document.addEventListener("keyup", function (event) { if ((event.keyCode || event.which) === 461) { event.preventDefault(); event.stopPropagation(); } }, true);
  window.addEventListener("popstate", function () { playbackBack(); });
  function connectionLabel(){var badge=document.querySelector(".session-badge");badge.textContent=navigator.onLine===false?"Sem conexão":"Sua biblioteca";badge.className=navigator.onLine===false?"session-badge offline":"session-badge";}
  window.addEventListener("online",connectionLabel);window.addEventListener("offline",connectionLabel);connectionLabel();
  window.nexReady = true; var styled = parseInt(window.getComputedStyle(document.querySelector(".brand")).fontSize, 10) >= 30;
  el("initialization-status").setAttribute("data-initialization",styled?"ready":"style-failure");el("initialization-status").textContent = styled?"NEX TV · Versão 0.4.2":"Versão 0.4.2 · Estilo não carregado"; focus(vault.exists()&&vault.available()?el("vault-password"):el("source-focus"));
}());
