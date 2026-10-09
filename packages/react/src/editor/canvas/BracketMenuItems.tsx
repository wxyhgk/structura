import type { Op } from "@structura/core/ops"
import type { Bracket } from "@structura/core/types"
import { ContextMenuItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator } from "../../components/ui/context-menu.tsx"

/**
 * A bracket's right-click menu: a group or a repeat unit, its count, selecting what it holds,
 * taking it away. Switching to a repeat unit starts it at n = 1–4.
 */
export function BracketMenuItems({ bracket, run, onCount, onSelect }: { bracket: Bracket; run: (ops: Op[]) => void; onCount: (id: number) => void; onSelect: (atoms: number[]) => void }) {
  return (
    <>
      <ContextMenuRadioGroup value={bracket.kind} onValueChange={(kind) => kind !== bracket.kind && run([{ op: "set_bracket", id: bracket.id, kind: kind as Bracket["kind"] }])}>
        <ContextMenuRadioItem value="group">基团</ContextMenuRadioItem>
        <ContextMenuRadioItem value="repeat">重复单元{bracket.repeat ? `（${bracket.repeat.name} = ${bracket.repeat.min}–${bracket.repeat.max}）` : ""}</ContextMenuRadioItem>
      </ContextMenuRadioGroup>
      <ContextMenuItem onSelect={() => onCount(bracket.id)}>重复次数…</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem onSelect={() => onSelect(bracket.atoms)}>选中括号里的原子</ContextMenuItem>
      <ContextMenuItem onSelect={() => run([{ op: "remove_bracket", id: bracket.id }])}>删除括号</ContextMenuItem>
    </>
  )
}
