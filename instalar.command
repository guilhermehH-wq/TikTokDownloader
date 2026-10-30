#!/bin/bash
# Duplo clique para instalar o TikTok Downloader no Premiere Pro (macOS).
DIR="$(cd "$(dirname "$0")" && pwd)"
bash "$DIR/install.sh"
echo
read -n 1 -s -r -p "Pressione qualquer tecla para fechar..."
echo
