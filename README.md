# TikTok Downloader (CEP / Premiere Pro macOS)

Painel que cola um link do TikTok, baixa com `yt-dlp` na pasta `Downloads_TikTok/`
ao lado do `.prproj`, importa para o bin **TikTok**, insere no playhead (V1 + A1) e
extrai a música do próprio vídeo em `.wav` (48 kHz, estéreo) na mesma pasta.

## Estrutura

```
TikTokDownloader/
├── CSXS/manifest.xml   # manifest CEP (PPRO 14+, Node habilitado)
├── index.html          # UI do painel
├── js/main.js          # CEP/Node: valida link, chama yt-dlp/ffmpeg, progresso
├── js/update.js        # auto-update (version.json + zip do GitHub Releases)
├── jsx/host.jsx        # ExtendScript: projeto, importFiles, overwriteClip
├── publicar.sh         # publica uma versão: bump + pacotes + release no GitHub
├── hosting.txt         # URL base de onde o painel busca atualização
└── install.sh          # copia para CEP/extensions + PlayerDebugMode
```

## Instalar

```bash
cd ~/GensparkCode/TikTokDownloader
./install.sh
```

Depois **reinicie o Premiere** e abra `Janela > Extensões > TikTok Downloader`.

O script já faz:
1. copia para `~/Library/Application Support/Adobe/CEP/extensions/com.guilherme.tiktokdl`
2. `defaults write com.adobe.CSXS.<9..20> PlayerDebugMode 1` + `killall cfprefsd`
3. confere `yt-dlp` e `ffmpeg` (instala com `brew install yt-dlp ffmpeg` se faltar)

## Como usar

1. Abra o projeto (precisa estar salvo, o painel usa a pasta dele).
2. Confira a **Pasta de downloads** (definida uma vez por projeto):
   - padrão sugerido: `Downloads_TikTok/` ao lado do `.prproj`;
   - clique em **Escolher…** para apontar outro lugar (ex.: SSD de mídia).
   - a escolha fica salva por projeto em
     `~/Library/Application Support/TikTokDownloader/config.json`,
     indexada pelo caminho do `.prproj`.
3. Abra uma sequência (precisa de sequência ativa e trilha V1 desbloqueada).
4. Cole o link, posicione o playhead, clique em **Baixar e inserir na timeline**.
5. Ao terminar: vídeo na timeline + `id.wav` com a música na pasta de downloads.
6. Quando sair versão nova aparece o botão **Atualizar X** no cabeçalho do painel
   (baixa do GitHub Releases e pede para reiniciar o Premiere).

## Publicar uma atualização

```bash
./publicar.sh 1.4.0     # bump + zip/pkg + version.json + release no GitHub
bash install.sh         # atualiza a cópia local
```

## Limitações conhecidas

- O CEP é o caminho certo hoje, mas tem prazo: a Adobe para de aceitar CEP novo em
  dez/2027, desabilita por padrão em dez/2028 e remove em dez/2029. UXP no Premiere
  é GA, porém não tem Node — a migração exige um sidecar local (HTTP) rodando
  `yt-dlp`, como no Corta Takes.
- `yt-dlp` é o ponto frágil: o TikTok muda com frequência. Se falhar, atualize
  (`pip install -U yt-dlp` ou `brew upgrade yt-dlp`) e, de preferência, instale o
  suporte a impersonation: `pip install -U "yt-dlp[default]"` (traz `curl_cffi`).
  Sem ele o yt-dlp avisa "no impersonate target available".
- Vídeos VFR do TikTok podem gerar aviso de frame rate no Premiere; o arquivo é
  baixado em H.264/AAC + MP4 para compatibilidade máxima.
