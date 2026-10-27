import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createStyle,
  resolveColor,
  sanitizeForTerminal,
  truncate,
} from "../../src/adapters/in/cli/style.ts"

test("the default Style is plain, auto-glyph, and untruncated", () => {
  const style = createStyle()
  assert.equal(style.icons, "auto")
  assert.equal(style.color, false)
  assert.equal(style.width, Number.POSITIVE_INFINITY)
  assert.equal(style.glyphs.running, "●")
  assert.equal(style.glyphs.idle, "○")
  assert.equal(style.project("acme"), "acme")
})

test("ascii and nerd profiles swap every glyph", () => {
  const ascii = createStyle({ icons: "ascii" })
  assert.equal(ascii.glyphs.running, "*")
  assert.equal(ascii.glyphs.idle, "o")
  assert.equal(ascii.glyphs.project, "-")
  assert.equal(ascii.signed(-1800), "-30m")

  const nerd = createStyle({ icons: "nerd" })
  assert.equal(nerd.glyphs.running, "󰔛")
  assert.equal(nerd.glyphs.idle, "󰅶")
  assert.equal(nerd.glyphs.project, "󰉋")
})

test("negative durations use the profile's minus glyph", () => {
  assert.equal(createStyle().duration(-1800), "−30m")
  assert.equal(createStyle({ icons: "ascii" }).duration(-1800), "-30m")
  assert.equal(createStyle({ icons: "nerd" }).duration(-1800), "󰍴30m")
  assert.equal(createStyle({ icons: "ascii" }).duration(1800), "30m")
})

test("colour wraps text only when enabled", () => {
  assert.doesNotMatch(createStyle().project("acme"), /\u001b\[/)
  assert.match(createStyle({ color: true }).project("acme"), /^\u001b\[36macme\u001b\[0m$/)
  assert.match(createStyle({ color: true }).running("live"), /^\u001b\[32mlive\u001b\[0m$/)
})

test("truncate never wraps and uses a single ellipsis", () => {
  assert.equal(truncate("short", 10), "short")
  assert.equal(truncate("abcdef", 4), "abc…")
  assert.equal(truncate("abcdef", 1), "…")
  assert.equal(truncate("abcdef", Number.POSITIVE_INFINITY), "abcdef")
})

test("resolveColor reduces the resolved policy against TTY presence", () => {
  assert.equal(resolveColor("auto", true), true)
  assert.equal(resolveColor("auto", false), false)
  assert.equal(resolveColor("always", false), true)
  assert.equal(resolveColor("never", true), false)
})

test("sanitizeForTerminal strips control and bidi characters", () => {
  assert.equal(sanitizeForTerminal("acme"), "acme")
  assert.equal(sanitizeForTerminal("ac\u001b[31mme"), "ac[31mme")
  assert.equal(sanitizeForTerminal("a\u0007b\u0000c\u007fd\u009be"), "abcde")
  assert.equal(sanitizeForTerminal("a\u202eb"), "ab")
  assert.equal(sanitizeForTerminal("a\u200fb"), "ab")
  assert.equal(sanitizeForTerminal("new parser"), "new parser")
})
