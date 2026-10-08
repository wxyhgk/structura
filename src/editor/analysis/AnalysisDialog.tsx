import type { ReactNode } from "react"
import { displayFormula } from "@structura/core/formula"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useOverlayMark } from "@/editor/input/overlays"
import type { Report } from "./report.ts"

/** One value with a copy button: what it is, how it shows, and the plain text copied. */
function Row({ name, children, text, onCopy }: { name: string; children: ReactNode; text: string; onCopy: (text: string, what: string) => void }) {
  return (
    <div className="flex items-center gap-2 border-b border-[#f0f0f0] py-1 text-[13px]">
      <span className="w-24 shrink-0 text-[#777]">{name}</span>
      <span className="flex-1 font-[Arial,Helvetica,sans-serif]">{children}</span>
      <button type="button" className="text-[11px] text-[#1a73e8] hover:underline" onClick={() => onCopy(text, name)}>
        复制
      </button>
    </div>
  )
}

/**
 * The numbers for an experimental section, for the selection or a molecule: formula,
 * weight, exact mass, the usual ions, the elemental analysis, and both as SI lines.
 */
export function AnalysisDialog({ report, onOpenChange, onCopy }: { report: Report | null; onOpenChange: (open: boolean) => void; onCopy: (text: string, what: string) => void }) {
  const overlayMark = useOverlayMark()
  return (
    <Dialog open={report != null} onOpenChange={onOpenChange}>
      <DialogContent {...overlayMark} className="sm:max-w-lg" data-testid="analysis">
        <DialogHeader>
          <DialogTitle>分析</DialogTitle>
          <DialogDescription>选中的部分，或右键点到的那个分子。</DialogDescription>
        </DialogHeader>
        {report && (
          <div>
            <Row name="分子式" text={report.formula} onCopy={onCopy}>
              {displayFormula(report.formula)}
              {report.charge !== 0 && <sup>{report.charge > 0 ? `${report.charge === 1 ? "" : report.charge}+` : `${report.charge === -1 ? "" : -report.charge}−`}</sup>}
            </Row>
            <Row name="分子量" text={report.weight.toFixed(2)} onCopy={onCopy}>
              {report.weight.toFixed(2)}
            </Row>
            {report.exact != null && (
              <Row name="精确质量" text={report.exact.toFixed(4)} onCopy={onCopy}>
                {report.exact.toFixed(4)}
              </Row>
            )}
            {report.ions.map((ion) => (
              <Row key={ion.name} name={`m/z ${ion.name}`} text={ion.mz.toFixed(4)} onCopy={onCopy}>
                {ion.mz.toFixed(4)} <span className="text-[#888]">（{displayFormula(ion.formula)}）</span>
              </Row>
            ))}
            {report.analysis.length > 0 && (
              <Row name="元素分析" text={report.analysis.map(({ symbol, percent }) => `${symbol} ${percent.toFixed(2)}%`).join(", ")} onCopy={onCopy}>
                {report.analysis.map(({ symbol, percent }) => `${symbol} ${percent.toFixed(2)}%`).join("，")}
              </Row>
            )}
            {report.hrmsLine && (
              <Row name="HRMS 写法" text={report.hrmsLine} onCopy={onCopy}>
                <span className="text-[12px]">{report.hrmsLine}</span>
              </Row>
            )}
            {report.analysisLine && (
              <Row name="元素分析写法" text={report.analysisLine} onCopy={onCopy}>
                <span className="text-[12px]">{report.analysisLine}</span>
              </Row>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
