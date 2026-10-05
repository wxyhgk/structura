/**
 * The first whole JSON object in a model's text. Some models (or gateways) send it twice, or
 * add a word after it; the first complete object is the answer.
 */
export function firstObject(text: string): unknown {
  const start = text.indexOf("{")
  if (start < 0) throw new Error(`no JSON object in the answer: ${text.slice(0, 120)}`)
  let depth = 0
  let inString = false
  for (let at = start; at < text.length; at++) {
    const char = text[at]
    if (inString) {
      if (char === "\\") at++
      else if (char === '"') inString = false
    } else if (char === '"') inString = true
    else if (char === "{") depth++
    else if (char === "}" && --depth === 0) return JSON.parse(text.slice(start, at + 1))
  }
  throw new Error(`the JSON object in the answer is cut short: ${text.slice(start, start + 120)}`)
}
