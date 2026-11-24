import type { Numbering } from "../numbering.ts"

const field = "h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) text-[12px] outline-none focus:border-(--c-1a73e8) disabled:bg-(--c-f0f0f0)"
const button = "h-6 rounded-sm border border-(--c-d0d0d0) bg-(--c-ffffff) px-2 text-[12px] text-(--c-333333) hover:bg-(--c-eef3fb)"

/**
 * How compounds are numbered, and where the numbers stand: the pattern and the first number
 * (written when the box is left, not on every key: each is a step of the document's history),
 * which compounds have no fixed number yet, and starting over.
 */
export function NumberingControls({
  numbering,
  onNumbering,
  taken,
  fresh,
  unstable,
  onPin,
  onRenumber,
}: {
  numbering: Numbering
  onNumbering: (numbering: Numbering) => void
  /** How many numbers the document has given out. */
  taken: number
  /** How many of the listed compounds have none yet. */
  fresh: number
  /** Whether compounds are told apart by their choices, not their structure. */
  unstable: boolean
  onPin: () => void
  onRenumber: () => void
}) {
  return (
    <>
      <label className="flex shrink-0 items-center gap-1" title="编号的写法：{n} 是编号所在的位置，如 C-{n} → C-1、C-2…；化合物{n}；1-{n}">
        编号
        <input
          key={numbering.pattern}
          className={`${field} w-20 px-1.5`}
          defaultValue={numbering.pattern}
          placeholder="C-{n}"
          onBlur={(event) => event.target.value !== numbering.pattern && onNumbering({ ...numbering, pattern: event.target.value })}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          aria-label="编号的写法"
        />
        从
        <input
          key={numbering.start}
          type="number"
          className={`${field} w-14 px-1`}
          defaultValue={numbering.start}
          disabled={taken > 0}
          title={taken > 0 ? "已经编过号的化合物保持原号；要从别的号开始，先“重新编号”" : "第一个化合物的编号"}
          onBlur={(event) => {
            const start = Math.trunc(Number(event.target.value))
            if (event.target.value === "" || !Number.isSafeInteger(start)) event.target.value = String(numbering.start)
            else if (start !== numbering.start) onNumbering({ ...numbering, start })
          }}
          onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()}
          aria-label="起始编号"
        />
      </label>
      {fresh > 0 && (
        <span className="flex shrink-0 items-center gap-1.5 text-(--c-8a5a00)" data-testid="numbers-fresh">
          {taken > 0 ? `${fresh} 个新化合物还没有固定编号` : "编号还没有固定"}
          <button type="button" className={button} onClick={onPin} title="把现在的编号写进文档，之后这些化合物永远是这个号；下载时也会自动固定">
            固定编号
          </button>
        </span>
      )}
      {fresh === 0 && taken > 0 && (
        <span className="shrink-0 text-(--c-666666)" data-testid="numbers-fixed">
          编号已固定（{taken} 个）
        </span>
      )}
      {taken > 0 && (
        <button type="button" className={button} onClick={onRenumber} title="丢掉已有的编号，按现在的顺序从头编；可以撤销">
          重新编号…
        </button>
      )}
      {unstable && (
        <span className="shrink-0 text-(--c-8a5a00)" title="没有去重，或没能载入 RDKit：按各变量的取值认化合物。改了候选项（如片段的名称、类别的范围）后，同一个化合物可能被当成新的。">
          编号按取值认化合物，可能不稳
        </span>
      )}
    </>
  )
}
