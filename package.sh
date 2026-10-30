#!/bin/bash
# Gera dist/TikTokDownloader-<versao>.zip pronto para enviar a outra pessoa.
set -e

ORIGEM="$(cd "$(dirname "$0")" && pwd)"
VERSAO="$(/usr/bin/sed -n 's/.*ExtensionBundleVersion="\([^"]*\)".*/\1/p' "$ORIGEM/CSXS/manifest.xml" | head -1)"
NOME="TikTokDownloader-$VERSAO"
DIST="$ORIGEM/dist"
PASTA="$DIST/$NOME"

rm -rf "$PASTA" "$DIST/$NOME.zip"
mkdir -p "$PASTA"

cp -R "$ORIGEM/CSXS" "$ORIGEM/js" "$ORIGEM/jsx" "$ORIGEM/index.html" "$PASTA/"
cp "$ORIGEM/install.sh" "$ORIGEM/instalar.command" "$ORIGEM/LEIA-ME.txt" "$PASTA/"
chmod +x "$PASTA/install.sh" "$PASTA/instalar.command"

find "$PASTA" -name ".DS_Store" -delete

(cd "$DIST" && zip -qr "$NOME.zip" "$NOME")
rm -rf "$PASTA"

echo "Gerado: $DIST/$NOME.zip"
unzip -l "$DIST/$NOME.zip" | sed -n '4,$p'
