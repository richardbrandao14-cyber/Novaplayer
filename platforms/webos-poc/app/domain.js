/* ES5: regras de URL independentes de Tauri e de APIs recentes do navegador. */
(function (root) {
  "use strict";
  function invalid() { return new Error("Não foi possível ler o endereço. Confira o domínio e a porta do servidor."); }
  function normalize(value) {
    if(typeof value!=="string" || value.length>4096)throw invalid();
    value=value.replace(/^[\s\u200B-\u200D\u2060\uFEFF]+|[\s\u200B-\u200D\u2060\uFEFF]+$/g,"");
    if((value.charAt(0)==='"'&&value.slice(-1)==='"')||(value.charAt(0)==="'"&&value.slice(-1)==="'")||(value.charAt(0)==="<"&&value.slice(-1)===">"))value=value.slice(1,-1).trim();
    if(/^(javascript|data|file|ftp|rtsp|rtmp):/i.test(value))throw new Error("Use um endereço HTTP ou HTTPS para esta fonte.");
    if(!/^https?\s*(?::|[/\\])/i.test(value)){var links=value.match(/https?\s*:\s*(?:[/\\]\s*)*[^\s<>"']+/ig);if(links&&links.length>1)throw new Error("Cole somente um endereço de servidor por vez.");if(links&&links.length===1)value=links[0];}
    if(!value || /^(https?|www\.?)$/i.test(value))throw invalid();
    value=value.replace(/^(https?)\s*:\s*(?:[/\\]\s*)*/i,function(match,scheme){return scheme.toLowerCase()+"://";});
    value=value.replace(/^(https?)\s*[/\\]+\s*/i,function(match,scheme){return scheme.toLowerCase()+"://";});
    if(value.indexOf("//")===0)value="http:"+value;
    if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(value) && !/^(javascript|data|file|ftp|rtsp|rtmp):/i.test(value))value="http://"+value;
    return value;
  }
  function httpUrl(value) {
    if(typeof value!=="string" || value.length>4096 || !/^https?:\/\//i.test(value))throw invalid();
    for(var i=0;i<value.length;i++)if(value.charCodeAt(i)<32 || value.charCodeAt(i)===127)throw invalid();
    var u;
    try { if(typeof URL!=="undefined")u=new URL(value); }catch(error){u=null;}
    if(!u && typeof document!=="undefined"){
      var anchor=document.createElement("a");anchor.href=value;
      u={href:anchor.href,protocol:anchor.protocol,hostname:anchor.hostname,host:anchor.host,pathname:anchor.pathname||"/",search:anchor.search||"",hash:anchor.hash||"",username:anchor.username||"",password:anchor.password||""};
    }
    if(!u || (u.protocol!=="http:"&&u.protocol!=="https:") || !u.hostname || !u.host)throw invalid();
    var authority=/^https?:\/\/([^/?#]*)/i.exec(value);
    if(u.username || u.password || authority&&authority[1].indexOf("@")!==-1)throw new Error("Use os campos de usuário e senha para informar seu acesso.");
    return u;
  }
  function imageUrl(value,server) {
    if(typeof value!=="string"||value.length>4096)return "";
    value=value.trim();if(!value)return "";
    try{
      if(/^https?:\/\//i.test(value))return httpUrl(value).href;
      for(var i=0;i<value.length;i++){var code=value.charCodeAt(i);if(code<32||code===127||code===92)return "";}
      if(/^[a-z][a-z0-9+.-]*:/i.test(value))return "";
      var origin=httpUrl(base(server));
      if(value.indexOf("//")===0)value=origin.protocol+value;
      else if(value.charAt(0)==="/")value=origin.protocol+"//"+origin.host+value;
      else value=base(server)+"/"+value;
      return httpUrl(value).href;
    }catch(error){return "";}
  }
  function rootOf(u) { return (u.protocol+"//"+u.host+u.pathname.replace(/\/(?:player_api|panel_api|get|xmltv)\.php\/?$/i,"")).replace(/\/+$/,""); }
  function base(value) {
    var u=httpUrl(normalize(value));
    if(u.search || u.hash)throw new Error("Cole o link completo no cadastro da fonte para identificar o acesso.");
    return rootOf(u);
  }
  function decode(value) { try{return decodeURIComponent(value.replace(/\+/g," "));}catch(error){return "";} }
  function extra(config) {
    var result="", reserved=/^(username|password|action|series_id|vod_id|stream_id|type|output)(?:$|\[)/i;
    if(!Array.isArray(config.apiQuery))return result;
    config.apiQuery.slice(0,32).forEach(function(pair){if(Array.isArray(pair)&&typeof pair[0]==="string"&&pair[0].length<=128&&typeof pair[1]==="string"&&pair[1].length<=1024&&!reserved.test(pair[0]))result+="&"+encodeURIComponent(pair[0])+"="+encodeURIComponent(pair[1]);});
    return result;
  }
  function source(value,user,password) {
    value=normalize(value);var extractedUser="",extractedPassword="";
    var authority=/^(https?:\/\/)([^/?#]*)(.*)$/i.exec(value);
    if(authority&&authority[2].indexOf("@")!==-1){
      var at=authority[2].lastIndexOf("@"),info=authority[2].slice(0,at),colon=info.indexOf(":");
      try{extractedUser=decodeURIComponent(colon<0?info:info.slice(0,colon));extractedPassword=colon<0?"":decodeURIComponent(info.slice(colon+1));}catch(error){throw invalid();}
      value=authority[1]+authority[2].slice(at+1)+authority[3];
    }
    var u=httpUrl(value),query=u.search.replace(/^\?/,"").split("&"),params={},pairs=[];
    query.forEach(function(part){if(!part)return;var at=part.indexOf("="),name=decode(at<0?part:part.slice(0,at)),content=decode(at<0?"":part.slice(at+1)),key=name.toLowerCase();
      if(key==="username"||key==="password"){if(params[key]!==undefined&&params[key]!==content)throw new Error("O link contém dados de acesso duplicados. Use o servidor e os campos de usuário e senha.");params[key]=content;}
      else if(key==="output")params.output=content.toLowerCase();
      else if(!/^(action|series_id|vod_id|stream_id|type)$/i.test(key))pairs.push([name,content]);
    });
    var path=u.pathname,stream=/^(.*)\/(live|movie|series)\/([^/]+)\/([^/]+)\/[^/]+$/i.exec(path);
    if(stream){try{extractedUser=decodeURIComponent(stream[3]);extractedPassword=decodeURIComponent(stream[4]);}catch(error){throw invalid();}path=stream[1]||"/";}
    var server=rootOf({protocol:u.protocol,host:u.host,pathname:path});
    var result={server:server,user:String(user||params.username||extractedUser||"").trim(),password:String(password||params.password||extractedPassword||"")};
    if(result.user.length>256||result.password.length>256)throw new Error("Os dados de acesso excedem o tamanho aceito.");
    if(pairs.length)result.apiQuery=pairs;
    if(params.output==="ts"||params.output==="mpegts")result.liveFormat="ts";
    if(params.output==="m3u8"||params.output==="hls")result.liveFormat="m3u8";
    return result;
  }
  function api(config, action, id) {
    var url = base(config.server) + "/player_api.php?username=" + encodeURIComponent(config.user) + "&password=" + encodeURIComponent(config.password);
    if (action) url += "&action=" + encodeURIComponent(action);
    if (id) url += (action === "get_vod_info" ? "&vod_id=" : action === "get_short_epg" ? "&stream_id=" : "&series_id=") + encodeURIComponent(id);
    return url+extra(config);
  }
  function stream(config, kind, item, liveFormat) {
    if (item.direct_source) return httpUrl(item.direct_source).href;
    var id = String(kind === "series" ? item.id : item.stream_id);
    if (!/^\d{1,20}$/.test(id)) throw new Error("Identificador de reprodução não fornecido.");
    var ext = kind === "live" ? liveFormat : item.container_extension;
    if (!/^(mp4|mkv|m4v|avi|ts|m3u8|mov|webm)$/i.test(ext || "")) throw new Error("Formato não fornecido ou indisponível neste teste. Use uma URL direta.");
    return base(config.server) + "/" + (kind === "live" ? "live" : kind === "series" ? "series" : "movie") + "/" + encodeURIComponent(config.user) + "/" + encodeURIComponent(config.password) + "/" + id + "." + ext + (extra(config) ? "?"+extra(config).slice(1) : "");
  }
  function records(value) {
    var list=value;
    if(!Array.isArray(list)&&list&&typeof list==="object"){
      var wrappers=["data","streams","channels","movies","series","categories","results"];
      for(var i=0;i<wrappers.length;i++)if(Array.isArray(list[wrappers[i]])){list=list[wrappers[i]];break;}
      if(!Array.isArray(list)){
        var keys=Object.keys(list);
        if(keys.length&&keys.every(function(k){var item=list[k];return /^\d+$/.test(k)&&item&&typeof item==="object"&&(item.stream_id!==undefined||item.series_id!==undefined||item.category_id!==undefined);}))list=keys.map(function(k){return list[k];});
      }
    }
    if(!Array.isArray(list)){var error=new Error("A fonte respondeu, mas não enviou um catálogo reconhecível. Tente atualizar ou conferir o acesso no provedor.");error.code="CATALOG_FORMAT";throw error;}
    return list.filter(function(item){return item&&typeof item==="object";});
  }
  function episodes(value) {
    if (!value || !value.episodes || typeof value.episodes !== "object") throw new Error("A fonte não forneceu episódios.");
    var result = [], keys = Object.keys(value.episodes).sort(function (a, b) { return Number(a) - Number(b); });
    keys.forEach(function (key) {
      if (Array.isArray(value.episodes[key])) value.episodes[key].forEach(function (episode) {
        if (episode && typeof episode === "object") result.push(episode);
      });
    });
    return result;
  }
  function epg(value) {
    function decode(text) {
      text=typeof text === "string" ? text : "";
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(text) || text.length%4) return text;
      try { return decodeURIComponent(escape(atob(text))); } catch(error) { return text; }
    }
    var rows=value && value.epg_listings;
    if (!Array.isArray(rows)) return [];
    return rows.filter(function(row){return row && typeof row === "object";}).slice(0,40).map(function(row){
      var start=Number(row.start_timestamp)*1000;
      return {title:decode(row.title)||"Título não fornecido",description:decode(row.description),start:isFinite(start)&&start>0?start:0};
    });
  }
  function resolution(width,height){
    width=Math.floor(Number(width));height=Math.floor(Number(height));
    if(!isFinite(width)||!isFinite(height)||width<=0||height<=0)return "Resolução aguardando…";
    var large=Math.max(width,height),small=Math.min(width,height),name=large>=7680&&small>=4320?"8K":large>=3840&&small>=2160?"4K":large>=2560&&small>=1440?"QHD":large>=1920&&small>=1080?"Full HD":large>=1280&&small>=720?"HD":"SD";
    return name+" · "+width+" × "+height;
  }
  function mediaError(code) {
    return ({1:"Reprodução interrompida.",2:"Falha de rede durante a reprodução.",3:"A TV não conseguiu decodificar este conteúdo.",4:"Formato, codec ou endereço não aceito pelo player."})[code] || "Não foi possível reproduzir. Confira a fonte e a compatibilidade do aparelho.";
  }
  var exported = {imageUrl:imageUrl,source:source,httpUrl:httpUrl,base:base,api:api,stream:stream,records:records,episodes:episodes,epg:epg,resolution:resolution,mediaError:mediaError};
  if (typeof window !== "undefined") window.NexDomain = exported;
  else if (typeof module !== "undefined" && module.exports) module.exports = exported;
  else root.NexDomain = exported;
}(this));
