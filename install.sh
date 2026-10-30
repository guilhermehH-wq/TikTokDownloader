#!/bin/bash
# Instala o painel TikTok Downloader no Premiere Pro (macOS).
# Uso: ./install.sh
set -e

BUNDLE_ID="com.guilherme.tiktokdl"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/$BUNDLE_ID"
ORIGEM="$(cd "$(dirname "$0")" && pwd)"

echo "== Copiando a extensão =="
mkdir -p "$HOME/Library/Application Support/Adobe/CEP/extensions"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$ORIGEM/CSXS" "$ORIGEM/index.html" "$ORIGEM/js" "$ORIGEM/jsx" "$DEST/"
echo "   $DEST"

echo "== Liberando extensões sem assinatura (PlayerDebugMode) =="
for v in 9 10 11 12 13 14 15 16 17 18 19 20; do
  defaults write com.adobe.CSXS.$v PlayerDebugMode 1 2>/dev/null || true
done
killall cfprefsd 2>/dev/null || true
echo "   ok"

echo "== Verificando dependências =="
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
for bin in yt-dlp ffmpeg; do
  if command -v "$bin" >/dev/null 2>&1; then
    printf "   ok: %s (%s)\n" "$bin" "$(command -v "$bin")"
  else
    printf "   FALTA: %s  ->  brew install %s\n" "$bin" "$bin"
  fi
done

if command -v yt-dlp >/dev/null 2>&1; then
  echo "   versão do yt-dlp: $(yt-dlp --version 2>/dev/null)"
  echo "   (se estiver falhando no TikTok, atualize: brew upgrade yt-dlp)"
fi

echo
echo "Pronto. Reinicie o Premiere e abra: Janela > Extensões > TikTok Downloader"
echo "Se o painel não aparecer: feche o Premiere, rode este script de novo e reabra."
