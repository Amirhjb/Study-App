// Convierte dist/index.html (documento completo de un solo archivo) en el formato
// de página de un Artifact de claude.ai: sin <html>/<head>/<body>, con <title>
// y estilos al principio. Uso: npm run build && node scripts/build-artifact.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const pick = (re, what) => {
  const m = html.match(re);
  if (!m) throw new Error(`No se encontró ${what} en dist/index.html`);
  return m[0];
};
const title = pick(/<title>[\s\S]*?<\/title>/, 'el título');
const style = pick(/<style[^>]*>[\s\S]*?<\/style>/, 'los estilos');
const scripts = [...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]);
const themeScript = scripts.find((s) => !/type="module"/.test(s));
const appScript = scripts.find((s) => /type="module"/.test(s));
if (!appScript) throw new Error('No se encontró el script de la app');

const out = [title, style, themeScript ?? '', '<div id="root"></div>', appScript.replace(/ crossorigin/, '')].join('\n');
writeFileSync('dist/artifact.html', out);
console.log(`dist/artifact.html (${(out.length / 1024).toFixed(0)} KB)`);
