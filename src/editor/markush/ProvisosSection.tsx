import { useState } from "react"
import { alternativesOf } from "@structura/markush"
import type { Alternative, Proviso, Variable } from "@structura/core/types"
import type { Run } from "@structura/engine"
import { Button } from "@/components/ui/button"
import { describeAlternative, provisoText } from "./describe.ts"

const FIELD = "h-6 rounded-sm border border-[#d0d0d0] bg-white px-1 text-[12px] outline-none focus:border-[#1a73e8]"

/**
 * The claim's provisos under the variables: what is listed, removing one, and adding an
 * excluded combination ("when R1 is H, R2 is not H") or an excluded compound (SMILES).
 */
export function ProvisosSection({ provisos, variables, run, heading = true }: { provisos: Proviso[] | undefined; variables: Record<string, Variable> | undefined; run: Run; /** Whether to show its own grey heading (off where a tab already names it). */ heading?: boolean }) {
  const names = Object.keys(variables ?? {})
  const [adding, setAdding] = useState<"combination" | "compound" | null>(null)
  /** The combination being written: each condition a variable and the values it excludes (by index in its list). */
  const [conditions, setConditions] = useState<Array<{ name: string; picked: number[] }>>([])
  const [smiles, setSmiles] = useState("")
  const [problem, setProblem] = useState<string | null>(null)
  if (names.length === 0) return null

  const valuesOf = (name: string): Alternative[] => alternativesOf(variables, name)
  function add(proviso: Proviso) {
    if (!run([{ op: "add_proviso", proviso }], { keepSelection: true })) return setProblem("这条条件用不了")
    setProblem(null)
    setAdding(null)
    setConditions([])
    setSmiles("")
  }
  const complete = conditions.length > 0 && conditions.every((condition) => condition.picked.length > 0)

  return (
    <div data-testid="provisos">
      {heading && <div className="border-b border-[#e0e0e0] bg-[#f0f0f0] px-3 py-1 text-[11px] text-[#777]">附加条件</div>}
      <div className="space-y-1 px-3 py-2">
        {(provisos ?? []).map((proviso, index) => (
          <div key={index} className="flex items-start gap-1 text-[12px] text-[#333]" data-testid="proviso">
            <span className="flex-1">{provisoText(proviso)}</span>
            <button type="button" className="text-[#999] hover:text-[#d1242f]" aria-label="删除这条条件" onClick={() => run([{ op: "remove_proviso", index }], { keepSelection: true })}>
              ×
            </button>
          </div>
        ))}
        {adding === null && (
          <div className="flex gap-3 text-[11px]">
            <button
              type="button"
              className="text-[#1a73e8] hover:underline"
              onClick={() => {
                setAdding("combination")
                setConditions([{ name: names[0], picked: [] }])
              }}
            >
              + 排除一种组合
            </button>
            <button type="button" className="text-[#1a73e8] hover:underline" onClick={() => setAdding("compound")}>
              + 排除一个化合物
            </button>
          </div>
        )}
        {adding === "combination" && (
          <div className="space-y-1.5 rounded-sm border border-[#e0e0e0] bg-white p-2 text-[12px]">
            {conditions.map((condition, at) => (
              <div key={at} className="space-y-1">
                <div className="flex items-center gap-1">
                  {at > 0 && <span className="text-[#888]">且</span>}
                  <select
                    className={FIELD}
                    value={condition.name}
                    aria-label="条件里的变量"
                    onChange={(event) => setConditions(conditions.map((item, index) => (index === at ? { name: event.target.value, picked: [] } : item)))}
                  >
                    {names.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[#888]">取</span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 pl-1">
                  {valuesOf(condition.name).map((value, index) => (
                    <label key={index} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={condition.picked.includes(index)}
                        onChange={(event) =>
                          setConditions(
                            conditions.map((item, place) =>
                              place === at ? { ...item, picked: event.target.checked ? [...item.picked, index] : item.picked.filter((picked) => picked !== index) } : item,
                            ),
                          )
                        }
                      />
                      {describeAlternative(value)}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              {conditions.length < names.length && (
                <button
                  type="button"
                  className="text-[11px] text-[#1a73e8] hover:underline"
                  onClick={() => setConditions([...conditions, { name: names.find((name) => !conditions.some((item) => item.name === name)) ?? names[0], picked: [] }])}
                >
                  + 再加一个变量
                </button>
              )}
              <span className="flex-1" />
              <Button
                size="sm"
                className="h-6"
                disabled={!complete}
                onClick={() => add({ kind: "combination", when: conditions.map((condition) => ({ name: condition.name, is: condition.picked.map((index) => valuesOf(condition.name)[index]) })) })}
              >
                添加
              </Button>
              <Button size="sm" variant="ghost" className="h-6" onClick={() => setAdding(null)}>
                取消
              </Button>
            </div>
          </div>
        )}
        {adding === "compound" && (
          <div className="flex items-center gap-1 text-[12px]">
            <input className={`${FIELD} flex-1`} placeholder="要排除的化合物的 SMILES" value={smiles} onChange={(event) => setSmiles(event.target.value)} aria-label="排除的化合物" />
            <Button size="sm" className="h-6" disabled={!smiles.trim()} onClick={() => add({ kind: "compound", smiles: smiles.trim() })}>
              添加
            </Button>
            <Button size="sm" variant="ghost" className="h-6" onClick={() => setAdding(null)}>
              取消
            </Button>
          </div>
        )}
        {problem && <p className="text-[11px] text-[#d1242f]">{problem}</p>}
      </div>
    </div>
  )
}
