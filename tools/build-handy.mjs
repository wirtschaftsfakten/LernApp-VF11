// Baut die Handy-Version als EINE HTML-Datei (für den Link an die Mitschüler).
// Aufruf: node tools/build-handy.mjs  →  handy/LernApp-Handy.html
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const order = ['util', 'store', 'gen', 'beispiel', 'learn', 'handy'];

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

const css = readFileSync(join(root, 'css', 'app.css'), 'utf8') + '\n' + readFileSync(join(root, 'css', 'handy.css'), 'utf8');
const js = 'const __m = {};\n' + order.map(wrap).join('\n\n');
const tab = (href, key, label, path) => `<a href="${href}" data-tab="${key}"><svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>${label}</a>`;

const html = `<title>LernApp Ehrbarer Kaufmann</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Caveat:wght@500;700&display=swap" rel="stylesheet">
<style>
${css}
</style>
<main id="main" tabindex="-1"></main>
<nav id="tabbar" aria-label="Bereiche">
  ${tab('#/', 'start', 'Lernen', '<path d="M4 19V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2z"/><path d="M8 8h6M8 12h4"/>')}
  ${tab('#/karten', 'karten', 'Karten', '<rect x="3" y="6" width="14" height="12" rx="1.5"/><path d="M7 3h13a1 1 0 0 1 1 1v11"/><path d="M3 10h14"/>')}
  ${tab('#/text', 'text', 'Texte', '<path d="M7 3h10l3 3v15H4V3z"/><path d="M8 9h8M8 13h8M8 17h5"/>')}
  ${tab('#/spick', 'spick', 'Spickzettel', '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>')}
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
<meta name="theme-color" content="#FAFBFD">
<meta name="robots" content="noindex">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect x='3' y='7' width='26' height='18' rx='2' fill='%23fff' stroke='%231A2550' stroke-width='2'/%3E%3Cpath d='M3 12h26' stroke='%23D3263A' stroke-width='2'/%3E%3Cpath d='M8 17h16M8 21h10' stroke='%23BDB4FF' stroke-width='3'/%3E%3C/svg%3E">
<style>:root{padding-top:env(safe-area-inset-top,0px)}[hidden]{display:none!important}body{margin:0}</style>
</head>
<body>
${html}
</body>
</html>
`;
mkdirSync(join(root, 'handy'), { recursive: true });
writeFileSync(join(root, 'handy', 'index.html'), site);

console.log('handy/index.html');
