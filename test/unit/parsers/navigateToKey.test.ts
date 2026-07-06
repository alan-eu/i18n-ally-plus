import { describe, expect, it } from 'vitest'
// @ts-expect-error no types
import JsonMap from 'json-source-map'
import { findKeyInAST } from '../../../src/parsers/navigate'

// mirrors JsonParser.parseAST — builds {key, start, end} for every JSON node
function parseAST(text: string) {
  const map = JsonMap.parse(text).pointers
  return Object.entries<any>(map)
    .filter(([k]) => k)
    .map(([k, v]) => ({
      quoted: true,
      start: v.value.pos + 1,
      end: v.valueEnd.pos - 1,
      key: k.slice(1).replace(/\//g, '.').replace(/~0/g, '~').replace(/~1/g, '/'),
    }))
}

describe('findKeyInAST (go-to-definition key resolution)', () => {
  const json = JSON.stringify(
    { CoverByDefaultInviteForm: { all_fields_required: 'All fields are required' } },
    null,
    2,
  )
  const ast = parseAST(json)

  // returns the string the range points at, proving it landed on the value
  const valueAt = (keypath: string) => {
    const r = findKeyInAST(ast, keypath)
    return r ? json.slice(r.start, r.end) : undefined
  }

  it('resolves an exact keypath', () => {
    expect(valueAt('CoverByDefaultInviteForm.all_fields_required')).toBe('All fields are required')
  })

  it('resolves a namespaced keypath (in-file key is a suffix)', () => {
    expect(valueAt('employeeInvites.CoverByDefaultInviteForm.all_fields_required')).toBe('All fields are required')
  })

  it('resolves a path-scoped + namespaced keypath', () => {
    expect(valueAt('myapp.employeeInvites.CoverByDefaultInviteForm.all_fields_required')).toBe('All fields are required')
  })

  it('prefers the longest (most specific) suffix match', () => {
    const r = findKeyInAST(ast, 'ns.CoverByDefaultInviteForm.all_fields_required')
    expect(r?.key).toBe('CoverByDefaultInviteForm.all_fields_required')
  })

  it('returns undefined for a key not in the file', () => {
    expect(findKeyInAST(ast, 'employeeInvites.Nope.missing')).toBeUndefined()
  })
})
