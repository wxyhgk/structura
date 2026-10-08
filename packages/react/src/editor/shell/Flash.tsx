export function Flash({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="pointer-events-none absolute bottom-10 left-1/2 z-50 -translate-x-1/2 rounded-md bg-[#222]/90 px-3 py-1.5 text-[12px] text-white shadow" role="status" data-testid="flash">
      {message}
    </div>
  )
}
