import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(new URL("../../dist/main.js", import.meta.url))

interface Run {
  stdout: string
  stderr: string
  status: number | null
}

/**
 * Run the real CLI against a hermetic config path. `TAFLOG_DIR`, `TAFLOG_ICONS`
 * and `NO_COLOR` are cleared unless the caller supplies them, so the host
 * environment never leaks into a test.
 */
function run(root: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): Run {
  const base: NodeJS.ProcessEnv = { ...process.env }
  delete base.TAFLOG_DIR
  delete base.TAFLOG_CONFIG
  delete base.TAFLOG_ICONS
  delete base.NO_COLOR
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    env: { ...base, TAFLOG_CONFIG: join(root, "config.json"), ...extraEnv },
  })
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status }
}

function withRoot<T>(fn: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), "taflog-config-e2e-"))
  try {
    return fn(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function readConfig(root: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(root, "config.json"), "utf8")) as Record<string, unknown>
}

test("config prints every effective value with its source", () => {
  withRoot((root) => {
    const result = run(root, ["config"])
    assert.equal(result.status, 0)
    assert.match(result.stdout, /^version\s+1\s+default$/m)
    assert.match(result.stdout, /^dir\s+.+\s+default$/m)
    assert.match(result.stdout, /^weekStart\s+monday\s+default$/m)
    assert.match(result.stdout, /^maxTimerHours\s+8\s+default$/m)
    assert.match(result.stdout, /^color\s+auto\s+default$/m)
    assert.match(result.stdout, /^icons\s+auto\s+default$/m)
    assert.equal(result.stderr, "")
  })
})

test("config <key> prints a single effective value", () => {
  withRoot((root) => {
    const result = run(root, ["config", "weekStart"])
    assert.equal(result.status, 0)
    assert.equal(result.stdout, "monday\n")
  })
})

test("config --json exposes values and sources", () => {
  withRoot((root) => {
    const parsed = JSON.parse(run(root, ["config", "--json"]).stdout) as {
      version: number
      config: Record<string, { value: unknown; source: string }>
    }
    assert.equal(parsed.version, 1)
    assert.deepEqual(parsed.config.weekStart, { value: "monday", source: "default" })
  })
})

test("set validates and merge-writes one key", () => {
  withRoot((root) => {
    assert.equal(run(root, ["set", "icons", "nerd"]).status, 0)
    assert.deepEqual(readConfig(root), { icons: "nerd" })

    assert.equal(run(root, ["set", "maxTimerHours", "6.5"]).status, 0)
    assert.deepEqual(readConfig(root), { icons: "nerd", maxTimerHours: 6.5 })

    assert.equal(run(root, ["config", "icons"]).stdout, "nerd\n")
    assert.match(run(root, ["config"]).stdout, /^icons\s+nerd\s+file$/m)
  })
})

test("dir from config relocates the Log", () => {
  withRoot((root) => {
    const dataDir = join(root, "relocated")
    assert.equal(run(root, ["set", "dir", dataDir]).status, 0)
    assert.equal(run(root, ["start", "acme"]).status, 0)
    assert.equal(existsSync(join(dataDir, "events.ndjson")), true)
  })
})

test("precedence is --dir > TAFLOG_DIR > config dir > default", () => {
  withRoot((root) => {
    const fileDir = join(root, "from-file")
    const envDir = join(root, "from-env")
    const flagDir = join(root, "from-flag")
    assert.equal(run(root, ["set", "dir", fileDir]).status, 0)

    assert.equal(run(root, ["start", "acme"], { TAFLOG_DIR: envDir }).status, 0)
    assert.equal(existsSync(join(envDir, "events.ndjson")), true)

    assert.equal(run(root, ["--dir", flagDir, "start", "beta"], { TAFLOG_DIR: envDir }).status, 0)
    assert.equal(existsSync(join(flagDir, "events.ndjson")), true)
    assert.equal(existsSync(join(fileDir, "events.ndjson")), false)
  })
})

test("TAFLOG_ICONS comes from the environment when the flag is absent", () => {
  withRoot((root) => {
    assert.equal(run(root, ["set", "icons", "ascii"]).status, 0)
    const env = run(root, ["config", "--json"], { TAFLOG_ICONS: "nerd" }).stdout
    assert.deepEqual((JSON.parse(env) as { config: Record<string, unknown> }).config.icons, {
      value: "nerd",
      source: "env",
    })
    const flag = run(root, ["--icons", "auto", "config", "--json"], { TAFLOG_ICONS: "nerd" }).stdout
    assert.deepEqual((JSON.parse(flag) as { config: Record<string, unknown> }).config.icons, {
      value: "auto",
      source: "flag",
    })
  })
})

test("an unknown key or invalid value is a usage error", () => {
  withRoot((root) => {
    assert.equal(run(root, ["set", "nope", "x"]).status, 2)
    assert.equal(run(root, ["set", "weekStart", "tuesday"]).status, 2)
    assert.equal(run(root, ["set", "maxTimerHours", "0"]).status, 2)
    assert.equal(run(root, ["set", "color", "rainbow"]).status, 2)
    assert.equal(run(root, ["config", "nope"]).status, 2)
    assert.equal(existsSync(join(root, "config.json")), false)
  })
})

test("maxTimerHours from config gates a forgotten Timer", () => {
  withRoot((root) => {
    const data = join(root, "data")
    assert.equal(run(root, ["set", "maxTimerHours", "1"]).status, 0)
    mkdirSync(data, { recursive: true })
    const at = new Date(Date.now() - 2 * 3_600_000).toISOString()
    appendFileSync(
      join(data, "events.ndjson"),
      `${JSON.stringify({ v: 1, id: "oldstart", t: "start", at, project: "acme" })}\n`,
    )

    const refused = run(root, ["stop"], { TAFLOG_DIR: data })
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /--force/)

    assert.equal(run(root, ["stop", "--force"], { TAFLOG_DIR: data }).status, 0)
  })
})

test("weekStart from config reaches the report range", () => {
  withRoot((root) => {
    assert.equal(run(root, ["set", "weekStart", "sunday"]).status, 0)
    const parsed = JSON.parse(
      run(root, ["report", "--json"], { TAFLOG_DIR: join(root, "data") }).stdout,
    ) as { range: { weekStart: string } }
    assert.equal(parsed.range.weekStart, "sunday")
  })
})

test("a malformed config file is a usage error", () => {
  withRoot((root) => {
    writeFileSync(join(root, "config.json"), "{not json")
    const result = run(root, ["config"])
    assert.equal(result.status, 2)
    assert.match(result.stderr, /invalid config JSON/)
  })
})
