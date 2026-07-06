import child_process from 'child_process'
import path from 'path'
import { Parser } from './base'
import i18n from '~/i18n'
import { Log } from '~/utils'
import { Config } from '~/core'

const LanguageIds = {
  js: 'javascript',
  ts: 'typescript',
} as const

const LanguageExts = {
  js: 'm?js',
  ts: 'ts',
} as const

export class EcmascriptParser extends Parser {
  readonly readonly = true

  constructor(public readonly id: 'js'|'ts' = 'js') {
    super([LanguageIds[id]], LanguageExts[id])
  }

  async parse() {
    return {}
  }

  async dump() {
    return ''
  }

  async load(filepath: string) {
    // dist/loader.js is a self-contained sucrase-based transpiling loader
    // (bundled by tsup); run it in a subprocess to evaluate the locale module
    // in isolation and read back its value as JSON
    const loader = path.resolve(Config.extensionPath!, 'dist/loader.js')

    return new Promise<any>((resolve, reject) => {
      const cmd = `node "${loader}" "${filepath}"`
      child_process.exec(cmd, (err, stdout) => {
        if (err)
          return reject(err)
        try {
          resolve(JSON.parse(stdout.trim()))
        }
        catch (e) {
          reject(e)
        }
      })
    })
  }

  async save() {
    Log.error(i18n.t('prompt.writing_js'))
  }
}
