#!/bin/bash
# Gera dist/TikTokDownloader-<versao>.pkg — instalador de duplo clique (macOS).
# Instala a extensão em ~/Library/App Support/Adobe/CEP/extensions do usuário
# logado e liga o PlayerDebugMode (necessário para extensão sem assinatura).
set -e

ORIGEM="$(cd "$(dirname "$0")" && pwd)"
VERSAO="$(/usr/bin/sed -n 's/.*ExtensionBundleVersion="\([^"]*\)".*/\1/p' "$ORIGEM/CSXS/manifest.xml" | head -1)"
NOME="TikTokDownloader-$VERSAO"
DIST="$ORIGEM/dist"
BUILD="$ORIGEM/.build-pkg"
STAGE="$BUILD/root"
SCRIPTS="$BUILD/scripts"

rm -rf "$BUILD"
mkdir -p "$STAGE/Library/Application Support/TikTokDownloader/payload" "$SCRIPTS" "$DIST"

export COPYFILE_DISABLE=1
cp -R "$ORIGEM/CSXS" "$ORIGEM/js" "$ORIGEM/jsx" "$ORIGEM/index.html" \
      "$ORIGEM/install.sh" "$ORIGEM/instalar.command" "$ORIGEM/LEIA-ME.txt" \
      "$STAGE/Library/Application Support/TikTokDownloader/payload/"
find "$STAGE" -name ".DS_Store" -delete
find "$STAGE" -name "._*" -delete
/usr/bin/xattr -cr "$STAGE" 2>/dev/null || true

cat > "$SCRIPTS/postinstall" <<'SCRIPT'
#!/bin/bash
set -e

CONSOLE_USER="$(stat -f%Su /dev/console)"
SRC="/Library/Application Support/TikTokDownloader/payload"

if [ -z "$CONSOLE_USER" ] || [ "$CONSOLE_USER" = "root" ] || [ ! -d "/Users/$CONSOLE_USER" ]; then
  echo "Nenhum usuário logado encontrado; a extensão ficou em $SRC."
  exit 0
fi

HOME_DIR="$(dscl . -read "/Users/$CONSOLE_USER" NFSHomeDirectory | /usr/bin/awk '{print $2}')"
DEST="$HOME_DIR/Library/Application Support/Adobe/CEP/extensions/com.guilherme.tiktokdl"

/usr/bin/sudo -u "$CONSOLE_USER" /bin/mkdir -p "$DEST"
rm -rf "$DEST"
/usr/bin/sudo -u "$CONSOLE_USER" /bin/cp -R "$SRC" "$DEST"

# Extensão sem assinatura: o CEP só carrega com PlayerDebugMode.
for v in 9 10 11 12 13 14 15 16 17 18 19 20; do
  /usr/bin/sudo -u "$CONSOLE_USER" /usr/bin/defaults write "com.adobe.CSXS.$v" PlayerDebugMode 1 2>/dev/null || true
done
/usr/bin/sudo -u "$CONSOLE_USER" /usr/bin/killall cfprefsd 2>/dev/null || true

chown -R "$CONSOLE_USER" "$DEST"
rm -rf "/Library/Application Support/TikTokDownloader"

exit 0
SCRIPT
chmod +x "$SCRIPTS/postinstall"

pkgbuild \
  --root "$STAGE" \
  --scripts "$SCRIPTS" \
  --identifier "com.guilherme.tiktokdl.installer" \
  --version "$VERSAO" \
  --install-location "/" \
  "$DIST/$NOME.pkg" >/dev/null

rm -rf "$BUILD"

echo "Gerado: $DIST/$NOME.pkg ($(du -h "$DIST/$NOME.pkg" | cut -f1))"
