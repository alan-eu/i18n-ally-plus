import { window } from 'vscode'
import { ExtensionModule } from '~/modules'
import { ViewIds } from './ViewIds'
import { CurrentFileLocalesTreeProvider, ProgressProvider, LocalesTreeProvider } from './providers'
import { UsageReportProvider } from './providers/UsageReportProvider'

export * from './items'
export * from './providers'

const m: ExtensionModule = (ctx) => {
  const currentFileTreeProvider = new CurrentFileLocalesTreeProvider(ctx)

  // Explorer tab
  window.createTreeView(ViewIds.file_in_explorer, {
    treeDataProvider: currentFileTreeProvider,
    showCollapseAll: true,
  })

  // Extension tab
  window.createTreeView(ViewIds.file, {
    treeDataProvider: currentFileTreeProvider,
    showCollapseAll: true,
  })

  window.createTreeView(ViewIds.progress, {
    treeDataProvider: new ProgressProvider(ctx),
    showCollapseAll: true,
  })

  window.createTreeView(ViewIds.tree, {
    treeDataProvider: new LocalesTreeProvider(ctx),
    showCollapseAll: true,
  })

  const usageReportProvider = new UsageReportProvider(ctx)
  usageReportProvider.view = window.createTreeView(ViewIds.usage, {
    treeDataProvider: usageReportProvider,
    showCollapseAll: true,
  })

  return []
}

export default m
