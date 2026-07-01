/**
 * Rewrite a single `.gitignore` pattern found in directory `rel` (posix, relative to
 * the search root; '' for the root itself) into a root-relative pattern understood by
 * the `ignore` matcher used by `glob-gitignore`.
 *
 * Nested `.gitignore` semantics: a pattern is anchored to its own directory when it
 * contains a slash anywhere but the end; otherwise it matches at any depth below that
 * directory. Comments/blank lines return `undefined`. Negations (`!`) are preserved.
 */
export function scopeGitignorePattern(rel: string, raw: string): string | undefined {
  let pattern = raw.trim()
  if (!pattern || pattern.startsWith('#'))
    return

  let negate = ''
  if (pattern.startsWith('!')) {
    negate = '!'
    pattern = pattern.slice(1)
  }
  if (!pattern)
    return

  // root-level patterns already match relative to the search root
  if (!rel)
    return `${negate}${pattern}`

  const body = pattern.replace(/^\//, '')
  // a leading or embedded slash (ignoring a trailing one) anchors to `rel`
  const anchored = pattern.replace(/\/$/, '').includes('/')
  const scoped = anchored
    ? `${rel}/${body}`
    : `${rel}/**/${body}`

  return `${negate}${scoped}`
}
