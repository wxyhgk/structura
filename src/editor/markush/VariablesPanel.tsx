import { Button } from "@/components/ui/button"
import type { Attachment, Molecule, Proviso, RingClosure, Variable } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { HelpLink, type GuideTopic } from "@/guide"
import { AttachmentRow } from "./AttachmentRow.tsx"
import { ClosuresSection } from "./ClosuresSection.tsx"
import { LibrarySizeLine } from "./LibrarySizeLine.tsx"
import { ProvisosSection } from "./ProvisosSection.tsx"
import { variableNames } from "./variableNames.ts"
import { VariableRow } from "./VariableRow.tsx"

/**
 * The generic formula's variables beside the canvas: every placeholder label on the
 * drawing (R1, X…) and what each may stand for. Every change is an op, so it can be undone.
 */
export function VariablesPanel({
  mol,
  selected,
  variables,
  attachments,
  provisos,
  ringClosures,
  run,
  canEnumerate,
  onEnumerate,
  onFill,
  onHelp,
}: {
  mol: Molecule
  /** The selected atoms, which a variable can take in as a drawn piece. */
  selected: number[]
  variables: Record<string, Variable> | undefined
  attachments: Attachment[] | undefined
  /** The claim's provisos: excluded combinations and compounds. */
  provisos: Proviso[] | undefined
  /** Pairs of variables that may together close a ring. */
  ringClosures: RingClosure[] | undefined
  run: Run
  canEnumerate: boolean
  onEnumerate: () => void
  /** Opens 从专利文字填写; absent when the host has no way to reach a model. */
  onFill?: () => void
  /** Opens the user guide on a page. */
  onHelp: (topic: GuideTopic) => void
}) {
  const { names, onDrawing, nested, linkers, siteOf } = variableNames(mol, variables, attachments)
  if (names.length === 0) return null
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-[#d0d0d0] bg-[#f7f7f7] text-[12px]" data-testid="variables-panel">
      <header className="flex items-center border-b border-[#e0e0e0] px-3 py-2 font-medium text-[#333]">
        通式变量
        <HelpLink onClick={() => onHelp("markush")} label="通式变量怎么用" />
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {names.map((name) => (
          <VariableRow
            key={name}
            name={name}
            variables={variables}
            onDrawing={onDrawing.includes(name)}
            nested={nested.has(name)}
            linker={linkers.has(name)}
            site={siteOf(name)}
            mol={mol}
            selected={selected}
            run={run}
            onHelp={onHelp}
          />
        ))}
        <ClosuresSection closures={ringClosures} variables={variables} run={run} />
        <ProvisosSection provisos={provisos} variables={variables} run={run} />
        {attachments && attachments.length > 0 && (
          <>
            <div className="border-b border-[#e0e0e0] bg-[#f0f0f0] px-3 py-1 text-[11px] text-[#777]">可变连接</div>
            {attachments.map((attachment) => (
              <AttachmentRow key={attachment.atom} attachment={attachment} mol={mol} run={run} />
            ))}
          </>
        )}
      </div>
      <footer className="space-y-1.5 border-t border-[#e0e0e0] p-2">
        <LibrarySizeLine mol={mol} variables={variables} attachments={attachments} ringClosures={ringClosures} />
        {onFill && (
          <Button size="sm" variant="outline" className="w-full" onClick={onFill}>
            从专利文字填写…
          </Button>
        )}
        <Button size="sm" className="w-full" disabled={!canEnumerate} onClick={onEnumerate}>
          批量生成化合物…
        </Button>
      </footer>
    </aside>
  )
}
