/* TMDB opcional: token somente em memória, requisições independentes da lista. */
(function () {
  "use strict";
  var token = "", pending = null, cache = {}, epoch = 0;
  function cancel() { if (pending) pending.abort(); pending = null; }
  function request(path, done) {
    if (!token) { done(null); return; }
    cancel();
    var xhr = new XMLHttpRequest(); pending = xhr;
    xhr.open("GET", "https://api.themoviedb.org/3/" + path, true);
    xhr.timeout = 10000; xhr.setRequestHeader("Authorization", "Bearer " + token);
    xhr.onload = function () {
      if (pending !== xhr) return;
      pending = null;
      if (xhr.status !== 200 || xhr.responseText.length > 2097152) { done(null); return; }
      try { done(JSON.parse(xhr.responseText)); } catch (error) { done(null); }
    };
    xhr.onerror = xhr.ontimeout = function () { if (pending === xhr) { pending = null; done(null); } };
    xhr.send();
  }
  function normalized(value) { return String(value || "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function lookup(item, kind, info, done) {
    var type = kind === "series" ? "tv" : "movie", identifier = String(info.tmdb_id || info.tmdb || item.tmdb_id || "");
    var title = String(item.name || item.title || ""), year = String(info.releaseDate || info.releasedate || item.year || "").slice(0, 4);
    var key = type + ":" + identifier + ":" + title + ":" + year, generation = epoch;
    if (!token) { done(null); return; }
    if (cache[key]) { done(cache[key]); return; }
    function details(id) {
      request(type + "/" + id + "?language=pt-BR", function (data) {
        if (generation !== epoch || !data || !data.id) { done(null); return; }
        cache[key] = data; if (Object.keys(cache).length > 32) delete cache[Object.keys(cache)[0]];
        done(data);
      });
    }
    if (/^\d{1,12}$/.test(identifier)) { details(identifier); return; }
    request("search/" + type + "?language=pt-BR&include_adult=false&query=" + encodeURIComponent(title), function (data) {
      var matches = data && Array.isArray(data.results) ? data.results.filter(function (entry) {
        return (normalized(entry.title || entry.name) === normalized(title) || normalized(entry.original_title || entry.original_name) === normalized(title)) && (!/^\d{4}$/.test(year) || String(entry.release_date || entry.first_air_date || "").slice(0, 4) === year);
      }) : [];
      if (matches.length === 1) details(matches[0].id); else done(null);
    });
  }
  window.NexTmdb = {
    configure: function (value, done) {
      epoch++; cancel(); cache = {}; token = String(value || "").trim();
      if (!token || token.length > 4096 || /\s/.test(token)) { token = ""; done(false); return; }
      request("configuration", function (data) { var valid = !!(data && data.images); if (!valid) token = ""; done(valid); });
    },
    lookup: lookup,
    clear: function () { epoch++; cancel(); token = ""; cache = {}; },
    image: function (path) { return typeof path === "string" && /^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(path) ? "https://image.tmdb.org/t/p/w1280" + path : ""; }
  };
}());
