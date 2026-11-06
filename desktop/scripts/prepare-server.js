/**
 * LEADFORGE Desktop — prepara o servidor embutido.
 *
 * Copia o build standalone do Next.js (.next/standalone) para desktop/server/
 * junto com os assets estáticos (.next/static) e o public/ — sem isso a
 * janela abre sem CSS/JS. Também embute as migrations do Drizzle para que o
 * app consiga preparar o banco do usuário.
 *
 * Executar: node scripts/prepare-server.js
 */
const fs = require('fs');
const path = require('path');

const DESKTOP_DIR = path.resolve(__dirname, '..');
const PROJECT_DIR = path.resolve(DESKTOP_DIR, '..');
const STANDALONE_DIR = path.join(PROJECT_DIR, '.next', 'standalone');
const STATIC_DIR = path.join(PROJECT_DIR, '.next', 'static');
const PUBLIC_DIR = path.join(PROJECT_DIR, 'public');
const MIGRATIONS_DIR = path.join(PROJECT_DIR, 'drizzle');
const TARGET_DIR = path.join(DESKTOP_DIR, 'server');

/** O standalone gera .next/standalone/<pkg-name>/ quando há subpastas. */
function findStandaloneRoot() {
  if (!fs.existsSync(STANDALONE_DIR)) return null;
  const entries = fs.readdirSync(STANDALONE_DIR, { withFileTypes: true });
  const dir = entries.find((e) => e.isDirectory() && fs.existsSync(path.join(STANDALONE_DIR, e.name, 'server.js')));
  if (dir) return path.join(STANDALONE_DIR, dir.name);
  if (fs.existsSync(path.join(STANDALONE_DIR, 'server.js'))) return STANDALONE_DIR;
  return null;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

function main() {
  const root = findStandaloneRoot();
  if (!root) {
    console.error(
      '[prepare-server] ERRO: build standalone não encontrado.\n' +
      '                 Rode `bun run build` na raiz do projeto antes.'
    );
    process.exit(1);
  }

  console.log(`[prepare-server] origem: ${root}`);

  // Limpa destino anterior
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
  fs.mkdirSync(TARGET_DIR, { recursive: true });

  // 1. server standalone (server.js + node_modules rastreadas + .next/server)
  copyDir(root, TARGET_DIR);

  // 2. assets estáticos (.next/static) — sem isso a janela abre sem estilo
  if (fs.existsSync(STATIC_DIR)) {
    copyDir(STATIC_DIR, path.join(TARGET_DIR, '.next', 'static'));
    console.log('[prepare-server] .next/static copiado');
  } else {
    console.warn('[prepare-server] AVISO: .next/static não encontrado');
  }

  // 3. public/ (favicon, etc.)
  if (fs.existsSync(PUBLIC_DIR)) {
    copyDir(PUBLIC_DIR, path.join(TARGET_DIR, 'public'));
    console.log('[prepare-server] public/ copiado');
  }

  // 4. migrations do Drizzle — o app precisa preparar o banco do usuário
  if (fs.existsSync(MIGRATIONS_DIR)) {
    const migTarget = path.join(TARGET_DIR, 'drizzle');
    fs.mkdirSync(migTarget, { recursive: true });
    for (const file of fs.readdirSync(MIGRATIONS_DIR)) {
      if (file.endsWith('.sql')) {
        fs.copyFileSync(path.join(MIGRATIONS_DIR, file), path.join(migTarget, file));
      }
    }
    console.log('[prepare-server] migrations copiadas');
  }

  if (!fs.existsSync(path.join(TARGET_DIR, 'server.js'))) {
    console.error('[prepare-server] ERRO: server.js ausente no pacote preparado.');
    process.exit(1);
  }

  console.log(`[prepare-server] pronto: ${TARGET_DIR}`);
}

main();
