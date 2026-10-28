/* Cofre opcional: credenciais apenas cifradas, senha de desbloqueio nunca persistida. */
(function (root) {
  "use strict";
  function create(crypto, storage) {
    var slot="nex.vault.v1", context=new Uint8Array([78,69,88,45,88,84,82,69,65,77,45,49]);
    function available() { return typeof Promise !== "undefined" && !!(crypto && crypto.subtle && crypto.getRandomValues); }
    function error(text) { return Promise.reject(new Error(text)); }
    function encode(text) { var s=unescape(encodeURIComponent(text)), b=new Uint8Array(s.length); for(var i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b; }
    function decode(bytes) { var s="", b=new Uint8Array(bytes);for(var i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return decodeURIComponent(escape(s)); }
    function key(pass,salt) { return crypto.subtle.importKey("raw",encode(pass),"PBKDF2",false,["deriveKey"]).then(function(material){return crypto.subtle.deriveKey({name:"PBKDF2",salt:salt,iterations:150000,hash:"SHA-256"},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);}); }
    function exists() { try { return !!storage.getItem(slot); }catch(e){return false;} }
    return {available:available,exists:exists,
      save:function(config,pass,current){
        if(!available())return error("Esta TV não disponibiliza o cofre criptografado. O acesso não será gravado.");
        if(typeof pass!=="string" || pass.length<8)return error("Use pelo menos oito caracteres na senha de desbloqueio.");
        var salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
        return key(pass,salt).then(function(k){return crypto.subtle.encrypt({name:"AES-GCM",iv:iv,additionalData:context},k,encode(JSON.stringify({server:config.server,user:config.user,password:config.password})));}).then(function(cipher){if(current&&!current())return error("Operação de acesso cancelada.");storage.setItem(slot,JSON.stringify({v:1,salt:Array.prototype.slice.call(salt),iv:Array.prototype.slice.call(iv),cipher:Array.prototype.slice.call(new Uint8Array(cipher))}));},function(){return error("Não foi possível proteger o acesso. Nenhuma senha foi gravada em texto aberto.");});
      },
      open:function(pass){
        if(!available())return error("O cofre criptografado não está disponível nesta TV.");
        var value;try{var raw=storage.getItem(slot);if(!raw||raw.length>100000)throw new Error();value=JSON.parse(raw);if(value.v!==1||!Array.isArray(value.salt)||value.salt.length!==16||!Array.isArray(value.iv)||value.iv.length!==12||!Array.isArray(value.cipher)||value.cipher.length>16384)throw new Error();}catch(e){return error("O acesso salvo não pôde ser lido. Cadastre a lista novamente.");}
        return key(pass,new Uint8Array(value.salt)).then(function(k){return crypto.subtle.decrypt({name:"AES-GCM",iv:new Uint8Array(value.iv),additionalData:context},k,new Uint8Array(value.cipher));}).then(function(bytes){var config=JSON.parse(decode(bytes));if(!config||typeof config.server!=="string"||config.server.length>2048||typeof config.user!=="string"||config.user.length>256||typeof config.password!=="string"||config.password.length>256)return error("Acesso salvo inválido. Cadastre novamente.");return config;},function(){return error("Senha de desbloqueio incorreta ou acesso salvo danificado.");});
      },forget:function(){try{storage.removeItem(slot);}catch(e){return false;}return true;}};
  }
  var api={create:create};if(typeof window!=="undefined"){api.browser=function(){return create(window.crypto,{getItem:function(k){return window.localStorage.getItem(k);},setItem:function(k,v){window.localStorage.setItem(k,v);},removeItem:function(k){window.localStorage.removeItem(k);}});};window.NexVault=api;}else if(typeof module!=="undefined")module.exports=api;else root.NexVault=api;
}(this));
