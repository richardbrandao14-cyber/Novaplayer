/* ES5: regras de URL independentes de Tauri e de APIs recentes do navegador. */
(function (root) {
  "use strict";
  function httpUrl(value) {
    if (typeof value !== "string" || value.length > 4096) throw new Error("URL inválida.");
    for (var i = 0; i < value.length; i++) if (value.charCodeAt(i) < 32 || value.charCodeAt(i) === 127) throw new Error("URL inválida.");
    var u;
    try { u = new URL(value); } catch (error) {
      // Não incluir a URL ou credenciais na causa; Error.cause também exige ES2022.
      // eslint-disable-next-line preserve-caught-error
      throw new Error("URL inválida.");
    }
    if ((u.protocol !== "http:" && u.protocol !== "https:") || !u.hostname || u.username || u.password) throw new Error("Use um endereço HTTP ou HTTPS sem credenciais no domínio.");
    return u;
  }
  function base(value) {
    var u = httpUrl(value);
    if (u.search || u.hash) throw new Error("Informe somente o endereço do servidor, sem parâmetros.");
    return (u.protocol + "//" + u.host + u.pathname).replace(/\/player_api\.php\/?$/i, "").replace(/\/+$/, "");
  }
  function api(config, action, id) {
    var url = base(config.server) + "/player_api.php?username=" + encodeURIComponent(config.user) + "&password=" + encodeURIComponent(config.password);
    if (action) url += "&action=" + encodeURIComponent(action);
    if (id) url += "&series_id=" + encodeURIComponent(id);
    return url;
  }
  function stream(config, kind, item, liveFormat) {
    if (item.direct_source) return httpUrl(item.direct_source).href;
    var id = String(kind === "series" ? item.id : item.stream_id);
    if (!/^\d{1,20}$/.test(id)) throw new Error("Identificador de reprodução não fornecido.");
    var ext = kind === "live" ? liveFormat : item.container_extension;
    if (!/^(mp4|mkv|m4v|avi|ts|m3u8|mov|webm)$/i.test(ext || "")) throw new Error("Formato não fornecido ou indisponível neste teste. Use uma URL direta.");
    return base(config.server) + "/" + (kind === "live" ? "live" : kind === "series" ? "series" : "movie") + "/" + encodeURIComponent(config.user) + "/" + encodeURIComponent(config.password) + "/" + id + "." + ext;
  }
  function records(value) {
    if (!Array.isArray(value)) throw new Error("O servidor não forneceu uma lista válida.");
    return value.slice(0, 40);
  }
  function episodes(value) {
    if (!value || !value.episodes || typeof value.episodes !== "object") throw new Error("A fonte não forneceu episódios.");
    var result = [], keys = Object.keys(value.episodes).sort(function (a, b) { return Number(a) - Number(b); });
    keys.forEach(function (key) {
      if (Array.isArray(value.episodes[key])) value.episodes[key].forEach(function (episode) {
        if (result.length < 40) result.push(episode);
      });
    });
    return result;
  }
  function mediaError(code) {
    return ({1:"Reprodução interrompida.",2:"Falha de rede durante a reprodução.",3:"A TV não conseguiu decodificar este conteúdo.",4:"Formato, codec ou endereço não aceito pelo player."})[code] || "Não foi possível reproduzir. Confira a fonte e a compatibilidade do aparelho.";
  }
  var exported = {httpUrl:httpUrl,base:base,api:api,stream:stream,records:records,episodes:episodes,mediaError:mediaError};
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  else root.NexDomain = exported;
}(this));
