import { defineConfig } from 'vite';
import { mkdirSync, copyFileSync } from 'node:fs';
// The precompiled React classic-script entry is deliberately preserved so the
// app also runs on an offline static server without package installation.
export default defineConfig({
  publicDir:'public',
  plugins:[{name:'copy-ghatpulse-browser-entry',closeBundle(){mkdirSync('release/dist',{recursive:true});copyFileSync('dist/app.js','release/dist/app.js')}}],
  build:{outDir:'release',rollupOptions:{input:'index.html'}},
  server:{host:'0.0.0.0'}
});
