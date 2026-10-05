// Each turn the model answers in one of these shapes (strict structured output), so the
// loop needs no tool calling from the model's API or a gateway in between.

/** A shape the model is asked to answer in: a name for the API and the JSON schema. */
export type Format = { name: string; schema: Record<string, unknown> }

/** The first turn: what the picture shows, in words, before anything is built. */
export const READING: Format = {
  name: "structure_reading",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["note", "name", "description"],
    properties: {
      note: { type: "string", description: "What you see, a few words of Chinese" },
      name: { type: "string", description: "A systematic name with locants (e.g. 9-phenyl-3-(dibenzofuran-4-yl)-9H-carbazole); for a generic formula, the core with its variables; empty if it cannot be named" },
      description: { type: "string", description: "Every ring system; every bond between them and every substituent, each with the IUPAC locant it sits on, worked out from the heteroatoms and fusion atoms in the picture; labels, charges, stereo, variables" },
    },
  },
}

/** Every later turn: one action. */
export const ACTION: Format = {
  name: "structure_action",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["note", "action", "ops"],
    properties: {
      note: { type: "string", description: "What you are doing now, a few words of Chinese" },
      action: { type: "string", enum: ["build", "look", "reset", "done"] },
      ops: { type: "string", description: "For build: a JSON array of ops; otherwise an empty string" },
    },
  },
}
