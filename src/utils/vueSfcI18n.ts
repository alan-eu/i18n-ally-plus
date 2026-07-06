import { parse } from '@vue/compiler-sfc'
import JSON5 from 'json5'
import YAML from 'js-yaml'

// Read/write the `<i18n>` custom blocks of a Vue SFC. This replaces the four
// helpers (squeeze/infuse + their block/meta types) that used to come from the
// abandoned `vue-i18n-locale-message` (which dragged in `vue-template-compiler`
// and pinned Vue 2). `@vue/compiler-sfc` parses SFC blocks independently of the
// Vue runtime version, so it works alongside the Vue 3 webview.

export interface SFCI18nBlock {
  lang: string
  locale?: string
  // { [locale]: messages }
  messages: Record<string, any>
}

function parseContent(content: string, lang: string): any {
  switch (lang) {
    case 'yaml':
    case 'yml':
      return YAML.load(content)
    case 'json5':
      return JSON5.parse(content)
    case 'json':
    default:
      return JSON.parse(content)
  }
}

function stringifyContent(content: any, lang: string): string {
  const indent = 2
  switch (lang) {
    case 'yaml':
    case 'yml':
      return YAML.dump(content, { indent })
    case 'json5':
      return `${JSON5.stringify(content, null, indent)}\n`
    case 'json':
    default:
      return `${JSON.stringify(content, null, indent)}\n`
  }
}

function i18nBlocksOf(content: string, filename: string) {
  const { descriptor } = parse(content, { filename })
  return descriptor.customBlocks.filter(b => b.type === 'i18n')
}

/** Extract the `<i18n>` blocks of an SFC into `{ lang, locale?, messages }[]`. */
export function squeezeVueSfc(content: string, filename: string): SFCI18nBlock[] {
  return i18nBlocksOf(content, filename).map((block) => {
    const lang = typeof block.attrs.lang === 'string' ? block.attrs.lang : 'json'
    const locale = typeof block.attrs.locale === 'string' ? block.attrs.locale : undefined
    const obj = parseContent(block.content, lang) || {}
    return locale
      ? { lang, locale, messages: { [locale]: obj } }
      : { lang, messages: obj }
  })
}

/**
 * Write `blocks` back into the SFC, replacing only each `<i18n>` block's inner
 * content and leaving everything else byte-for-byte. `blocks` must line up with
 * the SFC's `<i18n>` blocks in document order (as returned by `squeezeVueSfc`).
 */
export function infuseVueSfc(content: string, blocks: SFCI18nBlock[], filename: string): string {
  let result = ''
  let offset = 0
  i18nBlocksOf(content, filename).forEach((block, index) => {
    const meta = blocks[index]
    if (!meta)
      return
    const lang = typeof block.attrs.lang === 'string' ? block.attrs.lang : 'json'
    const locale = typeof block.attrs.locale === 'string' ? block.attrs.locale : undefined
    const messages = locale ? meta.messages[locale] : meta.messages
    result += content.slice(offset, block.loc.start.offset)
    result += `\n${stringifyContent(messages, lang)}`
    offset = block.loc.end.offset
  })
  result += content.slice(offset)
  return result
}
