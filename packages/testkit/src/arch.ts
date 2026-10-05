import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

// Architecture tests: which files import what. Every form counts: import and export ...
// from, side-effect imports, dynamic import(), with either quote.

/** Every .ts and .tsx file under `dir`. */
export function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? sources(path) : /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

/** import/export ... from "x" (over several lines too), import "x", and import("x"). */
const FORMS = [
  /^\s*(?:import|export)\b[^;"']*?\bfrom\s*(["'])([^"'\n]+)\1/gm,
  /^\s*import\s*(["'])([^"'\n]+)\1/gm,
  /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g,
]

/** What a file imports, in every form. */
export function importsOf(file: string): string[] {
  const text = readFileSync(file, "utf8")
  return FORMS.flatMap((form) => [...text.matchAll(form)].map((match) => match[2]))
}

/** Imports under `dir` that `allowed` refuses, as "file: specifier" lines (empty when all is well). */
export function forbiddenImports(dir: string, allowed: (spec: string) => boolean): string[] {
  return sources(dir).flatMap((file) => importsOf(file).filter((spec) => !allowed(spec)).map((spec) => `${relative(dir, file)}: ${spec}`))
}
