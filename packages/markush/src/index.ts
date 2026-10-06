// Generic (Markush) formulas: expanding them into compounds, reading alternatives from text,
// and what the editor asks about variables and sites. The model itself (what makes a
// variable, attachment or drawn piece valid) is core's and is re-exported here, so the
// rest of the app imports generic-formula code from this one place.
export * from "@structura/core/markush"
export { choiceText, enumerate, enumerateSteps, pickFields } from "./enumerate.ts"
export type { EnumerateOptions, Enumeration, Pick } from "./enumerate.ts"
export { librarySize } from "./count.ts"
export type { LibrarySize } from "./count.ts"
export { alternativesFromText } from "./parse.ts"
export { placeholders, shareSources, undefinedVariables, variableLabels } from "./queries.ts"
export { REPRESENTATIVES, representativesOf } from "./representatives.ts"
export { linkerNames, siteKind } from "./sites.ts"
export type { SiteKind } from "./sites.ts"
