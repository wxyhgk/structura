/** A small "?" that opens the guide where it explains what it sits next to. */
export function HelpLink({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="ml-auto flex size-5 items-center justify-center rounded-full border border-[#c8c8c8] text-[11px] font-normal text-[#777] hover:border-[#1a73e8] hover:text-[#1a73e8]" onClick={onClick} title={label} aria-label={label}>
      ?
    </button>
  )
}
