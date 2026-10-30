/* TikTok Downloader - atualizacao automatica (CEP + Node)
 *
 * Fluxo: le CSXS/manifest.xml da extensao instalada -> baixa um version.json
 * publicado -> se a versao de la for maior, mostra o botao "Atualizar" ->
 * baixa o zip, descompacta por cima da pasta da extensao e pede para
 * reiniciar o Premiere.
 *
 * O endereco do version.json fica em URL_VERSAO (ou em
 * ~/Library/Application Support/TikTokDownloader/config.json, chave "update_url").
 */
(function () {
  "use strict";

  var fs = require("fs");
  var os = require("os");
  var path = require("path");
  var https = require("https");
  var cp = require("child_process");

  var URL_VERSAO = "https://github.com/guilhermehH-wq/TikTokDownloader/releases/latest/download/version.json";
  var CONFIG_FILE = path.join(os.homedir(), "Library", "Application Support", "TikTokDownloader", "config.json");

  function raizExtensao() {
    try {
      var p = decodeURIComponent(window.location.pathname);
      return path.dirname(p);
    } catch (e) {
      return "";
    }
  }

  function versaoInstalada() {
    try {
      var xml = fs.readFileSync(path.join(raizExtensao(), "CSXS", "manifest.xml"), "utf8");
      var m = xml.match(/ExtensionBundleVersion="([^"]+)"/);
      return m ? m[1] : "";
    } catch (e) {
      return "";
    }
  }

  function urlAtualizacao() {
    if (URL_VERSAO) { return URL_VERSAO; }
    try {
      var cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      return (cfg && cfg.update_url) || "";
    } catch (e) {
      return "";
    }
  }

  function comparar(a, b) {
    var pa = String(a).split(".");
    var pb = String(b).split(".");
    for (var i = 0; i < Math.max(pa.length, pb.length); i++) {
      var na = parseInt(pa[i], 10) || 0;
      var nb = parseInt(pb[i], 10) || 0;
      if (na !== nb) { return na < nb ? -1 : 1; }
    }
    return 0;
  }

  // GET com follow de redirect (GitHub Releases responde 302).
  function abrir(url, saltos) {
    if (saltos < 0) { return Promise.reject(new Error("Muitos redirecionamentos")); }
    return new Promise(function (resolve, reject) {
      https.get(url, { headers: { "User-Agent": "TikTokDownloader-CEP" } }, function (res) {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          resolve(abrir(res.headers.location, saltos - 1));
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error("HTTP " + res.statusCode + " em " + url));
        }
        resolve(res);
      }).on("error", reject);
    });
  }

  function baixar(url, destino) {
    return abrir(url, 5).then(function (res) {
      return new Promise(function (resolve, reject) {
        var out = fs.createWriteStream(destino);
        res.pipe(out);
        out.on("finish", function () { out.close(function () { resolve(destino); }); });
        out.on("error", reject);
      });
    });
  }

  function baixarTexto(url) {
    return abrir(url, 5).then(function (res) {
      return new Promise(function (resolve, reject) {
        var dados = "";
        res.on("data", function (d) { dados += d.toString(); });
        res.on("end", function () { resolve(dados); });
        res.on("error", reject);
      });
    });
  }

  // Verifica se existe versao nova. Resolve com {versao, url} ou null.
  function checar() {
    var url = urlAtualizacao();
    if (!url) { return Promise.resolve(null); }
    // Evita o cache do CDN do GitHub (senao o "latest" fica preso no release anterior).
    var semCache = url + (url.indexOf("?") === -1 ? "?" : "&") + "t=" + Date.now();
    return baixarTexto(semCache).then(function (txt) {
      var info = JSON.parse(txt);
      var atual = versaoInstalada();
      if (!info || !info.version || !info.url) { return null; }
      if (!atual || comparar(atual, info.version) >= 0) { return null; }
      return { versao: info.version, url: info.url, notas: info.notes || "" };
    });
  }

  function extrair(zip, destino) {
    var r = cp.spawnSync("/usr/bin/unzip", ["-oq", zip, "-d", destino], { encoding: "utf8" });
    if (r.status !== 0) {
      throw new Error("Não consegui descompactar: " + String(r.stderr || "").trim());
    }
  }

  // Aplica o zip baixado sobre a pasta da extensao instalada.
  function aplicar(urlZip, aoProgredir) {
    var raiz = raizExtensao();
    var tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ttdl-upd-"));
    var zip = path.join(tmp, "pacote.zip");
    return baixar(urlZip, zip)
      .then(function () {
        if (aoProgredir) { aoProgredir("Descompactando..."); }
        var extraido = path.join(tmp, "x");
        fs.mkdirSync(extraido, { recursive: true });
        extrair(zip, extraido);

        // O zip vem com uma pasta raiz (TikTokDownloader-<versao>).
        var entradas = fs.readdirSync(extraido).filter(function (n) { return n.charAt(0) !== "."; });
        var origem = extraido;
        if (entradas.length === 1) {
          var unica = path.join(extraido, entradas[0]);
          if (fs.statSync(unica).isDirectory()) { origem = unica; }
        }

        if (aoProgredir) { aoProgredir("Instalando..."); }
        var r = cp.spawnSync("/usr/bin/ditto", [origem + "/", raiz + "/"], { encoding: "utf8" });
        if (r.status !== 0) {
          throw new Error("Não consegui copiar os arquivos: " + String(r.stderr || "").trim());
        }
        try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { }
        return versaoInstalada();
      });
  }

  window.TTUpdate = { checar: checar, aplicar: aplicar, versao: versaoInstalada };
})();
