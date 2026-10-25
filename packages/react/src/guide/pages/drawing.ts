import { attachmentPage } from "./attachment.tsx"
import { bracketsPage } from "./brackets.tsx"
import { drawPage } from "./draw.tsx"
import { filesPage } from "./files.tsx"
import { labelsPage } from "./labels.tsx"
import { scaffoldsPage } from "./scaffolds.tsx"
import { selectPage } from "./select.tsx"
import { shortcutsPage } from "./shortcuts.tsx"
import { startPage } from "./start.tsx"
import { visionPage } from "./vision.tsx"

/**
 * The structure editor's guide: drawing, and the marks a generic formula draws on its canvas.
 * Defining variables and generating compounds are the 通式 page's (pages/index.ts has them all).
 */
export const DRAWING_PAGES = [startPage, drawPage, labelsPage, scaffoldsPage, selectPage, bracketsPage, attachmentPage, shortcutsPage, filesPage, visionPage] as const
