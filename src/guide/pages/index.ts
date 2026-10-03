import { aiPage } from "./ai.tsx"
import { attachmentPage } from "./attachment.tsx"
import { drawPage } from "./draw.tsx"
import { enumeratePage } from "./enumerate.tsx"
import { filesPage } from "./files.tsx"
import { fragmentsPage } from "./fragments.tsx"
import { labelsPage } from "./labels.tsx"
import { markushPage } from "./markush.tsx"
import { scaffoldsPage } from "./scaffolds.tsx"
import { selectPage } from "./select.tsx"
import { shortcutsPage } from "./shortcuts.tsx"
import { startPage } from "./start.tsx"

/** Every page, in the order they are listed; pages with the same group sit together. */
export const PAGES = [startPage, drawPage, labelsPage, scaffoldsPage, selectPage, shortcutsPage, filesPage, markushPage, attachmentPage, fragmentsPage, enumeratePage, aiPage] as const

/** A page's id: what a "?" link or the editor opens the guide on. */
export type GuideTopic = (typeof PAGES)[number]["id"]

export function pageOf(id: GuideTopic) {
  return PAGES.find((page) => page.id === id) ?? PAGES[0]
}
