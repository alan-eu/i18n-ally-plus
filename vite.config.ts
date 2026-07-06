/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue2'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds the webview editor UI (a Vue 2 SPA) into a single, self-contained
// dist/editor/index.html with all JS/CSS inlined — the extension injects that
// file verbatim as the webview HTML (see src/webview/panel.ts). This replaces
// the deprecated parcel-bundler + parcel-plugin-inliner build.
export default defineConfig({
  root: path.resolve(__dirname, 'src/webview/src'),
  plugins: [
    vue(),
    viteSingleFile({ removeViteModuleLoader: true }),
  ],
  build: {
    outDir: path.resolve(__dirname, 'dist/editor'),
    emptyOutDir: true,
    // match the (unminified) main extension bundle so output stays diffable
    minify: false,
    sourcemap: false,
  },
})
