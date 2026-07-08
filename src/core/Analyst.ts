import fs from 'fs'
import path from 'path'
import { workspace, Range, Location, TextDocument, EventEmitter } from 'vscode'
import micromatch from 'micromatch'
import { uniq } from '~/utils/lodash'
import { Global } from './Global'
import { CurrentFile } from './CurrentFile'
import { UsageReport } from './types'
import { KeyDetector, Config, KeyOccurrence, KeyUsage } from '.'
import { Log, getLanguageIdFromExt } from '~/utils'
import { gitignoredGlob } from '~/utils/glob'

// how many files to read + parse concurrently during a full usage scan. Bounded so
// the scan yields to the extension host between chunks (keeping hovers/commands
// responsive) instead of monopolising it the way opening 20k+ TextDocuments did.
const SCAN_CHUNK_SIZE = 48

export class Analyst {
  private static _cache: KeyOccurrence[] | null = null
  // a scan in progress, shared by all callers so concurrent cmd+clicks / reports
  // don't each kick off their own full rescan (the cache is only populated once the
  // scan finishes, so without this every click before completion started a new one)
  private static _scanning: Promise<KeyOccurrence[]> | null = null
  // dynamic-key prefixes (dot-ending stems) derived from call sites like
  // t(`foo.${x}`); recomputed on each full scan (see getAllOccurrences)
  private static _dynamicPrefixes: string[] = []
  static readonly _onDidUsageReportChanged = new EventEmitter<UsageReport>()
  static readonly onDidUsageReportChanged = Analyst._onDidUsageReportChanged.event

  static invalidateCache() {
    this._cache = null
    this._dynamicPrefixes = []
  }

  static invalidateCacheOf(filepath: string) {
    if (this._cache)
      this._cache = this._cache.filter(o => o.filepath !== filepath)
  }

  static watch() {
    return workspace.onDidSaveTextDocument(doc => this.updateCache(doc))
  }

  static hasCache() {
    return !!this._cache
  }

  static refresh() {
    if (this.hasCache())
      this.analyzeUsage(true)
  }

  private static async updateCache(doc: TextDocument) {
    if (!this._cache)
      return
    if (!Global.isLanguageIdSupported(doc.languageId))
      return

    const filepath = doc.uri.fsPath
    Log.info(`🔄 Update usage cache of ${filepath}`)
    this.invalidateCacheOf(filepath)
    const { occurrences, dynamicPrefixes } = this.getOccurrencesOfText(doc, filepath)
    this._cache.push(...occurrences)
    // best-effort: fold in this file's dynamic prefixes (stale ones clear on the
    // next full scan, which the usage report always triggers)
    this._dynamicPrefixes = uniq([...this._dynamicPrefixes, ...dynamicPrefixes])
  }

  private static async enumerateDocumentPaths() {
    const root = Global.rootpath
    const files = await gitignoredGlob(Global.getSupportLangGlob(), root)
    return files.filter(f => !fs.lstatSync(f).isDirectory())
  }

  private static async getOccurrencesOfFile(filepath: string) {
    // reuse an already-open document if VS Code has one (accurate + free);
    // otherwise read raw text from disk and parse it through a lightweight shim.
    // Materialising a real TextDocument per file (openTextDocument) is what made
    // a full scan freeze the host on large repos.
    const open = workspace.textDocuments.find(doc => doc.uri.fsPath === filepath)
    if (open)
      return this.getOccurrencesOfText(open, filepath)

    const text = await fs.promises.readFile(filepath, 'utf8')
    return this.getOccurrencesOfText(this.makeDocShim(filepath, text), filepath)
  }

  // a minimal TextDocument stand-in exposing only what KeyDetector.getKeys and the
  // frameworks' getScopeRange actually read: uri.fsPath, languageId, getText()
  private static makeDocShim(filepath: string, text: string): TextDocument {
    const languageId = getLanguageIdFromExt(path.extname(filepath)) ?? ''
    return {
      uri: { fsPath: filepath },
      languageId,
      getText: () => text,
    } as unknown as TextDocument
  }

  private static getOccurrencesOfText(doc: TextDocument, filepath: string) {
    // dotEnding=true also yields dynamic-key prefixes (e.g. `foo.` from t(`foo.${x}`))
    const keys = KeyDetector.getKeys(doc, undefined, true)
    const occurrences: KeyOccurrence[] = []
    const dynamicPrefixes: string[] = []

    for (const { start, end, key } of keys) {
      if (key.endsWith('.'))
        dynamicPrefixes.push(key)
      else
        occurrences.push({ keypath: key, start, end, filepath })
    }

    return { occurrences, dynamicPrefixes }
  }

  static async getAllOccurrences(targetKey?: string, useCache = true, onProgress?: (done: number, total: number) => void) {
    if (!useCache) {
      this._cache = null
      this._scanning = null
    }

    if (!this._cache) {
      // share a single in-flight scan across concurrent callers, then cache it
      if (!this._scanning)
        this._scanning = this.scanAllFiles(onProgress)
      try {
        this._cache = await this._scanning
      }
      finally {
        this._scanning = null
      }
    }

    if (targetKey)
      return this._cache.filter(({ keypath }) => keypath === targetKey)
    return this._cache
  }

