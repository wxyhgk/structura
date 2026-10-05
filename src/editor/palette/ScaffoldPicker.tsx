import { useState } from "react"
import { matchScaffolds, scaffoldNamed, scaffolds } from "@structura/core/scaffolds"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MoleculeThumb } from "@/editor/common/MoleculeThumb"
import { useOverlayMark } from "@/editor/input/overlays"
import { defaultPick } from "@/editor/tools/scaffoldPick"
import type { ScaffoldPick } from "@/editor/tools/types"
import { ScaffoldSites } from "./ScaffoldSites.tsx"

/**
 * The template library: pick a ring system, then which of its atoms joins (or which bond
 * fuses), and take up the template tool with it.
 */
export function ScaffoldPicker({
  open,
  onOpenChange,
  current,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  current: ScaffoldPick
  onPick: (pick: ScaffoldPick) => void
}) {
  const overlayMark = useOverlayMark()
  const [pick, setPick] = useState<ScaffoldPick>(current)
  const [query, setQuery] = useState("")
  const shown = matchScaffolds(query)
  const groups = [...new Set(shown.map((item) => item.group))]
  const scaffold = scaffoldNamed(pick.name) ?? scaffolds()[0]

  const choose = (name: string) => setPick(defaultPick(name))
  const use = (chosen: ScaffoldPick) => {
    onPick(chosen)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...overlayMark}
        className="flex h-[78vh] flex-col gap-3 overflow-hidden sm:max-w-4xl"
        data-testid="scaffold-picker"
        onKeyDown={(event) => {
          // Enter takes the template as chosen, wherever the focus is (not mid-way through an IME word).
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault()
            use(pick)
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>模板分子</DialogTitle>
          <DialogDescription>选一个环系，在右边大图上点蓝色编号（接到原子上用哪个原子）和橙色字母（并到键上用哪条边），回车使用。画布上按 / 也能直接搜模板。</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-h-0 w-[56%] flex-col gap-2">
            <input
              className="h-8 rounded-md border border-[#d0d0d0] px-2 text-[13px] outline-none focus:border-[#1a73e8]"
              placeholder="搜索，如 咔唑、carbazole"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="搜索模板"
            />
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {groups.map((group) => (
                <section key={group} className="mb-3">
                  <h3 className="mb-1 text-[11px] font-medium text-[#888]">{group}</h3>
                  <div className="grid grid-cols-4 gap-1.5">
                    {shown
                      .filter((item) => item.group === group)
                      .map((item) => (
                        <button
                          key={item.name}
                          className={`flex flex-col items-center gap-0.5 rounded-md border p-1 text-[11px] ${item.name === scaffold.name ? "border-[#1a73e8] bg-[#e8f1fb]" : "border-transparent hover:bg-black/5"}`}
                          onClick={() => choose(item.name)}
                          onDoubleClick={() => use(defaultPick(item.name))}
                          data-testid={`scaffold-${item.name}`}
                        >
                          <MoleculeThumb mol={item.molecule} className="h-14 w-full object-contain" />
                          {item.zh}
                        </button>
                      ))}
                  </div>
                </section>
              ))}
              {shown.length === 0 && <p className="text-[12px] text-[#888]">没有找到。</p>}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2 border-l border-[#eee] pl-4">
            <div className="text-[15px] font-semibold">
              {scaffold.zh} <span className="text-[12px] font-normal text-[#888]">{scaffold.name}</span>
            </div>
            <div className="flex gap-3 text-[11px] text-[#666]">
              <span className="flex items-center gap-1">
                <span className="inline-block size-3 rounded-full border border-[#1a73e8]" />
                接到原子的位点
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block size-3 rounded-[2px] border border-[#e8710a]" />
                并到键的边
              </span>
            </div>
            <ScaffoldSites
              scaffold={scaffold}
              site={pick.site}
              edge={pick.edge}
              onSite={(site) => setPick({ ...pick, site })}
              onEdge={(edge) => setPick({ ...pick, edge })}
            />
            <ul className="space-y-0.5 text-[12px] leading-5 text-[#555]">
              <li>点画布空白处：放一个{scaffold.zh}</li>
              <li>
                点原子：用 <b>{pick.site}</b> 接上去
              </li>
              <li>
                点键：用 <b>{pick.edge}</b> 边并上去
              </li>
            </ul>
            <Button className="mt-auto" onClick={() => use(pick)} data-testid="scaffold-use">
              使用{scaffold.zh}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
