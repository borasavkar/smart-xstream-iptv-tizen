// Build script: bundles TypeScript with esbuild and copies static assets into dist/.
// Path-independent (resolves everything relative to this file), so it works from any cwd.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const p = (...parts) => join(root, ...parts);
const outdir = p('dist');

rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

await build({
  entryPoints: [p('src', 'main.ts')],
  bundle: true,
  format: 'iife',
  target: ['es2017'],
  outfile: join(outdir, 'app.js'),
  legalComments: 'none',
  logLevel: 'info',
});

cpSync(p('src', 'index.html'), join(outdir, 'index.html'));
cpSync(p('src', 'styles.css'), join(outdir, 'styles.css'));
cpSync(p('config.xml'), join(outdir, 'config.xml'));
if (existsSync(p('icon.png'))) cpSync(p('icon.png'), join(outdir, 'icon.png'));
if (existsSync(p('tizen_web_project.yaml'))) cpSync(p('tizen_web_project.yaml'), join(outdir, 'tizen_web_project.yaml'));

console.log('\n✔ Build complete →', outdir);
console.log('  Package for TV:  see README.md (tizen build-web / package -t wgt)');
