import { keyLabel, type KeyMatch } from "../keys/keymap.ts"

/** One thing the user can do, however it is reached: menu, toolbar or keyboard. */
export type Command = {
  label: string
  run: () => void
  enabled: boolean
  /** Combinations that trigger it from the keyboard. */
  keys: KeyMatch[]
  /** Shown next to the command, e.g. ⌘Z. */
  shortcut?: string
  /** Checked at key time, for conditions that live outside the editor's state. */
  when?: () => boolean
  /** Its keys work even while typing in a field (⌘S, ⌘O), as they have nothing to do with text. */
  inFields?: boolean
}

export type CommandOptions = {
  keys?: KeyMatch[]
  /** A combination shown but handled elsewhere (⌘C / ⌘X use the browser's copy events). */
  hint?: KeyMatch
  enabled?: boolean
  when?: () => boolean
  inFields?: boolean
}

/** A command; `mod` is how the modifier key is written where it is shown ("⌘" or "Ctrl"). */
export function command(label: string, run: () => void, options: CommandOptions = {}, mod = "⌘"): Command {
  const keys = options.keys ?? []
  const shown = options.hint ?? keys[0]
  return {
    label,
    run,
    keys,
    enabled: options.enabled ?? true,
    shortcut: shown ? keyLabel(shown, mod) : undefined,
    when: options.when,
    inFields: options.inFields,
  }
}

/** Commands by name, some grouped (one per arrow key). */
export type CommandTable = Record<string, Command | Record<string, Command>>

/** Every command of a table, the grouped ones included, for key routing and the help page. */
export function allCommands(table: CommandTable): Command[] {
  return Object.values(table).flatMap((entry) => ("run" in entry ? [entry as Command] : Object.values(entry as Record<string, Command>)))
}
