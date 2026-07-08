import { commands, env, Uri } from 'vscode'
import { ExtensionModule } from '~/modules'
import { Commands } from '~/commands'

export default <ExtensionModule> function() {
  return [
    commands.registerCommand(Commands.open_docs_hard_string,
      async() => {
        await env.openExternal(Uri.parse('https://github.com/lokalise/i18n-ally/wiki/Hard-coded-Strings-Extraction'))
      }),
  ]
}
