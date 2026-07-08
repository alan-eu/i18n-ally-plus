import fs from 'fs'
import { workspace, Range, Location, TextDocument, Uri, EventEmitter } from 'vscode'
import micromatch from 'micromatch'
import { uniq } from '~/utils/lodash'
import { Global } from './Global'
import { CurrentFile } from './CurrentFile'
import { UsageReport } from './types'
import { KeyDetector, Config, KeyOccurrence, KeyUsage } from '.'
import { Log } from '~/utils'
import { gitignoredGlob } from '~/utils/glob'

export class Analyst {
  private static _cache: KeyOccurrence[] | null = null
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
    let doc = workspace.textDocuments.find(doc => doc.uri.fsPath === filepath)
    if (!doc)
      doc = await workspace.openTextDocument(Uri.file(filepath))
    return this.getOccurrencesOfText(doc, filepath)
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

  static async getAllOccurrences(targetKey?: string, useCache = true) {
    if (!useCache)
      this._cache = null

    if (!this._cache) {
      const occurrences: KeyOccurrence[] = []
      const prefixes = new Set<string>()
      const filepaths = await this.enumerateDocumentPaths()

      for (const filepath of filepaths) {
        const result = await this.getOccurrencesOfFile(filepath)
        occurrences.push(...result.occurrences)
        for (const prefix of result.dynamicPrefixes)
          prefixes.add(prefix)
      }

      this._cache = occurrences
      this._dynamicPrefixes = [...prefixes]
    }

    if (targetKey)
      return this._cache.filter(({ keypath }) => keypath === targetKey)
    return this._cache
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

  static async analyzeUsage(useCache = true): Promise<UsageReport> {
    const occurrences = await this.getAllOccurrences(undefined, useCache)
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

    this._onDidUsageReportChanged.fire(report)
    return report
  }
}
