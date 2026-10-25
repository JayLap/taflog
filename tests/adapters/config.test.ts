import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  CONFIG_KEYS,
  JsonConfigStore,
  parseCliValue,
  parseConfigFile,
  resolveConfig,
  setConfigValue,
} from "../../src/adapters/out/config/config.ts"
import { ConfigError } from "../../src/adapters/out/config/errors.ts"
import {
  defaultConfigFile,
  resolveConfigPath,
} from "../../src/adapters/out/config/paths.ts"

function withTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "taflog-config-"))
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }))
}

test("parseConfigFile accepts every key and returns them typed", () => {
  assert.deepEqual(
    parseConfigFile({
      version: 1,
      dir: "/logs",
      weekStart: "sunday",
      maxTimerHours: 6.5,
      color: "never",
      icons: "nerd",
    }),
    { version: 1, dir: "/logs", weekStart: "sunday", maxTimerHours: 6.5, color: "never", icons: "nerd" },
  )
  assert.deepEqual(parseConfigFile({}), {})
})

test("parseConfigFile rejects unknown keys and invalid values", () => {
  assert.throws(() => parseConfigFile({ nope: true }), ConfigError)
  assert.throws(() => parseConfigFile({ weekStart: "tuesday" }), ConfigError)
  assert.throws(() => parseConfigFile({ maxTimerHours: 0 }), ConfigError)
  assert.throws(() => parseConfigFile({ maxTimerHours: -1 }), ConfigError)
  assert.throws(() => parseConfigFile({ maxTimerHours: "8" }), ConfigError)
  assert.throws(() => parseConfigFile({ color: "rainbow" }), ConfigError)
  assert.throws(() => parseConfigFile({ icons: "wat" }), ConfigError)
  assert.throws(() => parseConfigFile({ dir: "  " }), ConfigError)
  assert.throws(() => parseConfigFile({ version: 2 }), ConfigError)
  assert.throws(() => parseConfigFile([]), ConfigError)
  assert.throws(() => parseConfigFile(null), ConfigError)
})

test("resolveConfig defaults every key from an empty file", () => {
  const resolved = resolveConfig({ env: { XDG_DATA_HOME: "/data" }, platform: "linux" })
  assert.deepEqual(Object.keys(resolved).sort(), [...CONFIG_KEYS].sort())
  assert.deepEqual(resolved.version, { value: 1, source: "default" })
  assert.deepEqual(resolved.dir, { value: join("/data", "taflog"), source: "default" })
  assert.deepEqual(resolved.weekStart, { value: "monday", source: "default" })
  assert.deepEqual(resolved.maxTimerHours, { value: 8, source: "default" })
  assert.deepEqual(resolved.color, { value: "auto", source: "default" })
  assert.deepEqual(resolved.icons, { value: "auto", source: "default" })
})

test("dir precedence is flag > env > file > default", () => {
  const file = { dir: "/file" }
  const env = { TAFLOG_DIR: "/env", XDG_DATA_HOME: "/data" }
  assert.deepEqual(resolveConfig({ file, env, flags: { dir: "/flag" }, platform: "linux" }).dir, {
    value: "/flag",
    source: "flag",
  })
  assert.deepEqual(resolveConfig({ file, env, platform: "linux" }).dir, {
    value: "/env",
    source: "env",
  })
  assert.deepEqual(resolveConfig({ file, env: { XDG_DATA_HOME: "/data" }, platform: "linux" }).dir, {
    value: "/file",
    source: "file",
  })
  assert.deepEqual(resolveConfig({ env: { XDG_DATA_HOME: "/data" }, platform: "linux" }).dir, {
    value: join("/data", "taflog"),
    source: "default",
  })
})

test("icons precedence is flag > env > file > default", () => {
  const file = { icons: "auto" as const }
  const env = { TAFLOG_ICONS: "nerd" }
  assert.deepEqual(resolveConfig({ file, env, flags: { icons: "ascii" } }).icons, {
    value: "ascii",
    source: "flag",
  })
  assert.deepEqual(resolveConfig({ file, env }).icons, { value: "nerd", source: "env" })
  assert.deepEqual(resolveConfig({ file }).icons, { value: "auto", source: "file" })
  assert.deepEqual(resolveConfig({}).icons, { value: "auto", source: "default" })
})

test("color precedence is --no-color > NO_COLOR > file > default", () => {
  const file = { color: "never" as const }
  const env = { NO_COLOR: "1" }
  assert.deepEqual(resolveConfig({ file, env, flags: { color: "never" } }).color, {
    value: "never",
    source: "flag",
  })
  assert.deepEqual(resolveConfig({ file, env }).color, { value: "never", source: "env" })
  assert.deepEqual(resolveConfig({ file }).color, { value: "never", source: "file" })
  assert.deepEqual(resolveConfig({}).color, { value: "auto", source: "default" })
})

