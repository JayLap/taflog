import { test } from "node:test"
import assert from "node:assert/strict"
import { configJson, renderConfig, renderSet } from "../../src/adapters/in/cli/present-config.ts"
import type { ResolvedConfig } from "../../src/domain/config.ts"

const view: ResolvedConfig = {
  version: { value: 1, source: "default" },
  dir: { value: "/data/taflog", source: "default" },
  weekStart: { value: "monday", source: "file" },
  maxTimerHours: { value: 8, source: "default" },
  color: { value: "auto", source: "default" },
  icons: { value: "nerd", source: "env" },
}

test("renderConfig prints every key with its source", () => {
  const output = renderConfig(view)
  assert.match(output, /^version\s+1\s+default$/m)
  assert.match(output, /^dir\s+\/data\/taflog\s+default$/m)
  assert.match(output, /^weekStart\s+monday\s+file$/m)
  assert.match(output, /^icons\s+nerd\s+env$/m)
})

test("renderConfig with a key prints just the value", () => {
  assert.equal(renderConfig(view, { key: "dir" }), "/data/taflog\n")
  assert.equal(renderConfig(view, { key: "maxTimerHours" }), "8\n")
})

test("configJson is the version-1 shape with sources", () => {
  const parsed = JSON.parse(configJson(view)) as {
    version: number
    config: Record<string, { value: unknown; source: string }>
  }
  assert.equal(parsed.version, 1)
  assert.deepEqual(parsed.config.icons, { value: "nerd", source: "env" })

  const single = JSON.parse(configJson(view, { key: "dir" }))
  assert.deepEqual(single, { version: 1, key: "dir", value: "/data/taflog", source: "default" })
})

test("renderSet confirms the written key", () => {
  assert.equal(renderSet({ key: "icons", value: "nerd" }), "icons = nerd\n")
})
