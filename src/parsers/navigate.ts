import type { KeyInDocument } from '~/core'

/**
 * Find the AST entry for a keypath when navigating to a key's definition.
 *
 * Prefers an exact match (flat files / non-namespaced projects). Otherwise the
 * locale file stores keys relative to itself, so the full (scoped) keypath
 * carries a namespace / path-scope prefix the file's keys don't have — e.g.
 * `myapp.employeeInvites.Form.field` in source vs `Form.field` in
 * employeeInvites.json. Fall back to the most specific (longest) in-file key
 * that is a suffix of the keypath, so Go-to-Definition lands on the exact key
 * instead of the top of the file.
 */
export function findKeyInAST(keys: KeyInDocument[], keypath: string): KeyInDocument | undefined {
  const exact = keys.find(k => k.key === keypath)
  if (exact)
    return exact

  let best: KeyInDocument | undefined
  for (const k of keys) {
    if (k.key && keypath.endsWith(`.${k.key}`) && (!best || k.key.length > best.key.length))
      best = k
  }
  return best
}
