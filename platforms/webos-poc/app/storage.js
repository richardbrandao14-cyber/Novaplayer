/* Persistência contém somente identificadores e preferências; nunca fontes ou credenciais. */
(function (root) {
  "use strict";
  function fingerprint(value) {
    var bytes = unescape(encodeURIComponent(value)), words = [], constants = [], primes = [], candidate = 2, i, j;
    while (primes.length < 64) { var prime = true; for (j = 2; j * j <= candidate; j++) if (candidate % j === 0) { prime = false; break; } if (prime) primes.push(candidate); candidate++; }
    var h = primes.slice(0,8).map(function (p) { return (Math.sqrt(p) % 1 * 4294967296) | 0; });
    primes.forEach(function (p) { constants.push((Math.pow(p,1/3) % 1 * 4294967296) | 0); });
    for (i = 0; i < bytes.length; i++) words[i >> 2] = (words[i >> 2] || 0) | bytes.charCodeAt(i) << (24 - i % 4 * 8);
    var length = bytes.length * 8; words[length >> 5] = (words[length >> 5] || 0) | 128 << (24 - length % 32); words[((length + 64 >> 9) << 4) + 15] = length;
    function rotate(n,b) { return n >>> b | n << (32-b); }
    for (i = 0; i < words.length; i += 16) {
      var w = [];
      for (j = 0; j < 64; j++) {
        var x = w[j-15], y = w[j-2];
        w[j] = j < 16 ? words[i+j] | 0 : ((rotate(x,7)^rotate(x,18)^x>>>3) + w[j-16] + (rotate(y,17)^rotate(y,19)^y>>>10) + w[j-7]) | 0;
      }
      var v = h.slice();
      for (j = 0; j < 64; j++) {
        var t1 = (v[7] + (rotate(v[4],6)^rotate(v[4],11)^rotate(v[4],25)) + (v[4]&v[5]^~v[4]&v[6]) + constants[j] + w[j]) | 0;
        var t2 = ((rotate(v[0],2)^rotate(v[0],13)^rotate(v[0],22)) + (v[0]&v[1]^v[0]&v[2]^v[1]&v[2])) | 0;
        v = [(t1+t2)|0,v[0],v[1],v[2],(v[3]+t1)|0,v[4],v[5],v[6]];
      }
      for (j = 0; j < 8; j++) h[j] = (h[j]+v[j])|0;
    }
    return h.map(function (n) { return ("00000000"+(n>>>0).toString(16)).slice(-8); }).join("");
  }
  function shelf(storage, report) {
    var name = "", state;
    function defaults() { return {version:1,favorites:{},watchlist:{},progress:{},settings:{autoNext:true,liveFormat:"m3u8"}}; }
    function validKey(key) { return /^(live|movie|series|episode):\d{1,20}$/.test(key); }
    function persist() { if (!name) return; try { storage.setItem(name,JSON.stringify(state)); } catch (error) { report("A TV não conseguiu salvar os dados. Libere espaço nas configurações do aparelho."); } }
    function connect(config) {
      name = "nex.shelf.v1." + fingerprint(config.server + "\n" + config.user); state = defaults();
      try {
        var raw = storage.getItem(name); if (!raw || raw.length > 1024*1024) return;
        var value = JSON.parse(raw); if (!value || value.version !== 1) return;
        Object.keys(value.favorites || {}).slice(0,4000).forEach(function (key) { if (validKey(key) && value.favorites[key] === true) state.favorites[key] = true; });
        Object.keys(value.watchlist || {}).slice(0,4000).forEach(function (key) { if (validKey(key) && value.watchlist[key] === true) state.watchlist[key] = true; });
        Object.keys(value.progress || {}).slice(0,2000).forEach(function (key) { var p=value.progress[key]; if (validKey(key) && p && typeof p.position === "number" && isFinite(p.position) && p.position >= 0 && p.position < 31536000) state.progress[key]={position:p.position,duration:typeof p.duration === "number" && isFinite(p.duration) ? p.duration : 0,parentId:/^\d{1,20}$/.test(String(p.parentId)) ? String(p.parentId) : "",updatedAt:Number(p.updatedAt)||0}; });
        if(value.settings&&(value.settings.liveFormat==="m3u8"||value.settings.liveFormat==="ts"))state.settings.liveFormat=value.settings.liveFormat;
        if (value.settings && typeof value.settings.autoNext === "boolean") state.settings.autoNext=value.settings.autoNext;
      } catch (error) { report("Não foi possível ler a biblioteca salva. Você pode continuar usando o app."); }
    }
    return {connect:connect, favorites:function () { return state ? state.favorites : {}; }, progress:function () { return state ? state.progress : {}; },
      favorite:function (key, selected) { if (!state || !validKey(key)) return; if (selected) { if (Object.keys(state.favorites).length>=4000 && !state.favorites[key]) { report("Limite de quatro mil favoritos atingido."); return; } state.favorites[key]=true; } else delete state.favorites[key]; persist(); },
      watchlist:function(){return state?state.watchlist:{};},
      list:function(key,selected){if(!state||!validKey(key))return;if(selected){if(Object.keys(state.watchlist).length>=4000&&!state.watchlist[key]){report("Limite de quatro mil itens na Minha lista atingido.");return;}state.watchlist[key]=true;}else delete state.watchlist[key];persist();},
      save:function (key, position, duration, parentId) { if (!state || !validKey(key) || !isFinite(position) || position < 0) return; state.progress[key]={position:position,duration:isFinite(duration)?duration:0,parentId:/^\d{1,20}$/.test(String(parentId))?String(parentId):"",updatedAt:Date.now()}; var keys=Object.keys(state.progress); if (keys.length>2000) { keys.sort(function(a,b){return state.progress[a].updatedAt-state.progress[b].updatedAt;}); delete state.progress[keys[0]]; } persist(); },
      autoNext:function (value) { if (!state) return true; if (typeof value === "boolean") { state.settings.autoNext=value; persist(); } return state.settings.autoNext; },
      format:function(value){if(!state)return "m3u8";if(value==="m3u8"||value==="ts"){state.settings.liveFormat=value;persist();}return state.settings.liveFormat;},
      erase:function () { if (!state) return; var settings=state.settings;state=defaults();state.settings=settings;persist(); },disconnect:function () { name=""; state=null; }};
  }
  var api={fingerprint:fingerprint,create:shelf};
  if (typeof window !== "undefined") { api.browser=function(report) { return shelf({getItem:function(k){return window.localStorage.getItem(k);},setItem:function(k,v){window.localStorage.setItem(k,v);}},report); }; window.NexShelf=api; } else if (typeof module !== "undefined") module.exports=api; else root.NexShelf=api;
}(this));
