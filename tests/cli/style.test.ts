import { test } from "node:test"
import assert from "node:assert/strict"
import {
  createStyle,
  resolveColor,
  resolveIcons,
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

test("resolveIcons follows flag > env > auto", () => {
  assert.equal(resolveIcons("nerd", { TAFLOG_ICONS: "ascii" }), "nerd")
  assert.equal(resolveIcons(null, { TAFLOG_ICONS: "ascii" }), "ascii")
  assert.equal(resolveIcons(null, { TAFLOG_ICONS: "wat" }), "auto")
  assert.equal(resolveIcons(null, {}), "auto")
})

test("resolveColor follows --no-color, NO_COLOR, and TTY", () => {
  assert.equal(resolveColor(false, {}, true), true)
  assert.equal(resolveColor(false, {}, false), false)
  assert.equal(resolveColor(true, {}, true), false)
  assert.equal(resolveColor(false, { NO_COLOR: "1" }, true), false)
  assert.equal(resolveColor(false, { NO_COLOR: "" }, true), false)
})
