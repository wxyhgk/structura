/** Copy as image: an exported SVG put on the clipboard as a picture Word and PowerPoint paste. */

/** Three times the drawing's size, so the picture stays sharp when it is enlarged in a slide. */
const SCALE = 3

/** Draws SVG text onto an offscreen canvas at SCALE and returns it as PNG. */
export async function svgToPng(svg: string, scale = SCALE): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = Math.ceil(image.naturalWidth * scale)
    canvas.height = Math.ceil(image.naturalHeight * scale)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("浏览器无法绘制图片")
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("浏览器无法生成 PNG"))), "image/png"),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Puts the drawing on the clipboard as PNG, plus the SVG itself where the browser takes
 * both (Chromium 124+). The PNG is handed over as a promise, so the write starts while the
 * click or key press still counts as the user's.
 */
export async function writeImage(svg: string): Promise<void> {
  if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("这个浏览器不支持把图片放进剪贴板")
  }
  const items: Record<string, Promise<Blob>> = { "image/png": svgToPng(svg) }
  if (ClipboardItem.supports?.("image/svg+xml")) items["image/svg+xml"] = Promise.resolve(new Blob([svg], { type: "image/svg+xml" }))
  await navigator.clipboard.write([new ClipboardItem(items)])
}
