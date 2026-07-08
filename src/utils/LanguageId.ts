
export const LanguageIdExtMap = {
  javascript: 'js',
  typescript: 'ts',
  javascriptreact: 'jsx',
  typescriptreact: 'tsx',
  vue: 'vue',
  'vue-html': 'vue',
  json: 'json',
  html: 'html',
  dart: 'dart',
  php: 'php',
  ejs: 'ejs',
  ruby: 'rb',
  erb: 'erb',
  'html.erb': 'erb',
  'js.erb': 'erb',
  haml: 'haml',
  slim: 'slim',
  handlebars: 'hbs',
  blade: 'php',
  svelte: 'svelte',
  xml: 'xml',
}

export type LanguageId = keyof typeof LanguageIdExtMap

export function getExtOfLanguageId(id: LanguageId) {
  return LanguageIdExtMap[id] || id
}

// inverse of LanguageIdExtMap, first-declared languageId wins for a shared ext
// (e.g. `vue` over `vue-html`, `javascript` over the blade/erb aliases)
const ExtLanguageIdMap: Record<string, LanguageId> = (() => {
  const map: Record<string, LanguageId> = {}
  for (const [id, ext] of Object.entries(LanguageIdExtMap)) {
    if (!(ext in map))
      map[ext] = id as LanguageId
  }
  return map
})()

// best-effort languageId for a file path, used when scanning files off-disk
// without opening a full TextDocument (see Analyst usage scan)
export function getLanguageIdFromExt(ext: string): LanguageId | undefined {
  return ExtLanguageIdMap[ext.replace(/^\./, '').toLowerCase()]
}
