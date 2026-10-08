import { useState } from "react"
import { alternativesOf, shareSources, sharers, type SiteKind } from "@structura/markush"
import type { Molecule, Variable } from "@structura/core/types"
import type { Run } from "@structura/engine"
import type { GuideTopic } from "@/guide"
import { ClassForm } from "../ClassForm.tsx"
import { variableEdits } from "../variableEdits.ts"
import { AddBar } from "./AddBar.tsx"
import { AlternativeChips } from "./AlternativeChips.tsx"
import { InlineSketch } from "./InlineSketch.tsx"

/** The inline sketch pad's target: a variable, and a new alternative or the drawn one at an index. */
export type SketchTarget = { name: string; index: number | "new" }

const SITE_LABELS: Record<SiteKind, { label: string; title: string }> = {
  end: { label: "末端", title: "接在一个原子上的取代基" },
  link: { label: "连接基", title: "夹在两个原子之间，两端各接一个" },
  ring: { label: "环内", title: "占住环里的一个位置，与环成两根键" },
}

/** One variable on the board: its alternatives as chips, and every way to add, share or change them. */
export function VariableCard({
  name,
  variables,
  onDrawing,
  nested,
  linker,
  site,
  mol,
  selected,
  colorHetero,
  run,
  onHelp,
  sketch,
  onSketch,
}: {
  name: string
  variables: Record<string, Variable> | undefined
  onDrawing: boolean
  /** A placeholder inside one of the variables' pieces (R5 in Ar = N–R5). */
  nested: boolean
  /** It sits between two atoms (like L), so it offers a bond and divalent rings. */
  linker: boolean
  site: SiteKind
  mol: Molecule
  selected: number[]
  colorHetero: boolean
  run: Run
  onHelp: (topic: GuideTopic) => void
  /** The alternative open in the inline sketch pad, if this card has it. */
  sketch: number | "new" | null
  onSketch: (index: number | "new" | null) => void
}) {
  const variable = variables?.[name]
  /** The variable whose list this one shares, if it shares one; its own list is then read-only. */
  const shared = variable && "sameAs" in variable ? variable.sameAs : null
  const sharedBy = sharers(variables, name)
  const sources = shareSources(variables, name)
  const alternatives = alternativesOf(variables, name)
  const edits = variableEdits(name, variables, run)
  /** The class form: adding a new class, or editing the one at this index. */
  const [classForm, setClassForm] = useState<"new" | number | null>(null)
  const sketched = typeof sketch === "number" ? alternatives[sketch] : undefined
  const siteLabel = SITE_LABELS[site]

  return (
    <section className={`rounded-md border bg-white ${sketch != null ? "border-[#9fc3ee] shadow-sm" : "border-[#d0d0d0]"}`} data-testid={`variable-${name}`}>
      <div className="flex items-center gap-2 border-b border-[#eeeeee] px-4 py-2.5">
        <span className="font-[Arial,Helvetica,sans-serif] text-[20px] leading-none font-semibold text-[#222]">{name}</span>
        <span className="rounded-sm border border-[#d6e4f7] bg-[#f1f6fd] px-1.5 py-px text-[11px] text-[#1a73e8]" title={siteLabel.title}>
          {siteLabel.label}
        </span>
        {!variable && <span className="rounded-sm bg-[#fff4e0] px-1.5 py-px text-[11px] text-[#b26a00]">未定义</span>}
        {!onDrawing && <span className="rounded-sm bg-[#f0f0f0] px-1.5 py-px text-[11px] text-[#777]">{nested ? "在片段里" : "图上没有"}</span>}
        {variable && !shared && <span className="text-[11px] text-[#888]">{alternatives.length} 个候选项</span>}
        <div className="ml-auto flex items-center gap-3">
          {sharedBy.length > 0 ? (
            <span className="text-[#666]">{sharedBy.join("、")} 与它相同</span>
          ) : (
            (shared || sources.length > 0) && (
              <select
                className="h-7 rounded-sm border border-[#d0d0d0] bg-white px-1 outline-none focus:border-[#1a73e8]"
                value={shared ?? ""}
                onChange={(event) => edits.share(event.target.value)}
                aria-label={`${name} 的候选项来源`}
              >
                <option value="">自己填写候选项</option>
                {sources.map((source) => (
                  <option key={source} value={source}>
                    与 {source} 相同
                  </option>
                ))}
              </select>
            )
          )}
          {variable && !shared && sharedBy.length === 0 && (
            <button className="text-[12px] text-[#888] hover:text-[#d1242f]" onClick={() => edits.save([])} aria-label={`删除 ${name}`}>
              清空
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        <AlternativeChips
          alternatives={alternatives}
          readOnly={shared != null}
          colorHetero={colorHetero}
          editing={classForm ?? sketch}
          onEditClass={(index) => {
            onSketch(null)
            setClassForm(index)
          }}
          onEditFragment={(index) => {
            setClassForm(null)
            onSketch(index)
          }}
          onRemove={(index) => edits.remove(index)}
        />

        {shared ? (
          <p className="text-[#888]">要修改，请到 {shared} 里改。</p>
        ) : sketch != null ? (
          <InlineSketch
            key={String(sketch)}
            name={name}
            kind={site}
            initial={sketched?.kind === "fragment" ? sketched : undefined}
            onSave={(piece, alsoAt) => {
              edits.saveSketch(sketch, piece, alsoAt)
              onSketch(null)
            }}
            onCancel={() => onSketch(null)}
          />
        ) : classForm != null ? (
          <ClassForm
            key={String(classForm)}
            initial={typeof classForm === "number" ? alternatives[classForm] : undefined}
            onSave={(item) => {
              if (typeof classForm === "number") edits.replace(classForm, item)
              else edits.add(item)
              setClassForm(null)
            }}
            onCancel={() => setClassForm(null)}
          />
        ) : (
          <AddBar
            name={name}
            linker={linker}
            empty={alternatives.length === 0}
            canCapture={selected.length > 0}
            edits={edits}
            onCapture={() => edits.capture(mol, selected)}
            onClass={() => setClassForm("new")}
            onSketch={() => onSketch("new")}
            onHelp={onHelp}
          />
        )}
      </div>
    </section>
  )
}
