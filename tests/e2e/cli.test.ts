import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(new URL("../../dist/main.js", import.meta.url))

interface Run {
  stdout: string
  stderr: string
  status: number | null
}

function run(dir: string, args: string[], extraEnv: NodeJS.ProcessEnv = {}): Run {
  const result = spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    env: { ...process.env, TAFLOG_DIR: dir, ...extraEnv },
  })
  return { stdout: result.stdout ?? "", stderr: result.stderr ?? "", status: result.status }
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "taflog-e2e-"))
  try {
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** Seed an open Entry that started `hours` ago, as if the Timer were forgotten. */
function seedForgottenStart(dir: string, hours: number): void {
  const at = new Date(Date.now() - hours * 3_600_000).toISOString()
  appendFileSync(
    join(dir, "events.ndjson"),
    `${JSON.stringify({ v: 1, id: "oldstart", t: "start", at, project: "acme" })}\n`,
  )
}

test("a running Timer persists across process invocations", () => {
  withTempDir((dir) => {
    const started = run(dir, ["start", "acme", "writing tests"])
    assert.equal(started.status, 0)

    const status = run(dir, ["status", "--json"])
    assert.equal(status.status, 0)
    const parsed = JSON.parse(status.stdout)
    assert.equal(parsed.version, 1)
    assert.equal(parsed.running.project, "acme")
    assert.equal(parsed.running.description, "writing tests")
    assert.ok(parsed.running.elapsedSeconds >= 0)

    const logFile = join(dir, "events.ndjson")
    const lines = readFileSync(logFile, "utf8").trim().split("\n")
    assert.equal(lines.length, 1)

    const stopped = run(dir, ["stop"])
    assert.equal(stopped.status, 0)

    const after = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(after.running, null)
    assert.equal(after.today.timedSeconds >= 0, true)
  })
})

test("--dir overrides TAFLOG_DIR", () => {
  withTempDir((dir) => {
    const other = join(dir, "elsewhere")
    const envDir = join(dir, "from-env")
    const result = run(envDir, ["--dir", other, "start", "acme"])
    assert.equal(result.status, 0)
    assert.equal(existsSync(join(other, "events.ndjson")), true)
    assert.equal(existsSync(join(envDir, "events.ndjson")), false)
  })
})

test("corrupt lines are skipped with a warning", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["start", "acme"]).status, 0)
    appendFileSync(join(dir, "events.ndjson"), "{not json\n")

    const result = run(dir, ["status"])
    assert.equal(result.status, 0)
    assert.match(result.stderr, /warning: skipped 1 unreadable line/)
    assert.match(result.stdout, /acme/)
  })
})

test("--strict fails on corrupt lines", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["start", "acme"]).status, 0)
    appendFileSync(join(dir, "events.ndjson"), "{not json\n")

    const result = run(dir, ["--strict", "status"])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /skipped 1 unreadable line/)
  })
})

test("start while running reports a runtime error", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["start", "acme"]).status, 0)
    const second = run(dir, ["start", "beta"])
    assert.equal(second.status, 1)
    assert.match(second.stderr, /already tracking "acme"/)
  })
})

test("stop while idle reports a runtime error", () => {
  withTempDir((dir) => {
    const result = run(dir, ["stop"])
    assert.equal(result.status, 1)
    assert.match(result.stderr, /nothing is running/)
  })
})

test("switch closes the running Timer and starts the next", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["start", "acme", "draft"]).status, 0)
    const switched = run(dir, ["switch", "beta", "emails"])
    assert.equal(switched.status, 0)

    const status = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(status.running.project, "beta")
    assert.equal(status.running.description, "emails")

    const events = readFileSync(join(dir, "events.ndjson"), "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { t: string; id: string; from?: string })
    assert.equal(events.length, 2)
    assert.equal(events[1]?.t, "switch")
    assert.equal(events[1]?.from, events[0]?.id)
  })
})

test("switch while idle opens a Timer", () => {
  withTempDir((dir) => {
    const result = run(dir, ["switch", "beta"])
    assert.equal(result.status, 0)
    const status = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(status.running.project, "beta")

    const events = readFileSync(join(dir, "events.ndjson"), "utf8").trim().split("\n")
    assert.equal(events.length, 1)
    assert.equal((JSON.parse(events[0]!) as { t: string }).t, "start")
  })
})

