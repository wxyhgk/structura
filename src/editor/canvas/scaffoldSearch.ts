import { scaffolds, type Scaffold } from "@structura/core/scaffolds"

/** Templates whose name, English or Chinese, contains what was typed; names starting with it first. */
export function matchScaffolds(text: string): Scaffold[] {
  const words = text.trim().toLowerCase()
  if (!words) return scaffolds()
  const hits = scaffolds().filter((item) => item.name.includes(words) || item.zh.includes(words))
  return hits.sort((a, b) => Number(!(a.name.startsWith(words) || a.zh.startsWith(words))) - Number(!(b.name.startsWith(words) || b.zh.startsWith(words))))
}
