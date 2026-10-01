let measureContext: CanvasRenderingContext2D | null | undefined

export function measureText(text: string, size: number): number {
  if (measureContext === undefined && typeof document !== "undefined") {
    measureContext = document.createElement("canvas").getContext("2d")
  }
  if (measureContext) {
    measureContext.font = `${size}px Arial, Helvetica, sans-serif`
    return measureContext.measureText(text).width
  }
  return text.length * size * 0.58
}
