// Standalone loader for JS/TS locale files, bundled by tsup into dist/loader.js.
//
// The `js`/`ts` locale parser (src/parsers/ecmascript.ts) spawns this as a
// subprocess to evaluate a locale module in isolation and print its resolved
// value as JSON. It installs a require hook that transpiles TS/ESM on the fly
// with sucrase (pure JS, bundles cleanly), so the built loader is fully
// self-contained — the extension no longer ships ts-node + typescript from
// node_modules.
import fs from 'fs'
import Module from 'module'
import { transform, type Transform } from 'sucrase'

// transpile every required TS/JSX/ESM module on the fly (covers the whole
// import graph of the locale file, not just the entry)
const HOOKS: Record<string, Transform[]> = {
  '.ts': ['typescript', 'imports'],
  '.cts': ['typescript', 'imports'],
  '.mts': ['typescript', 'imports'],
  '.tsx': ['typescript', 'jsx', 'imports'],
  '.js': ['imports'],
  '.cjs': ['imports'],
  '.mjs': ['imports'],
  '.jsx': ['jsx', 'imports'],
}

const extensions = (Module as any)._extensions as Record<string, (m: any, filename: string) => void>

for (const [ext, transforms] of Object.entries(HOOKS)) {
  extensions[ext] = (module: any, filename: string) => {
    const source = fs.readFileSync(filename, 'utf8')
    const { code } = transform(source, { transforms, filePath: filename })
    module._compile(code, filename)
  }
}

async function main() {
  const file = process.argv[process.argv.length - 1]
  if (!file) {
    process.stderr.write('[i18n-ally] loader: no file provided\n')
    process.exit(1)
  }

  // use a real Node require (not the bundler's) so the hooks above apply
  const require = Module.createRequire(__filename)

  // the locale module may write to stdout on import; silence it so the only
  // thing we emit is our JSON payload
  const write = process.stdout.write.bind(process.stdout)
  process.stdout.write = (() => true) as any

  const mod = require(file)
  let result = mod && mod.__esModule ? (mod.default ?? mod) : mod

  process.stdout.write = write

  if (typeof result === 'function')
    result = result()
  result = await Promise.resolve(result)

  write(`${JSON.stringify(result)}\n`)
}

main().catch((err: any) => {
  process.stderr.write(`${err?.stack ?? err}\n`)
  process.exit(1)
})
