/* eslint-disable no-template-curly-in-string */
import { describe, expect, it } from 'vitest'
import { stringConcatenationToTemplate } from '../../../src/extraction/parseHardString'

describe('parseHardString', () => {
  it('stringContractionToTemplate', () => {
    expect(stringConcatenationToTemplate('\'a\' + b + \'c\'')).toEqual('`a${b}c`')
    expect(stringConcatenationToTemplate('"foo"+bar()')).toEqual('`foo${bar()}`')
    expect(stringConcatenationToTemplate('a + b + c')).toEqual('`${a + b + c}`')
    expect(stringConcatenationToTemplate('a + ` 1 ${d}`+ b + c')).toEqual('`${a} 1 ${d}${b + c}`')
  })
})
