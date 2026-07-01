import { resolve, join, dirname } from 'path'
import fs from 'fs-extra'
// @ts-expect-error
import { glob } from 'glob-gitignore'
import fg from 'fast-glob'
// @ts-expect-error
import parseGitIgnore from 'parse-gitignore'
import { Config } from '../core/Config'
import { Global } from '../core/Global'
import { Log } from './Log'
import { scopeGitignorePattern } from './gitignore'

/**
 * Collect ignore patterns from the root `.gitignore` and every nested `.gitignore`
 * (outside node_modules), each scoped to its own directory. This lets usage scanning
 * respect per-package ignores (e.g. a `frontend/.gitignore` that hides `build/`),
 * which a single root-level read would miss.
 */
async function collectGitignorePatterns(root: string): Promise<string[]> {
  const patterns: string[] = []

  let files: string[] = []
  try {
    files = await fg('**/.gitignore', {
      cwd: root,
      dot: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
      followSymbolicLinks: false,
      suppressErrors: true,
    })
  }
  catch (e) {
    Log.error(e)
  }

  for (const file of files) {
    try {
      const dir = dirname(file)
      const rel = dir === '.' ? '' : dir.replace(/\\/g, '/')
      const raw = await fs.promises.readFile(join(root, file), 'utf-8')
      const entries: string[] = parseGitIgnore(raw)
      for (const entry of entries) {
        const scoped = scopeGitignorePattern(rel, entry)
        if (scoped)
          patterns.push(scoped)
      }
    }
    catch (e) {
      Log.error(e)
    }
  }

  return patterns
}

export async function gitignoredGlob(globStr: string, dir: string) {
  const root = Global.rootpath

  const ignore = [
    'node_modules',
    'dist',
    ...await collectGitignorePatterns(root),
    ...Global.localesPaths || [],
    ...Config.usageScanningIgnore,
  ]

  const files = await glob(globStr, {
    cwd: dir,
    ignore,
  }) as string[]

  return files.map(f => resolve(dir, f))
}
