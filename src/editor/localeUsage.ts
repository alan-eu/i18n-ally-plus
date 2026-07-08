import path from 'path'
import { DefinitionProvider, Location, Position, TextDocument, languages } from 'vscode'
import { Analyst, CurrentFile, Global, KeyInDocument } from '~/core'
import { uniq } from '~/utils/lodash'
import { ExtensionModule } from '~/modules'

// The file-relative keypath at the cursor in a locale document. Prefers a value the
// cursor sits inside; otherwise (e.g. the cursor is on the key name) the most
// specific key whose value is on the same line.
function keyAtPosition(entries: KeyInDocument[], document: TextDocument, position: Position): string | undefined {
  const bySpan = (a: KeyInDocument, b: KeyInDocument) => (a.end - a.start) - (b.end - b.start)

  const offset = document.offsetAt(position)
  const inValue = entries.filter(e => e.start <= offset && offset <= e.end)
  if (inValue.length)
    return inValue.sort(bySpan)[0].key

  const line = position.line
  const onLine = entries.filter(e =>
    document.positionAt(e.start).line <= line && line <= document.positionAt(e.end).line)
  return onLine.length ? onLine.sort(bySpan)[0].key : undefined
}

// A locale file stores keys relative to itself, but usages are keyed by the full
// (namespace/scope-prefixed) keypath. The full key is the tree key that ends with
// the file-relative key and whose record belongs to this exact file.
function resolveFullKey(filepath: string, locale: string, relKey: string): string | undefined {
  const loader = CurrentFile.loader
  return loader.keys
    .filter(k => k === relKey || k.endsWith(`.${relKey}`))
    .sort((a, b) => b.length - a.length) // most specific first
    .find(k => loader.getRecordByKey(k, locale)?.filepath === filepath)
}

// Cmd+click on a key inside a locale catalog (e.g. en.json) jumps to where that key
// is used in code — the inverse of the code -> locale definition provider.
class LocaleUsageProvider implements DefinitionProvider {
  async provideDefinition(document: TextDocument, position: Position): Promise<Location[] | undefined> {
    if (!Global.enabled)
      return

    // only act on files that are actually loaded locale catalogs
    const file = CurrentFile.loader.files.find(f => f.filepath === document.uri.fsPath)
    if (!file)
      return

    const parser = Global.getMatchedParser(path.extname(document.uri.fsPath))
    if (!parser)
      return

    const relKey = keyAtPosition(parser.parseAST(document.getText()), document, position)
    if (!relKey)
      return

    const fullKey = resolveFullKey(document.uri.fsPath, file.locale, relKey)
    if (!fullKey)
      return

    const locations = await Analyst.getAllOccurrenceLocations(fullKey)
    return locations.length ? locations : undefined
  }
}

const m: ExtensionModule = () => {
  const selectors = uniq(Global.enabledParsers.flatMap(p => p.languageIds))
    .map(language => ({ scheme: 'file', language }))

  if (!selectors.length)
    return []

  return [
    languages.registerDefinitionProvider(selectors, new LocaleUsageProvider()),
  ]
}

export default m
