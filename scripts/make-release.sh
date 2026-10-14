#!/usr/bin/env bash
#
# LEADFORGE — gera os artefatos de release (Linux/macOS/Windows)
# Uso: ./scripts/make-release.sh v0.6.0
#
# Empacota o código-fonte (sem node_modules/.next/.git/.env*)
# com o guia de instalação do respectivo sistema operacional.

set -euo pipefail

VERSION="${1:?uso: $0 <versão> (ex: v0.6.0)}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE="$(mktemp -d)"
SRC="leadforge-${VERSION}"
DIST="$ROOT/dist"

mkdir -p "$STAGE/$SRC" "$DIST"

# 1. Fonte limpa (.env.example é recolocado abaixo)
rsync -a \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude dist --exclude .env --exclude '.env.*' \
  "$ROOT/" "$STAGE/$SRC/"
cp "$ROOT/.env.example" "$STAGE/$SRC/.env.example"

# 2. Guia de instalação de cada SO na raiz do pacote
cp "$ROOT/docs/SETUP-LINUX.md"   "$STAGE/$SRC/SETUP.md.linux"
cp "$ROOT/docs/SETUP-MACOS.md"   "$STAGE/$SRC/SETUP.md.macos"
cp "$ROOT/docs/SETUP-WINDOWS.md" "$STAGE/$SRC/SETUP.md.windows"

# 3. Artefatos por SO (mesmo conteúdo, formato convencional de cada plataforma)
tar -czf "$DIST/leadforge-${VERSION}-linux.tar.gz" -C "$STAGE" "$SRC"
echo "✓ dist/leadforge-${VERSION}-linux.tar.gz"

tar -czf "$DIST/leadforge-${VERSION}-macos.tar.gz" -C "$STAGE" "$SRC"
echo "✓ dist/leadforge-${VERSION}-macos.tar.gz"

(cd "$STAGE" && zip -qr "$DIST/leadforge-${VERSION}-windows.zip" "$SRC")
echo "✓ dist/leadforge-${VERSION}-windows.zip"

echo "Concluído. Artefatos em dist/ — anexe à release do GitHub."
