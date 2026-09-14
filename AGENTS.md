<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

## Adding a new component (board, sensor, driver, etc.)

Components are data, not code. To add one:

1. Add `data/components/<type>.json`, matching `schema/component-definition.schema.json`: `type` (snake_case, must equal the filename), `label`, `category` (one of the schema's enum values), optional `description`, and a `pins` array (`name` required and unique per file, `label`/`group` optional).
2. Do not register it anywhere else — `lib/components/registry.ts` loads every file under `data/components/*.json` at runtime via `readdirSync`, so the MCP server's `list_component_types` and diagram validation see it automatically.
3. Run `npm test`. `__tests__/component-definitions.test.ts` auto-discovers every `data/components/*.json` file and checks schema conformance, that `type` matches the filename, unique pin names, and unique `type` across all files — a new file is validated with no test changes needed.

See `data/components/esp32.json` (or another board of the same kind) for a template.

<!-- END:nextjs-agent-rules -->
