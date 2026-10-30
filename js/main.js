/* TikTok Downloader - painel CEP para Premiere Pro (macOS)
 *
 * Fluxo: pasta do projeto -> yt-dlp baixa em Downloads_TikTok -> ExtendScript
 * importa para o bin "TikTok" e insere no playhead (V1 + A1).
 *
 * Notas de implementacao:
 * - Requer Node no CEP: --enable-nodejs + --mixed-context (manifest) e
 *   PlayerDebugMode=1 (extensao sem assinatura).
 * - O Premiere aberto pelo Finder nao herda o PATH do Terminal, por isso os
 *   binarios do Homebrew sao procurados em caminhos absolutos.
 * - O caminho do arquivo baixado e lido de um arquivo temporario
 *   (--print-to-file) em vez de stdout, para nao competir com a barra de
 *   progresso do yt-dlp.
 */
(function () {
  "use strict";

  var cp = require("child_process");
  var fs = require("fs");
  var os = require("os");
  var path = require("path");

  var BIN_DIRS = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];

  // Config persistente, por caminho de projeto (.prproj).
  var CONFIG_DIR = path.join(os.homedir(), "Library", "Application Support", "TikTokDownloader");
  var CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

  var projetoAtual = "";
  var pastaAtual = "";

  var elUrl = document.getElementById("url");
  var elBtn = document.getElementById("btn");
  var elPasta = document.getElementById("pasta");
  var elBtnPasta = document.getElementById("btnPasta");
  var elStatus = document.getElementById("status");
  var elBarra = document.getElementById("barra");
  var elBarraFill = elBarra.firstElementChild;

  function setStatus(msg, tipo) {
    elStatus.textContent = msg;
    elStatus.className = tipo || "";
  }

  function progresso(pct) {
    if (pct === null || pct === undefined) {
      elBarraFill.style.width = "0%";
      elBarra.classList.remove("carregando");
      return;
    }
    var p = Math.max(0, Math.min(100, pct));
    elBarraFill.style.width = p + "%";
    if (p > 0 && p < 100) { elBarra.classList.add("carregando"); }
    else { elBarra.classList.remove("carregando"); }
  }

  // O design mantém o botão desligado enquanto o campo do link está vazio.
  function syncBtn() {
    elBtn.disabled = !elUrl.value.trim();
  }

  function jsx(code) {
    return new Promise(function (resolve) {
      window.__adobe_cep__.evalScript(code, function (res) { resolve(String(res)); });
    });
  }

  function lerConfig() {
    try {
      var cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
      if (!cfg || typeof cfg !== "object") { return { projetos: {} }; }
      if (!cfg.projetos) { cfg.projetos = {}; }
      return cfg;
    } catch (e) {
      return { projetos: {} };
    }
  }

  function salvarConfig(cfg) {
    try {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
      return true;
    } catch (e) {
      return false;
    }
  }

  function lembrarPasta() {
    if (!projetoAtual || !pastaAtual) { return; }
    var cfg = lerConfig();
    cfg.projetos[projetoAtual] = pastaAtual;
    salvarConfig(cfg);
  }

  function mostrarPasta() {
    elPasta.value = pastaAtual || "";
    elPasta.title = pastaAtual || "";
  }

  // Carrega o projeto aberto e a pasta salva para ele (ou sugere a pasta padrao).
  async function carregarProjeto() {
    try {
      var caminho = await jsx("getProjectPath()");
      if (!caminho || caminho === "undefined" || caminho === "EvalScript error." || caminho.indexOf("ERRO:") === 0) {
        projetoAtual = "";
        pastaAtual = "";
        mostrarPasta();
        elPasta.placeholder = "Salve o projeto para definir a pasta";
        return;
      }

      projetoAtual = caminho;
      var cfg = lerConfig();
      pastaAtual = caminhoDeUrl(cfg.projetos[caminho] || "");

      if (!pastaAtual) {
        var dir = await jsx("getProjectDir()");
        if (dir && dir.indexOf("ERRO:") !== 0 && dir !== "undefined") {
          pastaAtual = path.join(dir, "Downloads_TikTok");
          lembrarPasta();
        }
      }
      elPasta.placeholder = "Escolha uma pasta";
      mostrarPasta();
    } catch (e) {
      projetoAtual = "";
      pastaAtual = "";
      mostrarPasta();
    }
  }

  async function escolherPasta() {
    if (!projetoAtual) {
      return setStatus("Salve o projeto primeiro: a pasta é guardada por projeto.", "erro");
    }
    var r = window.cep.fs.showOpenDialog(false, true, "Escolha a pasta de downloads", pastaAtual || "", []);
    if (r && r.err === 0 && r.data && r.data.length) {
      pastaAtual = caminhoDeUrl(r.data[0]);
      mostrarPasta();
      lembrarPasta();
      setStatus("Pasta deste projeto salva:\n" + pastaAtual, "ok");
    }
  }

  // O showOpenDialog do CEP devolve URL (file:///...) em algumas versões.
  function caminhoDeUrl(p) {
    var s = String(p || "");
    if (s.indexOf("file://") === 0) {
      s = s.substring(7);
      try { s = decodeURIComponent(s); } catch (e) { /* mantém como veio */ }
    }
    while (s.length > 1 && s.charAt(s.length - 1) === "/") { s = s.slice(0, -1); }
    return s;
  }

  function achar(bin) {
    for (var i = 0; i < BIN_DIRS.length; i++) {
      var p = path.join(BIN_DIRS[i], bin);
      if (fs.existsSync(p)) { return p; }
    }
    return null;
  }

  function extrairUrl(txt) {
    var m = String(txt || "").match(/https?:\/\/[^\s"'<>]+/);
    return m ? m[0].replace(/[.,;)\]]+$/, "") : "";
  }

  // Aceita apenas link de vídeo: /@user/video/123, /t/CODIGO, vm./vt.tiktok.com/CODIGO
  function ehVideo(u) {
    if (!/^https?:\/\/(([a-z0-9-]+\.)*tiktok\.com)\//i.test(u)) { return false; }
    if (/\/video\/\d+/i.test(u)) { return true; }
    if (/\/photo\/\d+/i.test(u)) { return true; }
    if (/^https?:\/\/(vm|vt)\.tiktok\.com\/[A-Za-z0-9]+/i.test(u)) { return true; }
    if (/tiktok\.com\/t\/[A-Za-z0-9]+/i.test(u)) { return true; }
    return false;
  }

  function ehPerfilOuInicio(u) {
    if (!/^https?:\/\/(([a-z0-9-]+\.)*tiktok\.com)/i.test(u)) { return false; }
    return /tiktok\.com\/?$/i.test(u) || /tiktok\.com\/@[^\/]+\/?(\?|$)/i.test(u);
  }

  function erroAmigavel(stderr) {
    var s = String(stderr || "");
    if (/HTTP Error 403/i.test(s)) {
      return "O TikTok recusou o download (erro 403).\nAtualize o yt-dlp no Terminal: brew upgrade yt-dlp\ne tente de novo.";
    }
    if (/login|sign in|not available in your country|private video/i.test(s)) {
      return "O TikTok pediu login para este vídeo.\nVídeos privados não são suportados neste painel.";
    }
    if (/Unable to extract|Failed to parse|No video formats/i.test(s)) {
      return "O yt-dlp não conseguiu ler este vídeo.\nAtualize: brew upgrade yt-dlp  (ou pip install -U \"yt-dlp[default]\")";
    }
    if (/Unsupported URL/i.test(s)) {
      return "O yt-dlp não reconhece esse link como vídeo.\nAbra o vídeo e use Compartilhar > Copiar link.";
    }
    var linhas = s.trim().split("\n").filter(function (l) {
      return l.indexOf("[download]") !== 0 && l.indexOf("WARNING") !== 0;
    });
    return linhas.slice(-3).join("\n") || "Falha ao rodar o yt-dlp.";
  }

  function baixar(ytdlp, url, pasta, onProgresso) {
    return new Promise(function (resolve, reject) {
      var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttdl-"));
      var tmpFile = path.join(tmpDir, "resultado.txt");

      var args = [
        "--no-playlist",
        "--no-simulate",
        "--no-update",
        "--newline",
        "--no-colors",
        "--no-mtime",
        "--print-to-file", "after_move:filepath", tmpFile,
        "-S", "res,vcodec:h264,acodec:aac",
        "--merge-output-format", "mp4",
        "-o", path.join(pasta, "%(id)s.%(ext)s")
      ];
      args.push(url);

      var env = Object.assign({}, process.env, {
        PATH: BIN_DIRS.join(":") + ":" + (process.env.PATH || "")
      });

      function lerProgresso(chunk) {
        var txt = chunk.toString();
        var m = txt.match(/\[download\]\s+([\d.]+)%/);
        if (m) { onProgresso(parseFloat(m[1])); }
      }

      var filho;
      try {
        filho = cp.spawn(ytdlp, args, { env: env });
      } catch (e) {
        return reject(new Error("Não consegui executar o yt-dlp: " + e.message));
      }

      var bufErr = "";
      filho.stdout.on("data", lerProgresso);
      filho.stderr.on("data", function (d) {
        lerProgresso(d);
        bufErr += d.toString();
        // guarda só o final para não crescer sem limite
        if (bufErr.length > 20000) { bufErr = bufErr.slice(-10000); }
      });
      filho.on("error", function (e) {
        reject(new Error("Não consegui executar o yt-dlp: " + e.message));
      });
      filho.on("close", function (code) {
        onProgresso(null);

        function acharPorId() {
          var id = (url.match(/\/video\/(\d+)/) || [])[1];
          if (!id) { return null; }
          var alvo = path.join(pasta, id + ".mp4");
          return fs.existsSync(alvo) ? alvo : null;
        }

        if (code !== 0) {
          var alternativo = acharPorId();
          if (alternativo) { return resolve(alternativo); }
          return reject(new Error(erroAmigavel(bufErr)));
        }

        var arquivo = "";
        try {
          var bruto = fs.readFileSync(tmpFile, "utf8").trim();
          var linhas = bruto.split("\n").filter(function (l) { return l.trim(); });
          arquivo = linhas.length ? linhas[linhas.length - 1].trim() : "";
        } catch (e) { /* arquivo temporario ausente */ }
        try { fs.unlinkSync(tmpFile); } catch (e) { }
        try { fs.rmdirSync(tmpDir); } catch (e) { }

        if (!arquivo || !fs.existsSync(arquivo)) {
          arquivo = acharPorId();
        }
        if (!arquivo) {
          return reject(new Error("O yt-dlp terminou, mas não achei o arquivo baixado em:\n" + pasta));
        }
        resolve(arquivo);
      });
    });
  }

  async function executar() {
    var url = extrairUrl(elUrl.value);
    if (!url) { return setStatus("Cole o link do vídeo do TikTok primeiro.", "erro"); }
    if (ehPerfilOuInicio(url)) {
      return setStatus(
        "Esse link é a página inicial ou um perfil, não um vídeo.\n" +
        "Abra o vídeo, toque em Compartilhar > Copiar link e cole aqui.",
        "erro"
      );
    }
    if (!ehVideo(url)) {
      return setStatus(
        "Não reconheci o link como um vídeo do TikTok.\n" +
        "Formato esperado: https://www.tiktok.com/@usuario/video/1234567890",
        "erro"
      );
    }

    var ytdlp = achar("yt-dlp");
    if (!ytdlp) {
      return setStatus("yt-dlp não encontrado.\nNo Terminal rode:\nbrew install yt-dlp ffmpeg", "erro");
    }
    if (!achar("ffmpeg")) {
      return setStatus("ffmpeg não encontrado.\nNo Terminal rode:\nbrew install ffmpeg", "erro");
    }

    elBtn.disabled = true;
    elBtn.classList.add("carregando");
    setStatus("");
    progresso(0);
    try {
      setStatus("Lendo o projeto aberto...");
      await carregarProjeto();
      if (!projetoAtual) {
        throw new Error("Salve o projeto antes de baixar (a pasta de downloads é guardada por projeto).");
      }
      if (!pastaAtual) {
        throw new Error("Defina a pasta de downloads deste projeto no campo \"Pasta de downloads\".");
      }

      var pasta = caminhoDeUrl(pastaAtual);
      if (!pasta) {
        throw new Error("Defina a pasta de downloads deste projeto.");
      }
      try {
        fs.mkdirSync(pasta, { recursive: true });
        if (!fs.statSync(pasta).isDirectory()) { throw new Error("não é uma pasta"); }
      } catch (e) {
        if (/^\/Volumes\//.test(pasta) && e.code === "ENOENT") {
          throw new Error("A pasta não existe e o volume parece não estar montado:\n" + pasta +
            "\nMonte o disco e clique em Escolher… novamente.");
        }
        throw new Error("Não consegui usar a pasta:\n" + pasta + "\n(" + e.message + ")");
      }
      lembrarPasta();

      setStatus("Baixando o vídeo...");
      var arquivo = await baixar(ytdlp, url, pasta, function (pct) {
        if (pct !== null) { setStatus("Baixando o vídeo... " + Math.round(pct) + "%"); }
        progresso(pct);
      });

      setStatus("Importando e inserindo na timeline...");
      var res = await jsx("importAndInsert(" + JSON.stringify(arquivo) + ")");
      if (res && res.indexOf("ERRO:") === 0) { throw new Error(res.substring(5)); }
      if (!res || res === "EvalScript error.") {
        throw new Error("O Premiere não executou o importAndInsert.\nVerifique se há uma sequência ativa e reinicie o painel.");
      }

      setStatus("Pronto! Vídeo na timeline.\n" + path.basename(arquivo), "ok");
      elUrl.value = "";
    } catch (e) {
      setStatus("Erro: " + e.message, "erro");
      progresso(null);
    } finally {
      // ordem importa: tirar .carregando antes de reabilitar evita 1 frame em âmbar
      elBtn.classList.remove("carregando");
      elBtn.disabled = false;
      syncBtn();
    }
  }

  elUrl.addEventListener("input", syncBtn);

  elBtn.addEventListener("click", executar);
  elUrl.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") { executar(); }
  });

  elBtnPasta.addEventListener("click", escolherPasta);

  // Atualização automática: se o version.json publicado tiver versão maior,
  // aparece o botão no cabeçalho.
  var elUpdate = document.getElementById("btnUpdate");
  var atualizacao = null;

  function checarAtualizacao() {
    if (!window.TTUpdate) { return; }
    window.TTUpdate.checar().then(function (info) {
      if (!info) { return; }
      atualizacao = info;
      elUpdate.textContent = "Atualizar " + info.versao;
      elUpdate.hidden = false;
    }).catch(function () { /* sem internet ou sem URL: silencioso */ });
  }

  elUpdate.addEventListener("click", function () {
    if (!atualizacao || !window.TTUpdate) { return; }
    elUpdate.disabled = true;
    setStatus("Baixando atualização " + atualizacao.versao + "...");
    window.TTUpdate.aplicar(atualizacao.url, function (msg) { setStatus(msg); })
      .then(function (v) {
        setStatus("Atualizado para " + v + ".\nFeche e abra o Premiere para carregar o painel novo.", "ok");
        elUpdate.hidden = true;
      })
      .catch(function (e) {
        setStatus("Erro ao atualizar: " + e.message, "erro");
        elUpdate.disabled = false;
      });
  });

  // O host carrega o ExtendScript junto com o painel: tenta de novo se ainda não respondeu.
  syncBtn();
  setTimeout(function () { carregarProjeto(); }, 500);
  setTimeout(checarAtualizacao, 1500);
  setInterval(function () {
    if (!projetoAtual) { carregarProjeto(); }
  }, 4000);
})();
