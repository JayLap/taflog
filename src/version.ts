import { readFileSync } from "node:fs"

/**
 * Reads the package version. Works both from source (`src/version.ts`) and from
 * the compiled output (`dist/version.js`), because both sit one level under the
 * package root.
 */
export function version(): string {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string }
  return pkg.version
}
