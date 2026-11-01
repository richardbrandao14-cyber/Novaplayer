/* Catálogo local de identificação: aliases exatos, sem consulta externa ou fuzzy match. */
(function(){
  "use strict";
  var folder="assets/channel-logos/",index={},remote={},ambiguous={},files={},entries=[
  [
    "globo-br.png",
    [
      "Globo",
      "TV Globo",
      "Rede Globo",
      "Globo SP",
      "Globo São Paulo",
      "TV Globo SP",
      "TV Globo São Paulo",
      "Globo RJ",
      "Globo Rio de Janeiro",
      "TV Globo RJ",
      "Globo Brasília",
      "TV Globo Brasília",
      "Globo Minas",
      "Globo MG",
      "Globo Pernambuco",
      "Globo PE"
    ]
  ],
  [
    "globonews.default.svg",
    [
      "GloboNews",
      "Globo News"
    ]
  ],
  [
    "recordnews.default.svg",
    [
      "Record News"
    ]
  ],
  [
    "hbo.light.svg",
    [
      "HBO"
    ]
  ],
  [
    "hbo2.light.svg",
    [
      "HBO 2"
    ]
  ],
  [
    "espn.default.svg",
    [
      "ESPN"
    ]
  ],
  [
    "espn2.default.svg",
    [
      "ESPN 2"
    ]
  ],
  [
    "espn3.default.svg",
    [
      "ESPN 3"
    ]
  ],
  [
    "espn4.default.svg",
    [
      "ESPN 4"
    ]
  ],
  [
    "espn5.default.svg",
    [
      "ESPN 5"
    ]
  ],
  [
    "axn.light.svg",
    [
      "AXN"
    ]
  ],
  [
    "cartoonnetwork.light.svg",
    [
      "Cartoon Network"
    ]
  ],
  [
    "cinemax.light.svg",
    [
      "Cinemax"
    ]
  ],
  [
    "discoverychannel.light.svg",
    [
      "Discovery Channel",
      "Discovery"
    ]
  ],
  [
    "animalplanet.default.svg",
    [
      "Animal Planet"
    ]
  ],
  [
    "nationalgeographic.default.svg",
    [
      "National Geographic",
      "Nat Geo"
    ]
  ],
  [
    "tnt.default.svg",
    [
      "TNT"
    ]
  ],
  [
    "tcm.light.svg",
    [
      "TCM",
      "Turner Classic Movies"
    ]
  ],
  [
    "universalchannel.light.svg",
    [
      "Universal Channel"
    ]
  ],
  [
    "universaltv.default.svg",
    [
      "Universal TV"
    ]
  ],
  [
    "paramountnetwork.white.svg",
    [
      "Paramount Network"
    ]
  ],
  [
    "paramountchannel.default.svg",
    [
      "Paramount Channel"
    ]
  ],
  [
    "mtv.white.svg",
    [
      "MTV"
    ]
  ],
  [
    "boomerang.default.svg",
    [
      "Boomerang"
    ]
  ],
  [
    "cartoonito.light.svg",
    [
      "Cartoonito"
    ]
  ],
  [
    "discoveryturbo.light.svg",
    [
      "Discovery Turbo"
    ]
  ],
  [
    "investigationdiscovery.light.svg",
    [
      "Investigation Discovery",
      "ID Discovery"
    ]
  ],
  [
    "history.light.svg",
    [
      "History",
      "History Channel"
    ]
  ],
  [
    "history2.light.svg",
    [
      "History 2",
      "H2"
    ]
  ],
  [
    "tlc.default.svg",
    [
      "TLC"
    ]
  ],
  [
    "ae.light.svg",
    [
      "A&E",
      "A and E"
    ]
  ],
  [
    "amc.light.svg",
    [
      "AMC"
    ]
  ],
  [
    "cnn.white.svg",
    [
      "CNN"
    ]
  ],
  [
    "bbcnews.light.svg",
    [
      "BBC News"
    ]
  ],
  [
    "bbcearth.light.svg",
    [
      "BBC Earth"
    ]
  ],
  [
    "bloomberg.light.svg",
    [
      "Bloomberg",
      "Bloomberg TV",
      "Bloomberg Television"
    ]
  ],
  [
    "deutschewelle.light.svg",
    [
      "Deutsche Welle",
      "DW"
    ]
  ],
  [
    "france24.default.svg",
    [
      "France 24"
    ]
  ],
  [
    "euronews.white.svg",
    [
      "Euronews"
    ]
  ],
  [
    "aljazeera.white.svg",
    [
      "Al Jazeera"
    ]
  ],
  [
    "foodnetwork.default.svg",
    [
      "Food Network"
    ]
  ],
  [
    "travelchannel.default.svg",
    [
      "Travel Channel"
    ]
  ],
  [
    "fashiontv.default.svg",
    [
      "Fashion TV"
    ]
  ],
  [
    "syfy.light.svg",
    [
      "Syfy"
    ]
  ],
  [
    "espn6.default.svg",
    [
      "ESPN 6"
    ]
  ],
  [
    "foxnews.default.svg",
    [
      "Fox News"
    ]
  ],
  [
    "foxsports.default.svg",
    [
      "Fox Sports"
    ]
  ],
  [
    "foxsports2.light.svg",
    [
      "Fox Sports 2"
    ]
  ],
  [
    "eurosport1.light.svg",
    [
      "Eurosport 1"
    ]
  ],
  [
    "eurosport2.light.svg",
    [
      "Eurosport 2"
    ]
  ],
  [
    "tv5monde.default.svg",
    [
      "TV5 Monde"
    ]
  ],
  [
    "record-br.png",
    [
      "Record",
      "Record TV",
      "Rede Record",
      "TV Record",
      "Record SP",
      "Record RJ",
      "Record São Paulo",
      "Record Rio de Janeiro"
    ]
  ],
  [
    "sbt-br.png",
    [
      "SBT",
      "SBT SP",
      "SBT São Paulo"
    ]
  ],
  [
    "band-br.png",
    [
      "Band",
      "TV Band",
      "Rede Bandeirantes",
      "Band SP",
      "Band São Paulo"
    ]
  ],
  [
    "band-news-br.png",
    [
      "Band News",
      "BandNews"
    ]
  ],
  [
    "band-sports-br.png",
    [
      "Band Sports",
      "BandSports"
    ]
  ],
  [
    "sportv-br.png",
    [
      "SporTV",
      "SporTV 1"
    ]
  ],
  [
    "sportv2-br.png",
    [
      "SporTV 2"
    ]
  ],
  [
    "sportv3-br.png",
    [
      "SporTV 3"
    ]
  ],
  [
    "premiere-br.png",
    [
      "Premiere",
      "Premiere Clubes",
      "Premiere 1",
      "Premiere 2",
      "Premiere 3",
      "Premiere 4",
      "Premiere 5",
      "Premiere 6",
      "Premiere 7",
      "Premiere 8"
    ]
  ],
  [
    "gnt-br.png",
    [
      "GNT"
    ]
  ],
  [
    "multishow-br.png",
    [
      "Multishow"
    ]
  ],
  [
    "gloob-br.png",
    [
      "Gloob"
    ]
  ],
  [
    "gloobinho-br.png",
    [
      "Gloobinho"
    ]
  ],
  [
    "megapix-br.png",
    [
      "Megapix"
    ]
  ],
  [
    "tele-cine-premium-br.png",
    [
      "Telecine Premium"
    ]
  ],
  [
    "tele-cine-action-br.png",
    [
      "Telecine Action"
    ]
  ],
  [
    "tele-cine-pipoca-br.png",
    [
      "Telecine Pipoca"
    ]
  ],
  [
    "tele-cine-fun-br.png",
    [
      "Telecine Fun"
    ]
  ],
  [
    "tele-cine-cult-br.png",
    [
      "Telecine Cult"
    ]
  ],
  [
    "tele-cine-touch-br.png",
    [
      "Telecine Touch"
    ]
  ],
  [
    "hbo-family-br.png",
    [
      "HBO Family"
    ]
  ],
  [
    "hbo-mundi-br.png",
    [
      "HBO Mundi"
    ]
  ],
  [
    "hbo-plus-br.png",
    [
      "HBO Plus"
    ]
  ],
  [
    "hbo-pop-br.png",
    [
      "HBO Pop"
    ]
  ],
  [
    "hbo-signature-br.png",
    [
      "HBO Signature"
    ]
  ],
  [
    "hbo-xtreme-br.png",
    [
      "HBO Xtreme",
      "HBO Extreme"
    ]
  ],
  [
    "cnn-brasil-br.png",
    [
      "CNN Brasil"
    ]
  ],
  [
    "jovem-pan-news-br.png",
    [
      "Jovem Pan News",
      "JP News"
    ]
  ],
  [
    "jovem-pan-tv-br.png",
    [
      "Jovem Pan",
      "Jovem Pan TV"
    ]
  ],
  [
    "rede-tv-br.png",
    [
      "Rede TV",
      "RedeTV",
      "RedeTV!"
    ]
  ],
  [
    "tv-cultura-br.png",
    [
      "TV Cultura",
      "Cultura"
    ]
  ],
  [
    "tv-brasil-br.png",
    [
      "TV Brasil"
    ]
  ],
  [
    "tv-camara-br.png",
    [
      "TV Câmara"
    ]
  ],
  [
    "tv-senado-br.png",
    [
      "TV Senado"
    ]
  ],
  [
    "canal-brasil-br.png",
    [
      "Canal Brasil"
    ]
  ],
  [
    "canal-off-br.png",
    [
      "Canal OFF",
      "OFF"
    ]
  ],
  [
    "bis-br.png",
    [
      "BIS",
      "Canal BIS"
    ]
  ],
  [
    "arte1-br.png",
    [
      "Arte 1",
      "Arte1"
    ]
  ],
  [
    "sony-channel-br.png",
    [
      "Sony Channel",
      "Sony"
    ]
  ],
  [
    "sony-movies-br.png",
    [
      "Sony Movies"
    ]
  ],
  [
    "space-br.png",
    [
      "Space"
    ]
  ],
  [
    "warner-channel-br.png",
    [
      "Warner Channel",
      "Warner"
    ]
  ],
  [
    "tnt-series-br.png",
    [
      "TNT Series",
      "TNT Séries"
    ]
  ],
  [
    "discovery-kids-br.png",
    [
      "Discovery Kids"
    ]
  ],
  [
    "discovery-turbo-br.png",
    [
      "Discovery Turbo Brasil"
    ]
  ],
  [
    "dreamworks-channel-br.png",
    [
      "DreamWorks",
      "DreamWorks Channel"
    ]
  ],
  [
    "futura-br.png",
    [
      "Futura",
      "Canal Futura"
    ]
  ],
  [
    "rede-vida-br.png",
    [
      "Rede Vida",
      "RedeVida"
    ]
  ],
  [
    "tv-aparecida-br.png",
    [
      "TV Aparecida",
      "Aparecida"
    ]
  ],
  [
    "cancao-nova-tv-br.png",
    [
      "Canção Nova",
      "TV Canção Nova"
    ]
  ],
  [
    "novo-tempo-br.png",
    [
      "Novo Tempo",
      "TV Novo Tempo"
    ]
  ],
  [
    "canal-rural-br.png",
    [
      "Canal Rural"
    ]
  ],
  [
    "agro-mais-br.png",
    [
      "Agro Mais",
      "AgroMais"
    ]
  ],
  [
    "fish-tv-br.png",
    [
      "Fish TV"
    ]
  ]
];
  function normalize(value){
    return String(value||"").toLowerCase().replace(/^[\s[|({]*br[\s\]|)}:._-]+/,"")
      .replace(/[áàãâä]/g,"a").replace(/[éèêë]/g,"e").replace(/[íìîï]/g,"i").replace(/[óòõôö]/g,"o").replace(/[úùûü]/g,"u").replace(/ç/g,"c")
      .replace(/\[not\s+24\/7\]/g,"").replace(/\bfull\s+hd\b/g,"fullhd").replace(/\[(?:alt|alternativo|backup)\]/g,"").replace(/\b(?:30|50|60|120)\s*fps\b/g,"").replace(/\bh[ ._-]?26([45])\b/g,"h26$1").replace(/[^a-z0-9]+/g," ").replace(/\b(?:sd|hd|fhd|fullhd|uhd|4k|8k|720p|1080p|2160p|h264|h265|hevc)\b/g,"").replace(/\s+/g,"");
  }
  entries.forEach(function(entry){var path=folder+entry[0];files[path]=true;entry[1].forEach(function(alias){var key=normalize(alias);if(index[key]&&index[key]!==path)throw new Error("Alias de canal duplicado");index[key]=path;});});
  (window.NexChannelLogoData||[]).forEach(function(entry){var key=normalize(entry[0]);if(!key||ambiguous[key])return;if(remote[key]&&remote[key]!==entry[1]){delete remote[key];ambiguous[key]=true;return;}remote[key]=entry[1];});
  function lookup(item){return index[normalize(typeof item==="string"?item:item&&(item.name||item.title))]||"";}
  function candidates(item){var result=[];[item.stream_icon,item.logo,item["tvg-logo"]].forEach(function(value){if(typeof value==="string"&&value.trim()&&!/^(null|undefined|n\/a)$/i.test(value.trim())&&result.indexOf(value)===-1)result.push(value);});var local=lookup(item);if(local)result.push(local);var extra=remote[normalize(item.name||item.title)];if(extra&&result.indexOf(extra)===-1)result.push(extra);return result;}
  function initials(value){var words=String(value||"").trim().split(/\s+/).filter(function(word){return !/^(hd|fhd|uhd|4k|sd)$/i.test(word);});return words.slice(0,2).map(function(word){return word.charAt(0).toUpperCase();}).join("")||"TV";}
  window.NexChannelLogos={lookup:lookup,candidates:candidates,isLocal:function(value){return files[value]===true;},initials:initials,count:entries.length,remoteCount:Object.keys(remote).length,normalize:normalize};
}());
