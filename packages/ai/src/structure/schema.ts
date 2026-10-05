// Each turn the model answers with one action, held to this schema (strict structured
// output), so the loop needs no tool calling from the model's API or a gateway in between.
export const ACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["note", "action", "ops"],
  properties: {
    note: { type: "string", description: "What you are doing now, a few words of Chinese" },
    action: { type: "string", enum: ["build", "look", "reset", "done"] },
    ops: { type: "string", description: "For build: a JSON array of ops; otherwise an empty string" },
  },
}
