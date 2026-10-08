import { GuideDialog, type GuideTopic, type PressKey } from "../../guide/index.ts"
import { MOD } from "../browser.ts"
import { hotkeyOps } from "@structura/engine"
import { useOverlayMark } from "../input/overlays.ts"

/** This editor's key table, as the guide pictures key presses; one function, so its pictures are drawn once. */
const pressKey: PressKey = (mol, atom, key) => hotkeyOps(mol, { type: "atom", id: atom }, key)

/** The user guide inside this editor: what the guide needs from the editor, handed in. */
export function EditorGuide({ topic, onTopic, openShortcuts }: { topic: GuideTopic | null; onTopic: (topic: GuideTopic | null) => void; openShortcuts: () => void }) {
  const overlayMark = useOverlayMark()
  return <GuideDialog topic={topic} onTopic={onTopic} host={{ mod: MOD, pressKey, openShortcuts, contentProps: overlayMark }} />
}