test("stop refuses to close a forgotten Timer without --force", () => {
  withTempDir((dir) => {
    seedForgottenStart(dir, 9)
    const refused = run(dir, ["stop"])
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /--force/)

    const forced = run(dir, ["stop", "--force"])
    assert.equal(forced.status, 0)
  })
})

test("switch refuses to close a forgotten Timer without --force", () => {
  withTempDir((dir) => {
    seedForgottenStart(dir, 9)
    const refused = run(dir, ["switch", "beta"])
    assert.equal(refused.status, 1)
    assert.match(refused.stderr, /--force/)

    const forced = run(dir, ["switch", "--force", "beta"])
    assert.equal(forced.status, 0)
    const status = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(status.running.project, "beta")
  })
})

test("an unknown command is a usage error", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["frobnicate"]).status, 2)
  })
})

function readEvents(dir: string): Array<Record<string, unknown>> {
  return readFileSync(join(dir, "events.ndjson"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

test("add writes a positive Adjustment counted toward today", () => {
  withTempDir((dir) => {
    const added = run(dir, ["add", "acme", "90m", "--note", "forgot to start"])
    assert.equal(added.status, 0)
    assert.match(added.stdout, /\+1h30m acme/)

    const events = readEvents(dir)
    assert.equal(events.length, 1)
    assert.equal(events[0]?.t, "adjust")
    assert.equal(events[0]?.delta, 5400)
    assert.equal(events[0]?.note, "forgot to start")

    const status = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(status.today.adjustedSeconds, 5400)
    assert.equal(status.today.totalSeconds, 5400)
  })
})

test("sub writes a negative Adjustment for the same duration", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["sub", "beta", "30m"]).status, 0)
    const status = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(status.today.adjustedSeconds, -1800)
    assert.equal(status.today.totalSeconds, -1800)
  })
})

test("add records an explicit --date", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["start", "acme", "writing tests"]).status, 0)
    assert.equal(run(dir, ["stop"]).status, 0)
    const added = run(dir, ["add", "acme", "15m", "--date", "yesterday"])
    assert.equal(added.status, 0)

    const events = readEvents(dir)
    const adjust = events.find((event) => event.t === "adjust")
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`
    assert.equal(adjust?.date, expected)
  })
})

test("a bad duration or date is a usage error", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["add", "acme", "nope"]).status, 2)
    assert.equal(run(dir, ["add", "acme", "30m", "--date", "nope"]).status, 2)
    assert.equal(existsSync(join(dir, "events.ndjson")), false)
  })
})

test("rm by id tombstones an Adjustment", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["add", "acme", "90m"]).status, 0)
    const id = readEvents(dir)[0]?.id as string
    const removed = run(dir, ["rm", id])
    assert.equal(removed.status, 0)
    assert.match(removed.stdout, /removed adjustment/)

    const status = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(status.today.adjustedSeconds, 0)
  })
})

test("rm resolves an unambiguous prefix", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["add", "acme", "90m"]).status, 0)
    const id = readEvents(dir)[0]?.id as string
    assert.equal(run(dir, ["rm", id.slice(0, 4)]).status, 0)
    assert.equal(JSON.parse(run(dir, ["status", "--json"]).stdout).today.adjustedSeconds, 0)
  })
})

test("bare rm removes the most recent Entry or Adjustment", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["add", "acme", "90m"]).status, 0)
    assert.equal(run(dir, ["add", "beta", "30m"]).status, 0)
    assert.equal(run(dir, ["rm"]).status, 0)

    const status = JSON.parse(run(dir, ["status", "--json"]).stdout)
    assert.equal(status.today.adjustedSeconds, 5400)
  })
})

test("rm refuses to remove the running Timer", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["start", "acme"]).status, 0)
    const id = readEvents(dir)[0]?.id as string
    const removed = run(dir, ["rm", id])
    assert.equal(removed.status, 1)
    assert.match(removed.stderr, /that entry is running/)
  })
})

test("rm with an unknown id is a runtime error", () => {
  withTempDir((dir) => {
    const removed = run(dir, ["rm", "zzzzzzzz"])
    assert.equal(removed.status, 1)
    assert.match(removed.stderr, /no entry or adjustment matches/)
  })
})
