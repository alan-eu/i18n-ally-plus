import { describe, expect, it } from 'vitest'
import { scopeGitignorePattern } from '../../../src/utils/gitignore'

describe('scopeGitignorePattern', () => {
  const cases: [string, string, string | undefined][] = [
    // [rel, raw, expected]

    // root-level patterns are passed through unchanged
    ['', 'node_modules', 'node_modules'],
    ['', 'build/', 'build/'],
    ['', '/granted', '/granted'],

    // comments and blanks are dropped
    ['frontend', '# a comment', undefined],
    ['frontend', '   ', undefined],
    ['frontend', '', undefined],

    // non-anchored patterns match at any depth below the .gitignore's dir
    ['frontend', 'build/', 'frontend/**/build/'],
    ['frontend', 'coverage', 'frontend/**/coverage'],
    ['frontend', '*.log', 'frontend/**/*.log'],

    // anchored patterns (leading or embedded slash) stay under the .gitignore's dir
    ['frontend', '/build', 'frontend/build'],
    ['frontend', 'dist/cache', 'frontend/dist/cache'],

    // negations are preserved and scoped too
    ['frontend', '!keep', '!frontend/**/keep'],
    ['frontend', '!/keep', '!frontend/keep'],
    ['', '!keep', '!keep'],

    // nested directories keep their full relative prefix
    ['frontend/apps/fr-app', 'build/', 'frontend/apps/fr-app/**/build/'],
  ]

  for (const [rel, raw, expected] of cases) {
    it(`(${JSON.stringify(rel)}, ${JSON.stringify(raw)}) -> ${JSON.stringify(expected)}`, () => {
      expect(scopeGitignorePattern(rel, raw)).toEqual(expected)
    })
  }
})
