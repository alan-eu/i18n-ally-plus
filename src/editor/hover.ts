import { MarkdownString } from 'vscode'
import { Commands } from '~/commands'
import i18n from '~/i18n'
import { CurrentFile, Global, LocaleRecord, Config, ActionSource } from '~/core'
import { decorateLocale, escapeMarkdown, NodeHelper } from '~/utils'

const EmptyButton = '⠀⠀'

function makeMarkdownCommand(command: Commands, args: any): string {
  return `command:${command}?${encodeURIComponent(JSON.stringify({ actionSource: ActionSource.Hover, ...args }))}`
}

function formatValue(text: string) {
  return escapeMarkdown(text.replace(/[\s]+/g, ' '))
}

function getAvaliableCommands(record?: LocaleRecord, keyIndex?: number) {
  const commands = []

  if (record) {
    const { keypath, locale } = record

    if (Config.reviewEnabled) {
      commands.push({
        text: i18n.t('command.open_review'),
        icon: '💬', // '$(comment-discussion)' // AWAIT_VSCODE_FIX
        command: makeMarkdownCommand(Commands.open_in_editor, { keypath, locale, keyIndex }),
      })
    }

    if (NodeHelper.isTranslatable(record)) {
      commands.push({
        text: i18n.t('command.translate_key'),
        icon: '🌏', // '$(globe)' // AWAIT_VSCODE_FIX
        command: makeMarkdownCommand(Commands.translate_key, { keypath, locale }),
      })
    }

    if (NodeHelper.isEditable(record)) {
      commands.push({
        text: i18n.t('command.edit_key'),
        icon: '✏️', // '$(edit)' // AWAIT_VSCODE_FIX
        command: Config.preferEditor
          ? makeMarkdownCommand(Commands.open_in_editor, { keypath, locale, keyIndex })
          : makeMarkdownCommand(Commands.edit_key, { keypath, locale }),
      })
    }
    else {
      commands.push(EmptyButton)
    }

    if (NodeHelper.isOpenable(record)) {
      commands.push({
        text: i18n.t('command.open_key'),
        icon: '↗️', // '$(link-external)' // AWAIT_VSCODE_FIX
        command: makeMarkdownCommand(Commands.open_key, { keypath, locale }),
      })
    }
    else {
      commands.push(EmptyButton)
    }
  }

  return commands
}

export function createTable(visibleLocales: string[], records: Record<string, LocaleRecord>, maxLength = 0, keyIndex?: number) {
  const transTable = visibleLocales
    .flatMap((locale) => {
      const record = records[locale]
      if (!record)
        return []

      // hide locales the key doesn't have when `hideMissingLocales` is enabled
      if (Config.hideMissingLocales && record.shadow)
        return []

      const row = {
        locale: decorateLocale(locale),
        value: formatValue(CurrentFile.loader.getValueByKey(record.keypath, locale, maxLength) || '-'),
        commands: '',
      }
      const commands = getAvaliableCommands(record, keyIndex)
      row.commands = commands
        .map(c => typeof c === 'string' ? c : `[${c.icon}](${c.command} "${c.text}")`)
        .join(' ')
      return [row]
    })
    .map(item => `| | **${item.locale}** | | ${item.value} | ${item.commands} |`)
    .join('\n')

  if (!transTable)
    return ''

  return `| | | | | |\n|---|---:|---|---|---:|\n${transTable}\n| | | | | |`
}

export function createHover(keypath: string, maxLength = 0, mainLocale?: string, keyIndex?: number) {
  const loader = CurrentFile.loader
  const records = loader.getTranslationsByKey(keypath, undefined)
  if (!Object.keys(records).length)
    return undefined

  mainLocale = mainLocale || Config.displayLanguage

  const locales = Global.visibleLocales.filter(i => i !== mainLocale)
  const table1 = createTable([mainLocale, ...locales], records, maxLength, keyIndex)
  const markdown = `${table1}`

  const markdownText = new MarkdownString(`${markdown}`, true)
  markdownText.isTrusted = true

  return markdownText
}

/**
 * There should be a table
 *
 * | A | B |
 * |---|---|
 * | Hello | World |
 *
 * But nothing is rendered
 */
function a() {

}

a()
