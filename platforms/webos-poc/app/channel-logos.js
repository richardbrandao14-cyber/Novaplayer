/* Catálogo local de identificação: aliases exatos, sem consulta externa ou fuzzy match. */
(function(){
  "use strict";
  var folder="assets/channel-logos/",index={},remote={},ambiguous={},files={},entries=[
    ["tvglobo.default.svg",["Globo","TV Globo","Rede Globo"]],
    ["globonews.default.svg",["GloboNews","Globo News"]],
    ["recordnews.default.svg",["Record News"]],
    ["hbo.light.svg",["HBO"]],["hbo2.light.svg",["HBO 2"]],
    ["espn.default.svg",["ESPN"]],["espn2.default.svg",["ESPN 2"]],
    ["espn3.default.svg",["ESPN 3"]],["espn4.default.svg",["ESPN 4"]],
    ["espn5.default.svg",["ESPN 5"]],["axn.light.svg",["AXN"]],
    ["cartoonnetwork.light.svg",["Cartoon Network"]],
    ["cinemax.light.svg",["Cinemax"]],
    ["discoverychannel.light.svg",["Discovery Channel","Discovery"]],
    ["animalplanet.default.svg",["Animal Planet"]],
    ["nationalgeographic.default.svg",["National Geographic","Nat Geo"]],
    ["tnt.default.svg", ["TNT"]],
    ["tcm.light.svg", ["TCM", "Turner Classic Movies"]],
    ["universalchannel.light.svg", ["Universal Channel"]],
    ["universaltv.default.svg", ["Universal TV"]],
    ["paramountnetwork.white.svg", ["Paramount Network"]],
    ["paramountchannel.default.svg", ["Paramount Channel"]],
    ["mtv.white.svg", ["MTV"]],
    ["boomerang.default.svg", ["Boomerang"]],
    ["cartoonito.light.svg", ["Cartoonito"]],
    ["discoveryturbo.light.svg", ["Discovery Turbo"]],
    ["investigationdiscovery.light.svg", ["Investigation Discovery", "ID Discovery"]],
    ["history.light.svg", ["History", "History Channel"]],
    ["history2.light.svg", ["History 2", "H2"]],
    ["tlc.default.svg", ["TLC"]],
    ["ae.light.svg", ["A&E", "A and E"]],
    ["amc.light.svg", ["AMC"]],
    ["cnn.white.svg", ["CNN"]],
    ["bbcnews.light.svg", ["BBC News"]],
    ["bbcearth.light.svg", ["BBC Earth"]],
    ["bloomberg.light.svg", ["Bloomberg", "Bloomberg TV", "Bloomberg Television"]],
    ["deutschewelle.light.svg", ["Deutsche Welle", "DW"]],
    ["france24.default.svg", ["France 24"]],
    ["euronews.white.svg", ["Euronews"]],
    ["aljazeera.white.svg", ["Al Jazeera"]],
    ["foodnetwork.default.svg", ["Food Network"]],
    ["travelchannel.default.svg", ["Travel Channel"]],
    ["fashiontv.default.svg", ["Fashion TV"]],
    ["syfy.light.svg", ["Syfy"]],
    ["espn6.default.svg", ["ESPN 6"]],
    ["foxnews.default.svg", ["Fox News"]],
    ["foxsports.default.svg", ["Fox Sports"]],
    ["foxsports2.light.svg", ["Fox Sports 2"]],
    ["eurosport1.light.svg", ["Eurosport 1"]],
    ["eurosport2.light.svg", ["Eurosport 2"]],
    ["tv5monde.default.svg", ["TV5 Monde"]]
  ];
  function normalize(value){
    return String(value||"").toLowerCase().replace(/^[\s[|({]*br[\s\]|)}:._-]+/,"")
      .replace(/[áàãâä]/g,"a").replace(/[éèêë]/g,"e").replace(/[íìîï]/g,"i").replace(/[óòõôö]/g,"o").replace(/[úùûü]/g,"u").replace(/ç/g,"c")
      .replace(/\[not\s+24\/7\]/g,"").replace(/\bfull\s+hd\b/g,"fullhd").replace(/[^a-z0-9]+/g," ").replace(/\b(?:sd|hd|fhd|fullhd|uhd|4k|8k|720p|1080p|2160p|h264|h265|hevc)\b/g,"").replace(/\s+/g,"");
  }
  entries.forEach(function(entry){var path=folder+entry[0];files[path]=true;entry[1].forEach(function(alias){var key=normalize(alias);if(index[key]&&index[key]!==path)throw new Error("Alias de canal duplicado");index[key]=path;});});
  (window.NexChannelLogoData||[]).forEach(function(entry){var key=normalize(entry[0]);if(!key||ambiguous[key])return;if(remote[key]&&remote[key]!==entry[1]){delete remote[key];ambiguous[key]=true;return;}remote[key]=entry[1];});
  function lookup(item){return index[normalize(typeof item==="string"?item:item&&(item.name||item.title))]||"";}
  function candidates(item){var result=[];[item.stream_icon,item.logo,item["tvg-logo"]].forEach(function(value){if(typeof value==="string"&&value.trim()&&!/^(null|undefined|n\/a)$/i.test(value.trim())&&result.indexOf(value)===-1)result.push(value);});var local=lookup(item);if(local)result.push(local);var extra=remote[normalize(item.name||item.title)];if(extra&&result.indexOf(extra)===-1)result.push(extra);return result;}
  function initials(value){var words=String(value||"").trim().split(/\s+/).filter(function(word){return !/^(hd|fhd|uhd|4k|sd)$/i.test(word);});return words.slice(0,2).map(function(word){return word.charAt(0).toUpperCase();}).join("")||"TV";}
  window.NexChannelLogos={lookup:lookup,candidates:candidates,isLocal:function(value){return files[value]===true;},initials:initials,count:entries.length,remoteCount:Object.keys(remote).length,normalize:normalize};
}());
