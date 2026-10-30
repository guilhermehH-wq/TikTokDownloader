#!/bin/bash
# Publica uma versao nova do TikTok Downloader.
#
# Uso:  ./publicar.sh 1.4.0
#
# 1. Le o endereco base de hosting.txt
#    - GitHub:  https://github.com/USUARIO/TikTokDownloader
#    - outro :  https://meusite.com/tiktokdl     (upload manual)
# 2. Grava a versao no manifest e o endereco do version.json no js/update.js
# 3. Gera dist/TikTokDownloader-<versao>.zip, .pkg e dist/version.json
# 4. GitHub + token: cria o release e sobe os 3 arquivos sozinho
set -e

ORIGEM="$(cd "$(dirname "$0")" && pwd)"
VERSAO="$1"
BASE="$(head -1 "$ORIGEM/hosting.txt" 2>/dev/null | tr -d '[:space:]')"
BASE="${BASE%/}"

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
  echo "Exemplo: echo 'https://github.com/USUARIO/TikTokDownloader' > hosting.txt" >&2
  exit 1
fi

OWNER_REPO=""
URL_JSON="$BASE/version.json"
URL_ZIP="$BASE/TikTokDownloader-$VERSAO.zip"
if [[ "$BASE" =~ ^https://github\.com/([^/]+)/([^/]+)$ ]]; then
  OWNER_REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  URL_JSON="$BASE/releases/latest/download/version.json"
  URL_ZIP="$BASE/releases/download/v$VERSAO/TikTokDownloader-$VERSAO.zip"
fi

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
/usr/bin/python3 - "$ORIGEM/js/update.js" "$URL_JSON" <<'PY'
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
  "url": "$URL_ZIP",
  "notes": ""
}
JSON

ZIP="$ORIGEM/dist/TikTokDownloader-$VERSAO.zip"
PKG="$ORIGEM/dist/TikTokDownloader-$VERSAO.pkg"
JSONF="$ORIGEM/dist/version.json"

# 5) publica
if [ -n "$OWNER_REPO" ]; then
  TOKEN="${GH_TOKEN:-$(cat "$HOME/.config/tiktokdl/token" 2>/dev/null | tr -d '[:space:]')}"
  if [ -z "$TOKEN" ]; then
    echo "Versao $VERSAO gerada, mas sem token do GitHub."
    echo "Salve um token com escopo repo em ~/.config/tiktokdl/token e rode de novo."
    exit 0
  fi
  API="https://api.github.com/repos/$OWNER_REPO"

  CORPO=$(/usr/bin/python3 -c 'import json,sys;print(json.dumps({"tag_name":"v"+sys.argv[1],"name":"v"+sys.argv[1],"body":"TikTok Downloader "+sys.argv[1]}))' "$VERSAO")
  ID=$(curl -s -X POST -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
        -d "$CORPO" "$API/releases" | /usr/bin/python3 -c 'import json,sys;print(json.load(sys.stdin).get("id",""))')

  if [ -z "$ID" ]; then
    ID=$(curl -s -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
         "$API/releases/tags/v$VERSAO" | /usr/bin/python3 -c 'import json,sys;print(json.load(sys.stdin).get("id",""))')
  fi
  if [ -z "$ID" ]; then
    echo "Nao consegui criar/achar o release v$VERSAO. Verifique o token." >&2
    exit 1
  fi

  subir() {
    curl -s -o /dev/null -w "  %{http_code}  $2\n" -X POST \
      -H "Authorization: token $TOKEN" \
      -H "Content-Type: $3" \
      --data-binary "@$1" \
      "https://uploads.github.com/repos/$OWNER_REPO/releases/$ID/assets?name=$2"
  }
  subir "$ZIP" "TikTokDownloader-$VERSAO.zip" "application/zip"
  subir "$PKG" "TikTokDownloader-$VERSAO.pkg" "application/octet-stream"
  subir "$JSONF" "version.json" "application/json"

  echo
  echo "Publicado: $BASE/releases/tag/v$VERSAO"
  echo "version.json: $URL_JSON"
else
  echo "Versao $VERSAO pronta. Suba estes 3 arquivos em $BASE :"
  echo "  $ZIP"
  echo "  $PKG"
  echo "  $JSONF"
fi

echo
echo "Quem ja tem o painel ve o botao \"Atualizar $VERSAO\" ao abrir o Premiere."
