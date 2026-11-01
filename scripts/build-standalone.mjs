// Builds the app into ONE self-contained HTML file (React from cdnjs, app code + CSS inline).
// Usage: node scripts/build-standalone.mjs [outFile]   (default: dist-standalone/sales-assistant.html)
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'dist-standalone/sales-assistant.html';
const REACT = '18.3.1';

// Map React imports to the UMD globals loaded from the CDN.
const globals = {
    name: 'react-globals',
    setup(b) {
        b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: a.path, namespace: 'g' }));
        b.onLoad({ filter: /.*/, namespace: 'g' }, (a) => {
            if (a.path === 'react') return { contents: 'module.exports = window.React', loader: 'js' };
            if (a.path.startsWith('react-dom')) return { contents: 'module.exports = window.ReactDOM', loader: 'js' };
            if (a.path === 'react/jsx-runtime' || a.path === 'react/jsx-dev-runtime')
                return {
                    contents: `const R = window.React;
const jsx = (t, p, k) => R.createElement(t, k === undefined ? p : { ...p, key: k });
module.exports = { jsx, jsxs: jsx, jsxDEV: jsx, Fragment: R.Fragment };`,
                    loader: 'js'
                };
        });
    }
};

const res = await build({
    entryPoints: ['scripts/standalone-entry.tsx'],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2019',
    jsx: 'automatic',
    write: false,
    plugins: [globals],
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning'
});

const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles/app.css', 'utf8').replace(/<\/style/gi, '<\\/style');

const html = `<title>New Home Sales Assistant</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="robots" content="noindex, nofollow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..800&display=swap">
<style>
${css}
:root { color-scheme: dark; }
body { background: var(--bg); color: var(--text); }
</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/${REACT}/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/${REACT}/umd/react-dom.production.min.js"></script>
<script>
${js}
</script>
`;

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
