import { useState } from "react"
import type { Drawing } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { repeatSkipText } from "../describe.ts"
import { LibrarySizeLine } from "../LibrarySizeLine.tsx"
import type { FormulaFacts } from "./formulaFacts.ts"
import { widerSystem } from "./widerSystem.ts"

type Warning = { id: string; text: string; detail: string }

/**
 * The formula at a glance: how many combinations it makes, how many variables are defined,
 * and what still needs attention, each warning a chip that says which variables it means.
 */
export function OverviewTab({ drawing, facts, run }: { drawing: Drawing; facts: FormulaFacts; run: Run }) {
  const [shown, setShown] = useState<string | null>(null)
  const mol = drawing.molecule
  const warnings: Warning[] = [
    ...(facts.undefinedNames.length > 0
      ? [{ id: "undefined", text: `${facts.undefinedNames.length} 个变量未定义`, detail: `${facts.undefinedNames.join("、")} 还没有候选项，在右侧变量里添加。` }]
      : []),
    ...(facts.unused.length > 0 ? [{ id: "unused", text: `${facts.unused.length} 个变量不在结构上`, detail: `${facts.unused.join("、")} 定义了，但结构上没有用到，生成时不参与。` }] : []),
    ...(facts.skippedRepeats.length > 0
      ? [{ id: "repeats", text: `${facts.skippedRepeats.length} 个重复单元展不开`, detail: facts.skippedRepeats.map(repeatSkipText).join("") }]
      : []),
  ]
  const widenable = (drawing.attachments ?? []).flatMap((attachment) => {
    const system = widerSystem(mol, attachment)
    return system ? [{ attachment, system, name: mol.atoms.find((atom) => atom.id === attachment.atom)?.alias ?? `#${attachment.atom}` }] : []
  })
  const detail = warnings.find((warning) => warning.id === shown)?.detail

  return (
    <div className="space-y-2 px-3 py-2.5 text-[12px] text-[#333]" data-testid="constraints-overview">
      <div>
        <LibrarySizeLine drawing={drawing} />
        {facts.defined.length === 0 && facts.repeats.length === 0 && <span className="text-[#888]">还没有定义任何变量的候选项</span>}
      </div>
      <div className="flex items-center gap-3 text-[#555]" data-testid="variable-counts">
        <span>
          变量 <b className="font-medium text-[#222]">{facts.names.length}</b> 个
        </span>
        <span className="text-[#ccc]">|</span>
        <span>
          已定义 <b className="font-medium text-[#1e7e34]">{facts.defined.length}</b>
        </span>
        <span>
          未定义 <b className={`font-medium ${facts.undefinedNames.length > 0 ? "text-[#c5221f]" : "text-[#222]"}`}>{facts.undefinedNames.length}</b>
        </span>
        {facts.repeats.length > 0 && (
          <>
            <span className="text-[#ccc]">|</span>
            <span data-testid="repeat-counts">
              重复单元 <b className="font-medium text-[#222]">{facts.repeats.length}</b> 个（<i>{facts.repeats.join("，")}</i>）
            </span>
          </>
        )}
      </div>
      {warnings.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {warnings.map((warning) => (
            <button
              key={warning.id}
              type="button"
              aria-pressed={shown === warning.id}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${shown === warning.id ? "border-[#e8a33d] bg-[#fdf1dc] text-[#8a5300]" : "border-[#f0d6a8] bg-[#fff8ec] text-[#8a5300] hover:bg-[#fdf1dc]"}`}
              onClick={() => setShown(shown === warning.id ? null : warning.id)}
            >
              ⚠ {warning.text}
            </button>
          ))}
        </div>
      ) : (
        facts.names.length > 0 && <div className="text-[11px] text-[#1e7e34]">✓ 每个变量都有候选项</div>
      )}
      {detail && <p className="text-[11px] text-[#8a5300]">{detail}</p>}
      {widenable.map(({ attachment, system, name }) => (
        <button
          key={attachment.atom}
          type="button"
          className="block text-[11px] text-[#1a73e8] hover:underline"
          onClick={() =>
            run([{ op: "set_attachment", atom: attachment.atom, to: system, ...(attachment.repeat ? { repeat: attachment.repeat } : {}), ...(attachment.shape ? { shape: attachment.shape } : {}) }], {
              keepSelection: true,
            })
          }
        >
          {name}：扩大到整个稠环体系（{system.length} 个位置）
        </button>
      ))}
    </div>
  )
}
