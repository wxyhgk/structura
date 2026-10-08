/** The longest side a picture is sent at: plenty for a structure, and keeps the request small. */
const MOST_PIXELS = 1600

/** A picture file as a PNG data URL, scaled down if it is very large. */
export async function pictureFrom(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MOST_PIXELS / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const context = canvas.getContext("2d")!
  context.fillStyle = "#fff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL("image/png")
}

/** The first picture among pasted or dropped files, if any. */
export function firstPicture(files: FileList | null | undefined): File | null {
  return [...(files ?? [])].find((file) => file.type.startsWith("image/")) ?? null
}
