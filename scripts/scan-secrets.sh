#!/usr/bin/env bash
#
# LEADFORGE — scan de vazamento de secrets
# Verifica que nenhum segredo real existe no bundle do cliente (.next/static)
# nem nos arquivos versionados. Roda no CI e pode rodar localmente:
#   bash scripts/scan-secrets.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0

echo "== scan: secrets no bundle do cliente =="
if [ -d "$ROOT/.next/static" ]; then
  # padrões de credenciais reais (chaves de teste/placeholder não casam)
  if grep -rInE "(gho_[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{20,}|AIzaSy[A-Za-z0-9_-]{30,}|eyJhbGciOiJIUzI1Ni[A-Za-z0-9._-]{20,})" \
      "$ROOT/.next/static" 2>/dev/null; then
    echo "✗ SECRETO encontrado no bundle do cliente!"
    FAIL=1
  else
    echo "✓ bundle do cliente limpo"
  fi
else
  echo "⚠ .next/static não existe — rode 'bun run build' antes (pulando)"
fi

echo "== scan: arquivos versionados =="
if git ls-files 2>/dev/null | grep -qE "^\.env(\.|$)" | grep -v ".env.example"; then
  echo "✗ arquivo .env versionado!"
  FAIL=1
else
  echo "✓ nenhum .env versionado (exceto .env.example)"
fi

if [ "$FAIL" -eq 1 ]; then
  echo "RESULTADO: FALHOU"
  exit 1
fi
echo "RESULTADO: OK"
