import { Button } from "@/components/ui/button"
import { alternativesOf, linkerNames, nestedVariables, variableLabels } from "@structura/core/markush"
import type { Attachment, Molecule, Variable } from "@structura/core/types"
import type { Run } from "@/editor/ops"
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
  run,
  canEnumerate,
  onEnumerate,
  onFill,
}: {
  mol: Molecule
  /** The selected atoms, which a variable can take in as a drawn piece. */
  selected: number[]
  variables: Record<string, Variable> | undefined
  attachments: Attachment[] | undefined
  run: Run
  canEnumerate: boolean
  onEnumerate: () => void
  /** Opens 从专利文字填写; absent when the host has no way to reach a model. */
  onFill?: () => void
}) {
  const onDrawing = variableLabels(mol)
  const defined = Object.keys(variables ?? {})
  /** Placeholders inside the variables' pieces (R5 in Ar = N–R5), which need defining too. */
  const nested = new Set(defined.flatMap((name) => nestedVariables(variables, name)))
  const pieces = defined.flatMap((name) => alternativesOf(variables, name).flatMap((item) => (item.kind === "fragment" ? [item.molecule] : [])))
  const linkers = new Set([mol, ...pieces].flatMap((molecule) => [...linkerNames({ molecule, arrows: [], nextArrowId: 0, attachments: molecule === mol ? attachments : undefined })]))
  const names = [...new Set([...onDrawing, ...defined, ...nested])]
  if (names.length === 0) return null
  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-[#d0d0d0] bg-[#f7f7f7] text-[12px]" data-testid="variables-panel">
      <header className="border-b border-[#e0e0e0] px-3 py-2 font-medium text-[#333]">通式变量</header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {names.map((name) => (
          <VariableRow
            key={name}
            name={name}
            variables={variables}
            onDrawing={onDrawing.includes(name)}
            nested={nested.has(name)}
            linker={linkers.has(name)}
            mol={mol}
            selected={selected}
            run={run}
          />
        ))}
      </div>
      <footer className="space-y-1.5 border-t border-[#e0e0e0] p-2">
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
