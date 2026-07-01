// Telemetry has been removed from this build.
//
// No usage data is collected, stored, or transmitted: there is no Amplitude client,
// no network calls, no user id, and no user/feature properties. The enums and the
// no-op `Telemetry` shim below are kept only so the existing (now inert) call sites
// across the codebase keep compiling — none of them do anything.
import { LocaleTreeItem, ProgressSubmenuItem } from '~/views'
import { CommandOptions } from '~/commands/manipulations/common'

export enum TelemetryKey {
  Activated = 'activated',
  DeleteKey = 'delete_key',
  Disabled = 'disabled',
  EditKey = 'edit_key',
  EditorOpen = 'editor_open',
  Enabled = 'enabled',
  ExtractString = 'extract_string',
  ExtractStringBulk = 'extract_string_bulk',
  GoToKey = 'goto_key',
  InsertKey = 'insert_key',
  Installed = 'installed',
  NewKey = 'new_key',
  RenameKey = 'rename_key',
  ReviewAddComment = 'review_add_comment',
  ReviewApplySuggestion = 'review_apply_suggestion',
  ReviewApplyTranslation = 'review_apply_translation',
  TranslateKey = 'translate_key',
  Updated = 'updated',
  ReviewEditComment = 'review_edit_comment',
  ReviewResolveComment = 'review_resolve_comment'
}

export enum ActionSource {
  None = 'none',
  CommandPattele = 'command_pattele',
  TreeView = 'tree_view',
  Hover = 'hover',
  ContextMenu = 'context_menu',
  UiEditor = 'ui_editor',
  Review = 'review'
}

export class Telemetry {
  /** No-op: telemetry has been removed. Nothing is recorded or sent. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static async track(key: TelemetryKey, properties?: Record<string, any>, immediate?: boolean): Promise<void> {
    // no-op: telemetry removed
  }

  static getActionSource(item?: LocaleTreeItem | ProgressSubmenuItem | CommandOptions) {
    return (item instanceof LocaleTreeItem || item instanceof ProgressSubmenuItem)
      ? ActionSource.TreeView
      : item?.actionSource || ActionSource.CommandPattele
  }
}
