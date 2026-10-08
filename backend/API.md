# Structura backend: HTTP API

The backend keeps the user's own group templates in SQLite. It is single-user for now (no
accounts); the shapes are `Template`, `TemplateInput`, `TemplateLibrary` and `ImportReport`
from `@structura/core/markush` (`packages/core/src/markush/templates.ts`), and every template
is checked with `templateProblem` before it is stored. Built-in templates are not stored
here: they ship with the app (`builtinTemplates()` in `@structura/markush`).

All bodies are JSON (`Content-Type: application/json`, UTF-8). Errors are
`{ "error": "<message>" }` with status 400 (bad input), 404 (no such template), 413 (body
over 2 MB) or 500.

| Method | Path | Body | Answer |
|---|---|---|---|
| GET | `/api/health` | – | `200 { "ok": true, "templates": <count> }` |
| GET | `/api/templates` | – | `200 { "templates": Template[] }`, the user's, oldest first |
| POST | `/api/templates` | `TemplateInput` | `201 Template` (new id, `source: "user"`, both times now) |
| PUT | `/api/templates/:id` | `TemplateInput` | `200 Template` (`updatedAt` now, `createdAt` kept) |
| DELETE | `/api/templates/:id` | – | `204` |
| GET | `/api/templates/export` | – | `200 TemplateLibrary` with `Content-Disposition: attachment; filename="structura-templates.json"` |
| POST | `/api/templates/import` | `TemplateLibrary` | `200 ImportReport` |

Import: each template in the file is checked on its own (bad ones are listed in `problems`
and skipped, the rest still go in). A template whose id is already stored with the same
content is skipped; any other gets a new id and is added as the user's (`source: "user"`),
keeping its `createdAt`. Built-in ids (`builtin:…`) in a file are added as user copies.

Ids are UUIDs (`crypto.randomUUID()`). Times are ISO 8601 UTC.

Configuration (environment): `STRUCTURA_BACKEND_PORT` (default `25174`),
`STRUCTURA_BACKEND_HOST` (default `127.0.0.1`), `STRUCTURA_DB` (default
`backend/data/structura.db`; the folder is created, and git-ignored).

In development Vite proxies `/api/templates` and `/api/health` to the backend, so the app
calls same-origin paths.