  private static async scanAllFiles(onProgress?: (done: number, total: number) => void): Promise<KeyOccurrence[]> {
    const startedAt = Date.now()
    const occurrences: KeyOccurrence[] = []
    const prefixes = new Set<string>()
    const filepaths = await this.enumerateDocumentPaths()
    Log.info(`🔍 Scanning ${filepaths.length} files for key usages…`)

    let done = 0
    const chunkCount = Math.ceil(filepaths.length / SCAN_CHUNK_SIZE)
    for (let c = 0; c < chunkCount; c++) {
      const chunk = filepaths.slice(c * SCAN_CHUNK_SIZE, (c + 1) * SCAN_CHUNK_SIZE)
      // read + parse the chunk concurrently, then hand control back to the event
      // loop so pending hovers/commands can run between chunks
      const results = await Promise.all(chunk.map(async (filepath) => {
        try {
          return await this.getOccurrencesOfFile(filepath)
        }
        catch {
          return { occurrences: [], dynamicPrefixes: [] } // unreadable file — skip
        }
      }))
      for (const result of results) {
        occurrences.push(...result.occurrences)
        for (const prefix of result.dynamicPrefixes)
          prefixes.add(prefix)
      }
      done += chunk.length
      if (onProgress)
        onProgress(done, filepaths.length)
      if (c > 0 && c % 40 === 0)
        Log.info(`   …${done}/${filepaths.length} files`)
    }

    this._dynamicPrefixes = [...prefixes]
    Log.info(`✅ Scanned ${filepaths.length} files → ${occurrences.length} usages, ${this._dynamicPrefixes.length} dynamic prefixes (${Date.now() - startedAt}ms)`)
    return occurrences
  }

  // globs derived from dynamic call sites (e.g. t(`foo.${x}`) -> "foo.*"), used to
  // keep dynamically-built keys out of the "unused" usage report
  static get dynamicKeyGlobs(): string[] {
    return this._dynamicPrefixes
      .filter(prefix => prefix.replace(/\.+$/, ''))
      .map(prefix => `${prefix}*`)
  }

  static async getAllOccurrenceLocations(targetKey: string) {
    const occurrences = await this.getAllOccurrences(targetKey)
    return await Promise.all(occurrences.map(o => this.getLocationOf(o)))
  }

  static async getLocationOf(occurrence: KeyOccurrence) {
    const document = await workspace.openTextDocument(occurrence.filepath)
    const range = new Range(
      document.positionAt(occurrence.start),
      document.positionAt(occurrence.end),
    )
    return new Location(document.uri, range)
  }

  static normalizeKey(key: string) {
    return key.replace(/\[(.*)\]/g, '.$1')
  }

  static async analyzeUsage(useCache = true, onProgress?: (done: number, total: number) => void): Promise<UsageReport> {
    const occurrences = await this.getAllOccurrences(undefined, useCache, onProgress)
    const grouped = new Map<string, typeof occurrences>()
    for (const occurrence of occurrences) {
      const group = grouped.get(occurrence.keypath)
      if (group)
        group.push(occurrence)
      else
        grouped.set(occurrence.keypath, [occurrence])
    }
    const usages: KeyUsage[] = [...grouped.entries()]
      .map(([keypath, occurrences]) => ({ keypath, occurrences }))

    // resolve once — `keysInUse` may read from files (see Config.keysInUseFromFiles)
    const keysInUse = Config.keysInUse
    // all the keys you have
    const allKeys = CurrentFile.loader.keys.map(i => this.normalizeKey(i))
    // keys occur in your code
    const inUseKeys = uniq([...usages.map(i => i.keypath), ...keysInUse].map(i => this.normalizeKey(i)))
    // keys in use
    const activeKeys = inUseKeys.filter(i => allKeys.includes(i))
    // keys not in use — also exclude anything matched by a dynamic call-site
    // prefix (e.g. t(`foo.${x}`) keeps foo.* out of the unused list)
    let idleKeys = allKeys
      .filter(i => !inUseKeys.includes(i))
      .filter(i => !micromatch.isMatch(i, [...keysInUse, ...this.dynamicKeyGlobs]))
    // keys in use, but actually you don't have them
    let missingKeys = inUseKeys.filter(i => !allKeys.includes(i))

    const rules = Global.derivedKeyRules
    // remove derived keys from idle, if the source key is in use
    idleKeys = idleKeys.filter((key) => {
      for (const r of rules) {
        const match = r.exec(key)
        if (match && match[1] && activeKeys.includes(match[1]))
          return false
      }
      return true
    })

    // for derived keys whose source key is considered missing
    // (is actually in use, could be a nested pluralization key scenario)
    // - add the source key to active
    // - remove the source key from missing
    // - remove the derived key from idle
    const missingKeysShouldBeActive: string[] = []
    idleKeys = idleKeys.filter((key) => {
      for (const r of rules) {
        const match = r.exec(key)
        if (match && match[1] && missingKeys.includes(match[1])) {
          missingKeysShouldBeActive.push(match[1])
          return false
        }
      }
      return true
    })
    activeKeys.push(...uniq(missingKeysShouldBeActive))
    missingKeys = missingKeys.filter(i => !missingKeysShouldBeActive.includes(i))

    const report = {
      active: usages.filter(i => activeKeys.includes(i.keypath)),
      missing: usages.filter(i => missingKeys.includes(i.keypath)),
      idle: idleKeys.map(i => ({ keypath: i, occurrences: [] })),
    }

    Log.info(`📊 Usage report: ${report.active.length} in use, ${report.idle.length} not in use, ${report.missing.length} missing (${allKeys.length} catalog keys, ${usages.length} distinct usages)`)
    this._onDidUsageReportChanged.fire(report)
    return report
  }
}
