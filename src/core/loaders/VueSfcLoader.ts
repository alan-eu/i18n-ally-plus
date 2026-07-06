import { workspace, Uri, WorkspaceEdit, Range } from 'vscode'
import { Log, SFCI18nBlock, applyPendingToObject, File, infuseVueSfc, squeezeVueSfc, unflatten } from '~/utils'
import { PendingWrite, NodeOptions } from '../types'
import { LocaleTree } from '../Nodes'
import { Global } from '../Global'
import { Config } from '../Config'
import { Loader } from './Loader'

export class VueSfcLoader extends Loader {
  constructor(
    public readonly uri: Uri,
  ) {
    super(`[SFC]${uri.fsPath}`)

    this.load()
  }

  _parsedSections: SFCI18nBlock[] = []

  get filepath() {
    return this.uri.fsPath
  }

  get files() {
    return []
  }

  async load() {
    const filepath = this.filepath
    Log.info(`📑 Loading sfc ${filepath}`)
    const doc = await workspace.openTextDocument(this.uri)
    this._parsedSections = squeezeVueSfc(doc.getText(), filepath)

    this.updateLocalesTree()
    this._onDidChange.fire(this.name)
  }

  private getOptions(section: SFCI18nBlock, locale: string, index: number): NodeOptions {
    return {
      filepath: this.uri.fsPath,
      locale: Config.normalizeLocale(locale),
      features: {
        VueSfc: true,
      },
      meta: {
        VueSfcSectionIndex: index,
        VueSfcLocale: locale,
      },
    }
  }

  _locales = new Set<string>()

  private updateLocalesTree() {
    this._flattenLocaleTree = {}
    this._locales = new Set()

    const tree = new LocaleTree({ keypath: '', features: { VueSfc: true } })
    for (const [index, section] of this._parsedSections.entries()) {
      if (!section.messages)
        continue
      const messages = unflatten(section.messages)
      for (const [locale, value] of Object.entries(messages)) {
        this._locales.add(Config.normalizeLocale(locale))
        this.updateTree(tree, value, '', '', this.getOptions(section, locale, index))
      }
    }
    this._localeTree = tree
  }

  get locales() {
    return Array.from(this._locales)
  }

  async write(pendings: PendingWrite | PendingWrite[]) {
    if (!Array.isArray(pendings))
      pendings = [pendings]
    pendings = pendings.filter(i => i)

    if (!this._parsedSections.length)
      return

    for (const pending of pendings) {
      const record = this.getRecordByKey(pending.keypath, pending.locale, true)
      if (!record)
        continue

      const sectionIndex = record.meta ? (record.meta.VueSfcSectionIndex || 0) : 0

      const section = this._parsedSections[sectionIndex]
      if (!section)
        continue

      const locale = record?.meta?.VueSfcLocale || pending.locale

      section.messages[locale] = applyPendingToObject(
        section.messages[locale] || {},
        pending.keypath,
        pending.value,
        await Global.requestKeyStyle(),
      )
    }

    const doc = await workspace.openTextDocument(this.uri)
    const content = infuseVueSfc(doc.getText(), this._parsedSections, this.filepath)

    if (doc.isDirty) {
      const edit = new WorkspaceEdit()
      edit.replace(this.uri, new Range(doc.positionAt(0), doc.positionAt(Infinity)), content)

      await workspace.applyEdit(edit)
    }
    else {
      await File.write(this.filepath, content)
    }

    await this.load()
  }

  canHandleWrites(pending: PendingWrite) {
    return !!this._parsedSections.length && pending.filepath === this.filepath
  }
}
