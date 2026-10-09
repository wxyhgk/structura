import type { ContextTarget, Command } from "@structura/engine"
import type { Op } from "@structura/core/ops"
import type { Attachment } from "@structura/markush"
import type { Bracket } from "@structura/core/types"
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "../../components/ui/context-menu.tsx"
import type { Commands } from "../hooks/useCommands.ts"
import { IDENTIFIER_NAMES, type IdentifierKind } from "../identifiers.ts"
import { useOverlayMark } from "../input/overlays.ts"
import { AttachmentShapeMenu } from "../markush/AttachmentShapeMenu.tsx"
import { BracketMenuItems } from "./BracketMenuItems.tsx"

/** Elements offered on an atom's menu, the ones drawn most. */
const ELEMENTS = ["C", "N", "O", "S", "P", "F", "Cl", "Br", "I", "H", "B", "Si"]

function Item({ command, label = command.label }: { command: Command; label?: string }) {
  return (
    <ContextMenuItem disabled={!command.enabled} onSelect={command.run}>
      {label}
      {command.shortcut && <ContextMenuShortcut>{command.shortcut}</ContextMenuShortcut>}
    </ContextMenuItem>
  )
}

/** "复制为 SMILES / InChI / InChIKey" and "分析…", for whatever the menu is about. */
function Identify({ onCopyAs, onAnalyze }: { onCopyAs: (kind: IdentifierKind) => void; onAnalyze: () => void }) {
  return (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger>复制为</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {(Object.keys(IDENTIFIER_NAMES) as IdentifierKind[]).map((kind) => (
            <ContextMenuItem key={kind} onSelect={() => onCopyAs(kind)}>
              {IDENTIFIER_NAMES[kind]}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuItem onSelect={onAnalyze}>分析…</ContextMenuItem>
    </>
  )
}

/**
 * The canvas's right-click menu, by what was clicked: the selection (edit, transform,
 * structure), one atom (element, charge, label), one bond (order, wedge), a bracket (group
 * or repeat unit, its count), or empty canvas (paste, select all). Copying as SMILES and the
 * analysis act on the selection, or on the whole molecule of the atom or bond clicked. An
 * atom with a variable attachment also offers how that is drawn.
 */
export function CanvasMenu({
  target,
  attachments,
  commands: c,
  run,
  onEditLabel,
  onSelectMolecule,
  onCopyAs,
  onAnalyze,
  brackets,
  onBracketCount,
  onSelectAtoms,
}: {
  target: ContextTarget | null
  attachments?: Attachment[]
  commands: Commands
  run: (ops: Op[]) => void
  /** The drawing's brackets, for a bracket's menu. */
  brackets?: Bracket[]
  /** Opens 重复次数 for this bracket. */
  onBracketCount: (id: number) => void
  onSelectAtoms: (atoms: number[]) => void
  onEditLabel: (atom: number) => void
  onSelectMolecule: (atom: number) => void
  onCopyAs: (kind: IdentifierKind) => void
  onAnalyze: () => void
}) {
  const overlayMark = useOverlayMark()
  if (!target) return null
  const attachment = target.kind === "atom" ? attachments?.find((item) => item.atom === target.id) : undefined
  const bracket = target.kind === "bracket" ? brackets?.find((item) => item.id === target.id) : undefined
  return (
    <ContextMenuContent {...overlayMark} data-testid="canvas-menu">
      {target.kind === "selection" && (
        <>
          <Item command={c.cut} />
          <Item command={c.copy} />
          <Item command={c.copyImage} />
          <Item command={c.duplicate} />
          <Item command={c.remove} />
          <ContextMenuSeparator />
          <ContextMenuSub>
            <ContextMenuSubTrigger>旋转和翻转</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <Item command={c.rotateLeft} />
              <Item command={c.rotateRight} />
              <Item command={c.rotateHalf} />
              <Item command={c.flipHorizontal} />
              <Item command={c.flipVertical} />
            </ContextMenuSubContent>
          </ContextMenuSub>
          <Item command={c.clean} />
          <Item command={c.join} />
          <Item command={c.replace} />
          <Item command={c.bracket} />
          {c.expandGroups.enabled && <Item command={c.expandGroups} />}
          {c.collapseGroups.enabled && <Item command={c.collapseGroups} />}
          <ContextMenuSeparator />
          <Identify onCopyAs={onCopyAs} onAnalyze={onAnalyze} />
        </>
      )}
      {target.kind === "atom" && (
        <>
          <ContextMenuSub>
            <ContextMenuSubTrigger>元素</ContextMenuSubTrigger>
            <ContextMenuSubContent className="grid grid-cols-4">
              {ELEMENTS.map((el) => (
                <ContextMenuItem key={el} className="justify-center" onSelect={() => run([{ op: "set_element", atom: target.id, el }])}>
                  {el}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSub>
            <ContextMenuSubTrigger>电荷</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {[
                [1, "+1"],
                [-1, "−1"],
                [0, "无电荷"],
              ].map(([charge, name]) => (
                <ContextMenuItem key={name} onSelect={() => run([{ op: "set_charge", atom: target.id, charge: Number(charge) }])}>
                  {name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuItem onSelect={() => onEditLabel(target.id)}>
            编辑标签…<ContextMenuShortcut>Enter</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => onSelectMolecule(target.id)}>选中整个分子</ContextMenuItem>
          {attachment && <AttachmentShapeMenu attachment={attachment} run={run} />}
          <ContextMenuSeparator />
          <Identify onCopyAs={onCopyAs} onAnalyze={onAnalyze} />
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => run([{ op: "remove", atoms: [target.id] }])}>删除这个原子</ContextMenuItem>
        </>
      )}
      {target.kind === "bond" && (
        <>
          {[
            [1, "单键"],
            [2, "双键"],
            [3, "三键"],
          ].map(([order, name]) => (
            <ContextMenuItem key={name} onSelect={() => run([{ op: "set_bond", bond: target.id, order: Number(order) as 1 | 2 | 3 }])}>
              {name}
            </ContextMenuItem>
          ))}
          <ContextMenuSub>
            <ContextMenuSubTrigger>立体</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {[
                ["up", "楔形（朝外）"],
                ["down", "虚楔（朝里）"],
                ["none", "普通"],
              ].map(([stereo, name]) => (
                <ContextMenuItem key={stereo} onSelect={() => run([{ op: "set_bond", bond: target.id, order: 1, stereo: stereo as "up" | "down" | "none" }])}>
                  {name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />
          <Identify onCopyAs={onCopyAs} onAnalyze={onAnalyze} />
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => run([{ op: "remove", bonds: [target.id] }])}>删除这根键</ContextMenuItem>
        </>
      )}
      {bracket && <BracketMenuItems bracket={bracket} run={run} onCount={onBracketCount} onSelect={onSelectAtoms} />}
      {target.kind === "canvas" && (
        <>
          <Item command={c.paste} />
          <Item command={c.selectAll} />
          <Item command={c.fitAll} />
        </>
      )}
    </ContextMenuContent>
  )
}
