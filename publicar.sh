#!/bin/bash
# Publica uma versao nova do TikTok Downloader.
#
# Uso:  ./publicar.sh 1.4.0
#
# 1. Le o endereco base de hosting.txt (ex.: https://meusite.com/tiktokdl)
# 2. Grava a versao no manifest e o endereco do version.json no js/update.js
# 3. Gera dist/TikTokDownloader-<versao>.zip e dist/version.json
# 4. Mostra o que subir no host
set -e

ORIGEM="$(cd "$(dirname "$0")" && pwd)"
VERSAO="$1"
BASE="$(head -1 "$ORIGEM/hosting.txt" 2>/dev/null | tr -d '[:space:]')"

if [ -z "$VERSAO" ]; then
  echo "Uso: ./publicar.sh <versao>   (ex.: ./publicar.sh 1.4.0)" >&2
  exit 1
fi
if ! [[ "$VERSAO" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Versao invalida: $VERSAO (use o formato 1.4.0)" >&2
  exit 1
fi
if [ -z "$BASE" ]; then
  echo "Falta o arquivo hosting.txt com a URL base." >&2
  echo "Exemplo: echo 'https://meusite.com/tiktokdl' > hosting.txt" >&2
  exit 1
fi
BASE="${BASE%/}"

# 1) versao no manifest
/usr/bin/python3 - "$ORIGEM/CSXS/manifest.xml" "$VERSAO" <<'PY'
import re, sys
p, v = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
s = re.sub(r'ExtensionBundleVersion="[^"]*"', 'ExtensionBundleVersion="%s"' % v, s)
s = re.sub(r'(<Extension Id="com\.guilherme\.tiktokdl\.panel" Version=")[^"]*(")',
           lambda m: m.group(1) + v + m.group(2), s)
open(p, "w", encoding="utf-8").write(s)
PY

# 2) endereco do version.json dentro do painel
/usr/bin/python3 - "$ORIGEM/js/update.js" "$BASE/version.json" <<'PY'
import re, sys
p, url = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
s = re.sub(r'var URL_VERSAO = "[^"]*";', 'var URL_VERSAO = "%s";' % url, s)
open(p, "w", encoding="utf-8").write(s)
PY

# 3) pacotes
bash "$ORIGEM/package.sh" >/dev/null
bash "$ORIGEM/build-pkg.sh" >/dev/null

# 4) version.json
cat > "$ORIGEM/dist/version.json" <<JSON
{
  "version": "$VERSAO",
  "url": "$BASE/TikTokDownloader-$VERSAO.zip",
  "notes": ""
}
JSON

echo "Versao $VERSAO pronta."
echo
echo "Suba estes 3 arquivos em $BASE :"
echo "  dist/TikTokDownloader-$VERSAO.zip"
echo "  dist/TikTokDownloader-$VERSAO.pkg   (para quem instala do zero)"
echo "  dist/version.json"
echo
echo "Quem ja tem o painel ve o botao \"Atualizar $VERSAO\" ao abrir o Premiere."
