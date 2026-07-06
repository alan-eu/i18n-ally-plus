import { defineConfig } from 'tsup'

// `@vue/compiler-sfc` (and fluent-vue-cli's bundled copy) reference `consolidate`,
// which lazily `require()`s ~50 optional template engines, only used when compiling
// `<template lang="...">`. We only call SFC `parse()` (for `<i18n>` blocks), so that
// code path never runs. These, plus a few optional formatter/preprocessor peers, are
// never installed — force them external so esbuild doesn't try to resolve them.
const NEVER_BUNDLE = [
  'vscode', // provided by the VS Code runtime, never resolvable at build time
  // optional peers referenced by bundled deps but not installed/shipped
  'prettier', 'less', 'sass', 'stylus', '@microsoft/typescript-etw',
  // consolidate's optional template engines
  'tinyliquid', 'liquid-node', 'jade', 'then-jade', 'then-pug', 'dust', 'dustjs-helpers',
  'dustjs-linkedin', 'swig', 'swig-templates', 'razor-tmpl', 'qejs', 'nunjucks',
  'arc-templates', 'velocityjs', 'atpl', 'babel-core', 'bracket-template', 'coffee-script',
  'dot', 'eco', 'ect', 'ejs', 'haml-coffee', 'hamlet', 'hamljs', 'hogan.js', 'htmling',
  'jazz', 'jqtpl', 'just', 'liquor', 'marko', 'mote', 'mustache', 'plates', 'ractive',
  'react', 'react-dom', 'slm', 'squirrelly', 'teacup', 'templayed', 'toffee', 'twig',
  'twing', 'vash', 'walrus', 'whiskers',
]

const externalOptionalPeers = {
  name: 'external-optional-peers',
  setup(build: any) {
    // match the package name or any subpath (e.g. `react-dom/server`, `teacup/lib/express`)
    const filter = new RegExp(`^(${NEVER_BUNDLE.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(/.*)?$`)
    build.onResolve({ filter }, (args: any) => ({ path: args.path, external: true }))
  },
}

export default defineConfig({
  entry: {
    extension: 'src/extension.ts',
    // standalone subprocess that evaluates JS/TS locale files (jiti-bundled,
    // self-contained — no ts-node/typescript shipped from node_modules)
    loader: 'src/loader.ts',
  },
  outDir: 'dist',
  format: ['cjs'],
  platform: 'node',
  target: 'node16',
  sourcemap: true,
  clean: false, // the `build` script rimrafs dist first
  dts: false,
  splitting: false,
  // the vsix ships only dist/, not node_modules — so bundle every dependency
  // (tsup, a library bundler, externalizes them by default)
  noExternal: [/.*/],
  esbuildPlugins: [externalOptionalPeers],
  define: {
    // src/env.ts branches on process.env.NODE_ENV; the build scripts set I18N_ALLY_ENV
    'process.env.NODE_ENV': JSON.stringify(process.env.I18N_ALLY_ENV || 'production'),
  },
})
