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
  reportStep: { value: 900, source: "file" },
  dayTargets: {
    sunday: { value: null, source: "default" },
    monday: { value: 27000, source: "default" },
    tuesday: { value: 27000, source: "default" },
    wednesday: { value: 27000, source: "default" },
    thursday: { value: 27000, source: "default" },
    friday: { value: 19800, source: "file" },
    saturday: { value: null, source: "default" },
  },
}

test("renderConfig prints every key with its source", () => {
  const output = renderConfig(view)
  assert.match(output, /^version\s+1\s+default$/m)
  assert.match(output, /^dir\s+\/data\/taflog\s+default$/m)
  assert.match(output, /^weekStart\s+monday\s+file$/m)
  assert.match(output, /^icons\s+nerd\s+env$/m)
})

test("renderConfig shows durations as typed and off for no target", () => {
  const output = renderConfig(view)
  assert.match(output, /^reportStep\s+15m\s+file$/m)
  assert.match(output, /^dayTargets\.monday\s+7h30m\s+default$/m)
  assert.match(output, /^dayTargets\.friday\s+5h30m\s+file$/m)
  assert.match(output, /^dayTargets\.saturday\s+off\s+default$/m)
  assert.equal(renderConfig(view, { key: "dayTargets.friday" }), "5h30m\n")
})

test("configJson reports durations in seconds and off as null", () => {
  const single = JSON.parse(configJson(view, { key: "dayTargets.monday" }))
  assert.deepEqual(single, { version: 1, key: "dayTargets.monday", value: 27000, source: "default" })
  const off = JSON.parse(configJson(view, { key: "dayTargets.sunday" }))
  assert.equal(off.value, null)
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

test("renderConfig strips control sequences from values but JSON keeps them raw", () => {
  const dirty: ResolvedConfig = {
    ...view,
    dir: { value: "/data/\u001b[31mtaflog", source: "file" },
  }
  assert.equal(renderConfig(dirty, { key: "dir" }), "/data/[31mtaflog\n")
  assert.doesNotMatch(renderConfig(dirty), /\u001b/)
  assert.equal(
    (JSON.parse(configJson(dirty)) as { config: { dir: { value: string } } }).config.dir.value,
    "/data/\u001b[31mtaflog",
  )
})
