import { GROUP_CLASSES } from "@structura/core/markush"

// The JSON schema Claude's answer is held to (structured outputs): every property required,
// nullable where "not stated" is a real answer, nothing extra.

const object = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})

const kind = (name: string) => ({ type: "string", enum: [name] })

const ALTERNATIVE = {
  anyOf: [
    object({ kind: kind("label"), text: { type: "string", description: "An element symbol or one of the listed abbreviations" } }),
    object({ kind: kind("bond") }),
    object({ kind: kind("bridge"), name: { type: "string", description: "One of the listed divalent rings" } }),
    object({
      kind: kind("class"),
      class: { type: "string", enum: Object.keys(GROUP_CLASSES) },
      min: { type: ["integer", "null"] },
      max: { type: ["integer", "null"] },
      substituted: { type: ["boolean", "null"] },
    }),
  ],
}

export const ANSWER_SCHEMA = object({
  variables: {
    type: "array",
    items: object({
      name: { type: "string" },
      source: { type: "string" },
      sameAs: { type: ["string", "null"] },
      alternatives: { type: "array", items: ALTERNATIVE },
      unrepresented: { type: "array", items: { type: "string" } },
    }),
  },
  notes: { type: "array", items: { type: "string" } },
})
