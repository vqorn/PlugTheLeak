// Bundles index.html + src/ into one self-contained dist/index.html.
// No dependencies: each ES module becomes a function scope, imports become
// destructuring from the modules it depends on. That file works from GitHub
// Pages and also when saved and opened straight from disk (file://).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT = /^import\s*\{([^}]*)\}\s*from\s*'([^']+)';?\s*$/gm;
const EXPORT = /^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;

const modules = new Map();
function load(file) {
  if (modules.has(file)) return;
  const src = readFileSync(file, 'utf8');
  const deps = [];
  const body = src.replace(IMPORT, (_, names, spec) => {
    const dep = join(dirname(file), spec);
    deps.push(dep);
    return `const {${names}} = ${varName(dep)};`;
  });
  for (const dep of deps) load(dep);
  const exports = [...src.matchAll(EXPORT)].map((m) => m[1]);
  modules.set(file, `const ${varName(file)} = (() => {\n${body.replace(/^export\s+/gm, '')}\nreturn { ${exports.join(', ')} };\n})();`);
}
function varName(file) {
  return '__' + file.slice(root.length + 1).replace(/[^\w]/g, '_');
}

load(join(root, 'src/app.js'));
const js = `(() => {\n'use strict';\n${[...modules.values()].join('\n\n')}\n})();`;
const css = readFileSync(join(root, 'src/style.css'), 'utf8');
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html
  .replace('<link rel="stylesheet" href="src/style.css">', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="src/app.js"></script>', () => `<script>\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`);
if (html.includes('src/')) throw new Error('build: unresolved reference to src/ left in HTML');

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/index.html'), html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(1)} KB, ${modules.size} modules`);
