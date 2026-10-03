// The user guide (帮助 → 使用说明): pages with live chemical pictures, a dialog to read
// them in, and "?" links that open it on one page. It depends on core and the UI kit only;
// the editor hands in what it needs through GuideHost. To add a page, see pages/index.ts.
export { GuideDialog } from "./GuideDialog.tsx"
export { HelpLink } from "./HelpLink.tsx"
export type { GuideTopic } from "./pages/index.ts"
export type { GuideHost, PressKey } from "./types.ts"