test("version, weekStart, and maxTimerHours come from the file or the default", () => {
  assert.deepEqual(resolveConfig({ file: { version: 1 } }).version, { value: 1, source: "file" })
  const resolved = resolveConfig({ file: { weekStart: "sunday", maxTimerHours: 12 } })
  assert.deepEqual(resolved.weekStart, { value: "sunday", source: "file" })
  assert.deepEqual(resolved.maxTimerHours, { value: 12, source: "file" })
  assert.deepEqual(resolveConfig({}).weekStart, { value: "monday", source: "default" })
  assert.deepEqual(resolveConfig({}).maxTimerHours, { value: 8, source: "default" })
})

test("an invalid TAFLOG_ICONS falls back like an absent variable", () => {
  assert.deepEqual(resolveConfig({ env: { TAFLOG_ICONS: "wat" } }).icons, {
    value: "auto",
    source: "default",
  })
  assert.deepEqual(resolveConfig({ file: { icons: "nerd" }, env: { TAFLOG_ICONS: "wat" } }).icons, {
    value: "nerd",
    source: "file",
  })
})

test("parseCliValue validates strings for set", () => {
  assert.equal(parseCliValue("version", "1"), 1)
  assert.equal(parseCliValue("dir", "/logs"), "/logs")
  assert.equal(parseCliValue("weekStart", "sunday"), "sunday")
  assert.equal(parseCliValue("maxTimerHours", "6.5"), 6.5)
  assert.equal(parseCliValue("color", "always"), "always")
  assert.equal(parseCliValue("icons", "nerd"), "nerd")
  assert.throws(() => parseCliValue("version", "2"), ConfigError)
  assert.throws(() => parseCliValue("dir", "  "), ConfigError)
  assert.throws(() => parseCliValue("weekStart", "tuesday"), ConfigError)
  assert.throws(() => parseCliValue("maxTimerHours", "nope"), ConfigError)
  assert.throws(() => parseCliValue("maxTimerHours", "0"), ConfigError)
  assert.throws(() => parseCliValue("color", "rainbow"), ConfigError)
  assert.throws(() => parseCliValue("icons", "wat"), ConfigError)
})

test("resolveConfigPath prefers TAFLOG_CONFIG and falls back per-OS", () => {
  assert.equal(resolveConfigPath({ TAFLOG_CONFIG: "/tmp/custom.json" }), "/tmp/custom.json")
  assert.equal(
    resolveConfigPath({ APPDATA: "C:\\Users\\me\\AppData\\Roaming" }, "win32"),
    join("C:\\Users\\me\\AppData\\Roaming", "taflog", "config.json"),
  )
  assert.equal(
    defaultConfigFile({ XDG_CONFIG_HOME: "/cfg" }, "linux"),
    join("/cfg", "taflog", "config.json"),
  )
  assert.match(defaultConfigFile({}, "darwin"), /taflog[\\/]config\.json$/)
})

test("JsonConfigStore reads a missing file as empty and round-trips writes", async () => {
  await withTempDir(async (dir) => {
    const store = new JsonConfigStore(join(dir, "config.json"))
    assert.deepEqual(await store.read(), {})

    await store.write({ dir: "/logs", maxTimerHours: 6 })
    assert.deepEqual(await store.read(), { dir: "/logs", maxTimerHours: 6 })

    const raw = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"))
    assert.deepEqual(raw, { dir: "/logs", maxTimerHours: 6 })
  })
})

test("JsonConfigStore rejects unknown keys and malformed JSON", async () => {
  await withTempDir(async (dir) => {
    const file = join(dir, "config.json")
    const store = new JsonConfigStore(file)

    writeFileSync(file, JSON.stringify({ nope: 1 }))
    await assert.rejects(() => store.read(), ConfigError)

    writeFileSync(file, "{not json")
    await assert.rejects(() => store.read(), ConfigError)
  })
})

test("setConfigValue validates, merges, and persists one key at a time", async () => {
  await withTempDir(async (dir) => {
    const store = new JsonConfigStore(join(dir, "config.json"))
    assert.deepEqual(await setConfigValue(store, "dir", "/logs"), { key: "dir", value: "/logs" })
    assert.deepEqual(await setConfigValue(store, "icons", "nerd"), { key: "icons", value: "nerd" })
    assert.deepEqual(await store.read(), { dir: "/logs", icons: "nerd" })

    await assert.rejects(() => setConfigValue(store, "nope", "x"), ConfigError)
    await assert.rejects(() => setConfigValue(store, "weekStart", "tuesday"), ConfigError)
    assert.deepEqual(await store.read(), { dir: "/logs", icons: "nerd" })
  })
})
