import path from 'path'
import fg from 'fast-glob'
import fs from 'fs-extra'
import { parse } from '@babel/parser'
import { Config } from './Config'
import { Log } from '~/utils'

/**
 * Discovers i18next namespaces that are declared in code rather than encoded in the
 * catalog's path — e.g. a module file with:
 *
 *   translations: { namespace: "profile", resources: { en: require("./translations/en.json") } }
 *
 * so each catalog gets its *real* namespace instead of one guessed from the folder
 * name. Driven by the `i18n-ally.namespaceModules` glob; the map is rebuilt from
 * source on every full reload, so there is no generated file to keep in sync.
 */
export class NamespaceModules {
  private static _map: Map<string, string> | null = null // catalog dir (abs) -> namespace
  private static _names: Set<string> | null = null // the set of declared namespace names

  static invalidate() {
    this._map = null
    this._names = null
  }

  static get enabled() {
    return Config.namespaceModules.length > 0
  }

  /** the namespace declared for the catalog directory containing `filepath`, if any */
  static getNamespace(filepath: string): string | undefined {
    if (!this.enabled)
      return
    return this.map.get(path.dirname(filepath))
  }

  /**
   * Whether `name` is a namespace declared in code. Such namespaces are authoritative
   * (their catalogs aren't path-scoped), so a code usage like `profile:foo` must NOT
   * get an extra `namespaceFromPath` scope stacked on top of it — see applyPathScope.
   */
  static isDeclaredNamespace(name: string): boolean {
    if (!this.enabled || !name)
      return false
    if (!this._names)
      this._names = new Set(this.map.values())
    return this._names.has(name)
  }

  private static get map(): Map<string, string> {
    if (this._map)
      return this._map

    const map = new Map<string, string>()
    try {
      const files = fg.sync(Config.namespaceModules, {
        cwd: Config.root,
        absolute: true,
        ignore: ['**/node_modules/**', '**/build/**', '**/dist/**'],
      })
      for (const file of files)
        this.collectFromFile(file, map)
      Log.info(`🧭 namespaceModules: mapped ${map.size} catalog dir(s) from ${files.length} module file(s)`)
    }
    catch (e) {
      Log.error(e as Error)
    }

    this._map = map
    return map
  }

  private static collectFromFile(file: string, map: Map<string, string>) {
    let ast: any
    try {
      ast = parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['typescript'] })
    }
    catch {
      return // unparseable file — skip it
    }

    const dir = path.dirname(file)
    walk(ast, (node) => {
      // look for `{ namespace: "…", resources: { <lng>: require("…") } }`
      if (node.type !== 'ObjectExpression')
        return
      const namespace = stringProp(node, 'namespace')
      const resources = objectProp(node, 'resources')
      if (!namespace || !resources)
        return

      for (const prop of resources.properties) {
        if (prop.type !== 'ObjectProperty')
          continue
        const call = prop.value
        const arg = call.type === 'CallExpression'
          && call.callee.type === 'Identifier' && call.callee.name === 'require'
          && call.arguments[0]?.type === 'StringLiteral'
          ? call.arguments[0].value
          : undefined
        if (arg)
          map.set(path.dirname(path.resolve(dir, arg)), namespace)
      }
    })
  }
}

function findProp(obj: any, name: string): any {
  return obj.properties?.find((p: any) =>
    p.type === 'ObjectProperty' && (p.key?.name === name || p.key?.value === name))
}

function stringProp(obj: any, name: string): string | undefined {
  const value = findProp(obj, name)?.value
  return value?.type === 'StringLiteral' ? value.value : undefined
}

function objectProp(obj: any, name: string): any | undefined {
  const value = findProp(obj, name)?.value
  return value?.type === 'ObjectExpression' ? value : undefined
}

function walk(node: any, visit: (n: any) => void) {
  if (!node || typeof node !== 'object')
    return
  if (Array.isArray(node)) {
    for (const child of node)
      walk(child, visit)
    return
  }
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'start' || key === 'end' || key === 'range'
      || key === 'leadingComments' || key === 'trailingComments')
      continue
    walk(node[key], visit)
  }
}
