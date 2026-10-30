// ExtendScript do Premiere Pro. Roda dentro do Premiere, chamado pelo painel.

function normalizarCaminho(p) {
  return String(p).replace(/\\/g, "/").replace(/\/{2,}/g, "/").toLowerCase();
}

function getProjectPath() {
  try {
    if (!app.project) { return "ERRO:Nenhum projeto aberto."; }
    if (!app.project.path) { return "ERRO:Salve o projeto antes (o painel guarda a pasta de downloads por projeto)."; }
    return app.project.path;
  } catch (e) {
    return "ERRO:" + e;
  }
}

function getProjectDir() {
  try {
    if (!app.project) { return "ERRO:Nenhum projeto aberto."; }
    var caminho = app.project.path;
    if (!caminho) { return "ERRO:Salve o projeto antes de baixar (o painel precisa da pasta do .prproj)."; }
    var f = new File(caminho);
    if (!f.parent) { return "ERRO:Não consegui ler a pasta do projeto."; }
    return f.parent.fsName;
  } catch (e) {
    return "ERRO:" + e;
  }
}

function findOrCreateBin(raiz, nome) {
  for (var i = 0; i < raiz.children.numItems; i++) {
    var c = raiz.children[i];
    if (c.type === ProjectItemType.BIN && c.name === nome) { return c; }
  }
  return raiz.createBin(nome);
}

// Procura no bin o item cuja midia e o arquivo informado.
function procurarNoBin(bin, caminho) {
  var alvo = normalizarCaminho(caminho);
  for (var i = 0; i < bin.children.numItems; i++) {
    var ch = bin.children[i];
    try {
      if (ch.type === ProjectItemType.CLIP && normalizarCaminho(ch.getMediaPath()) === alvo) {
        return ch;
      }
    } catch (e) { /* item sem midia */ }
  }
  return null;
}

function importAudioOnly(filePath) {
  try {
    var proj = app.project;
    if (!proj) { return "ERRO:Nenhum projeto aberto."; }

    var seq = proj.activeSequence;
    if (!seq) { return "ERRO:Nenhuma sequência ativa. Abra uma sequência na timeline e tente de novo."; }

    if (!seq.audioTracks || seq.audioTracks.numTracks < 1) {
      return "ERRO:A sequência ativa não tem trilha de áudio (A1).";
    }
    var a1 = seq.audioTracks[0];
    if (a1.isLocked && a1.isLocked()) {
      return "ERRO:A trilha A1 está bloqueada. Desbloqueie e tente de novo.";
    }

    var raiz = proj.rootItem;
    var bin = findOrCreateBin(raiz, "Músicas");

    var ok = proj.importFiles([filePath], true, bin, false);
    if (!ok) { return "ERRO:O Premiere não conseguiu importar o áudio."; }

    bin = findOrCreateBin(raiz, "Músicas");
    var item = procurarNoBin(bin, filePath);
    if (!item) {
      for (var i = bin.children.numItems - 1; i >= 0; i--) {
        if (bin.children[i].type === ProjectItemType.CLIP) {
          item = bin.children[i];
          break;
        }
      }
    }
    if (!item) { return "ERRO:Importou, mas não achei o áudio no bin Músicas."; }

    a1.overwriteClip(item, seq.getPlayerPosition());
    return "OK";
  } catch (e) {
    return "ERRO:" + e;
  }
}

function importAndInsert(filePath) {
  try {
    var proj = app.project;
    if (!proj) { return "ERRO:Nenhum projeto aberto."; }

    var seq = proj.activeSequence;
    if (!seq) { return "ERRO:Nenhuma sequência ativa. Abra uma sequência na timeline e tente de novo."; }

    if (!seq.videoTracks || seq.videoTracks.numTracks < 1) {
      return "ERRO:A sequência ativa não tem trilha de vídeo (V1).";
    }
    var v1 = seq.videoTracks[0];
    if (v1.isLocked && v1.isLocked()) {
      return "ERRO:A trilha V1 está bloqueada. Desbloqueie e tente de novo.";
    }

    var raiz = proj.rootItem;
    var bin = findOrCreateBin(raiz, "TikTok");

    var ok = proj.importFiles([filePath], true, bin, false);
    if (!ok) { return "ERRO:O Premiere não conseguiu importar o arquivo."; }

    // Reconsulta o bin: a coleção pode ter sido recriada pela importação.
    bin = findOrCreateBin(raiz, "TikTok");
    var item = procurarNoBin(bin, filePath);

    if (!item) {
      // Plano B: último clipe do bin (importação pode renomear em caso de duplicata).
      for (var i = bin.children.numItems - 1; i >= 0; i--) {
        if (bin.children[i].type === ProjectItemType.CLIP) {
          item = bin.children[i];
          break;
        }
      }
    }
    if (!item) { return "ERRO:Importou, mas não achei o clipe no bin TikTok."; }

    // getPlayerPosition() devolve um Time; overwriteClip espera Time (não segundos).
    var posicao = seq.getPlayerPosition();

    var a1 = (seq.audioTracks && seq.audioTracks.numTracks > 0) ? seq.audioTracks[0] : null;
    var audioAntes = a1 ? a1.clips.numItems : -1;

    v1.overwriteClip(item, posicao);

    // Em algumas versões o áudio não acompanha o vídeo: coloca na A1 uma única vez.
    if (a1 && !(a1.isLocked && a1.isLocked()) && a1.clips.numItems === audioAntes) {
      try { a1.overwriteClip(item, posicao); } catch (e) { /* sem audio */ }
    }

    return "OK";
  } catch (e) {
    return "ERRO:" + e;
  }
}
