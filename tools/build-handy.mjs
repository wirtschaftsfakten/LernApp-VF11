// Baut die Handy-Version als EINE HTML-Datei (für den Link an die Mitschüler).
// Aufruf: node tools/build-handy.mjs  →  handy/LernApp-Handy.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const order = ['util', 'files', 'store', 'gen', 'beispiel', 'extract', 'viewer', 'setup', 'learn', 'views', 'handy'];

// ES-Module in Funktionsblöcke verwandeln: import → Zugriff auf __m, export → Rückgabe
function wrap(name) {
  let src = readFileSync(join(root, 'js', name + '.js'), 'utf8');
  const exported = [];
  src = src.replace(/^import \* as (\w+) from '\.\/(\w+)\.js';$/gm, 'const $1 = __m.$2;');
  src = src.replace(/^import \{([^}]+)\} from '\.\/(\w+)\.js';$/gm, 'const {$1} = __m.$2;');
  src = src.replace(/^export (const|let|function|async function) ([\w$]+)/gm, (m, kw, id) => { exported.push(id); return `${kw} ${id}`; });
  if (/^\s*(import|export)\b/m.test(src)) throw new Error(`${name}.js: nicht umwandelbarer import/export`);
  return `__m.${name} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();`;
}

const css = readFileSync(join(root, 'css', 'app.css'), 'utf8') + '\n' + readFileSync(join(root, 'css', 'theme.css'), 'utf8');
const js = 'const __m = {};\n' + order.map(wrap).join('\n\n');
const tab = (href, key, label, path) => `<a href="${href}" data-tab="${key}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>${label}</a>`;

const html = `<title>LernApp</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
<main id="main" tabindex="-1"></main>
<nav id="tabbar" aria-label="Bereiche">
  ${tab('#/', 'start', 'Lernen', '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>')}
  ${tab('#/lernen/alle/wiederholen', 'heute', 'Wiederholen', '<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>')}
  ${tab('#/mehr', 'mehr', 'Mehr', '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>')}
</nav>
<div id="toast" role="status" aria-live="polite"></div>
<dialog id="sheet"></dialog>
<dialog id="dialog"></dialog>
<script>
${js}
</script>
`;

mkdirSync(join(root, 'handy'), { recursive: true });
writeFileSync(join(root, 'handy', 'LernApp-Handy.html'), html);
console.log('handy/LernApp-Handy.html', (html.length / 1024).toFixed(0), 'KB');

// Eigenständige Website (GitHub Pages): gleicher Inhalt mit vollständigem HTML-Gerüst
const site = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1B7AF0">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="LernApp">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='3' y='7' width='26' height='18' rx='2' fill='%23fff' stroke='%231A2550' stroke-width='2'/%3E%3Cpath d='M3 12h26' stroke='%23D3263A' stroke-width='2'/%3E%3Cpath d='M8 17h16M8 21h10' stroke='%23BDB4FF' stroke-width='3'/%3E%3C/svg%3E">
<style>:root{padding-top:env(safe-area-inset-top,0px)}[hidden]{display:none!important}body{margin:0}</style>
</head>
<body>
<script>window.LERNAPP_BASE = '../';</script>
${html}
</body>
</html>
`;
mkdirSync(join(root, 'handy'), { recursive: true });
writeFileSync(join(root, 'handy', 'index.html'), site);

console.log('handy/index.html');
