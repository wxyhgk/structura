import { useMemo, useReducer } from "react"
import type { GuideTopic } from "../../guide/index.ts"
import type { Report } from "../analysis/report.ts"

/** The dialogs that are simply open or shut. */
export type DialogName = "smiles" | "fill" | "recognize" | "help"

/** Which of the editor's dialogs are open: the plain ones, the guide's page, and the analysis report shown. */
export type DialogsState = Record<DialogName, boolean> & { guide: GuideTopic | null; report: Report | null }

type Action =
  | { type: "set"; name: DialogName; open: boolean }
  | { type: "guide"; topic: GuideTopic | null }
  | { type: "report"; report: Report | null }
  | { type: "shortcuts" }

const closed: DialogsState = { smiles: false, fill: false, recognize: false, help: false, guide: null, report: null }

function reduce(state: DialogsState, action: Action): DialogsState {
  switch (action.type) {
    case "set":
      return { ...state, [action.name]: action.open }
    case "guide":
      return { ...state, guide: action.topic }
    case "report":
      return { ...state, report: action.report }
    case "shortcuts":
      // From the guide's link: the guide makes way for the shortcuts list.
      return { ...state, guide: null, help: true }
  }
}

/**
 * The editor's dialogs and overlays in one place: which are open, and the calls that open
 * and close them, the same for the menus, the commands and the 通式 workspace.
 */
export function useEditorDialogs() {
  const [state, dispatch] = useReducer(reduce, closed)
  const actions = useMemo(
    () => ({
      open: (name: DialogName) => dispatch({ type: "set", name, open: true }),
      /** For a dialog's onOpenChange. */
      setOpen: (name: DialogName) => (open: boolean) => dispatch({ type: "set", name, open }),
      showGuide: (topic: GuideTopic | null) => dispatch({ type: "guide", topic }),
      showReport: (report: Report | null) => dispatch({ type: "report", report }),
      /** Closes the guide and opens the shortcuts list. */
      guideToShortcuts: () => dispatch({ type: "shortcuts" }),
    }),
    [],
  )
  return { ...state, ...actions }
}

export type EditorDialogs = ReturnType<typeof useEditorDialogs>
