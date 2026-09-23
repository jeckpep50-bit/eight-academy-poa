import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(resolve(root,'public/vendor'),{recursive:true});
await build({
  absWorkingDir:root,
  entryPoints:[resolve(root,'src/importer.js')],
  outfile:resolve(root,'public/importer.bundle.mjs'),
  bundle:true,
  minify:true,
  legalComments:'none',
  format:'esm',
  platform:'browser',
  target:['es2022'],
  external:['./vendor/pdf.mjs']
});
await copyFile(resolve(root,'node_modules/pdfjs-dist/build/pdf.mjs'),resolve(root,'public/vendor/pdf.mjs'));
await copyFile(resolve(root,'node_modules/pdfjs-dist/build/pdf.worker.mjs'),resolve(root,'public/vendor/pdf.worker.mjs'));
await copyFile(resolve(root,'node_modules/pdfjs-dist/LICENSE'),resolve(root,'public/vendor/pdfjs-LICENSE.txt'));
await copyFile(resolve(root,'node_modules/read-excel-file/LICENSE'),resolve(root,'public/vendor/read-excel-file-LICENSE.txt'));
await copyFile(resolve(root,'node_modules/jszip/LICENSE.markdown'),resolve(root,'public/vendor/jszip-LICENSE.txt'));
