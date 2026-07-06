/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds the webview editor UI (a Vue 3 SPA) into a single, self-contained
// dist/editor/index.html with all JS/CSS inlined — the extension injects that
// file verbatim as the webview HTML (see src/webview/panel.ts).
export default defineConfig({
  root: path.resolve(__dirname, 'src/webview/src'),
  plugins: [
    vue(),
    viteSingleFile({ removeViteModuleLoader: true }),
  ],
  define: {
    // Vue 3 feature flags (we use the Options API in the SFCs)
    __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false',
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    // vue-i18n 9: enable legacy ($t) API + JIT so messages pushed from the
    // extension at runtime (store mutation 'i18n') are compiled on the fly
    __VUE_I18N_FULL_INSTALL__: 'true',
    __VUE_I18N_LEGACY_API__: 'true',
    __INTLIFY_JIT_COMPILATION__: 'true',
    __INTLIFY_DROP_MESSAGE_COMPILER__: 'false',
    __INTLIFY_PROD_DEVTOOLS__: 'false',
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/editor'),
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
  },
})
