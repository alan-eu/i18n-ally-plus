import { ProgressLocation, commands, window } from 'vscode'
import { Commands } from './commands'
import { ExtensionModule } from '~/modules'
import { Analyst } from '~/core'

export default <ExtensionModule> function() {
  return [
    commands.registerCommand(Commands.refresh_usage,
      async() => {
        await window.withProgress(
          {
            location: ProgressLocation.Notification,
            title: 'i18n Ally: analyzing usage',
            cancellable: false,
          },
          async(progress) => {
            await Analyst.analyzeUsage(false, (done, total) => {
              progress.report({ message: `${done}/${total} files` })
            })
          },
        )
      },
    ),
  ]
}
