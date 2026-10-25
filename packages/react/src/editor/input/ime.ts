import type { KeyboardEvent } from "react"

/**
 * Whether this key belongs to an input method still composing (pinyin, kana…): its Enter picks
 * the characters and its Escape drops them, so neither may submit or cancel the field. Safari
 * ends the composition before the keydown, which then only says so by keyCode 229.
 */
export function composing(event: KeyboardEvent): boolean {
  return event.nativeEvent.isComposing || event.keyCode === 229
}
