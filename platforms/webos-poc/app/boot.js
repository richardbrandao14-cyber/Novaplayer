(function () {
  "use strict";
  window.nexReady = false;
  window.addEventListener("error", function (event) {
    var node = document.getElementById("initialization-status");
    if (node) node.textContent = "Versão 0.4.7 · Falha de JavaScript · linha " + (Number(event.lineno) || 0) + ". Informe esse texto ao suporte.";
  });
  window.setTimeout(function () {
    var node = document.getElementById("initialization-status");
    if (!window.nexReady && node) node.textContent = "Versão 0.4.7 · A interface não iniciou. Informe esse texto ao suporte.";
  }, 8000);
}());
