// Filling a generic formula's variables from patent text with Claude. This entry is safe
// for the browser (no SDK, no key): building the request, and checking the answer. The
// call itself is in "@structura/ai/server", which runs where the API key is.
export { requestFor } from "./request.ts"
export { fillOps, reviewAnswer } from "./review.ts"
export type { Review, ReviewedVariable } from "./review.ts"
export { FILL_PATH } from "./types.ts"
export type { AnswerAlternative, FillAnswer, FillRequest, FillResult } from "./types.ts"
