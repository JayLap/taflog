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
    env: { ...process.env, TAFLOG_DIR: dir, TAFLOG_CONFIG: join(dir, "config.json"), ...extraEnv },
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

function seedWeek(dir: string): void {
  const at = (day: number, hour: number, minute = 0): string =>
    new Date(2025, 9, day, hour, minute).toISOString()
  const events = [
    { v: 1, id: "a0000001", t: "start", at: at(20, 9), project: "acme", description: "new parser" },
    { v: 1, id: "a0000002", t: "stop", at: at(20, 10), entry: "a0000001" },
    { v: 1, id: "b0000001", t: "start", at: at(20, 9), project: "beta", description: "emails" },
    { v: 1, id: "b0000002", t: "stop", at: at(20, 9, 30), entry: "b0000001" },
    { v: 1, id: "a0000003", t: "start", at: at(21, 9), project: "acme", description: "new parser" },
    { v: 1, id: "a0000004", t: "stop", at: at(21, 10, 30), entry: "a0000003" },
    {
      v: 1,
      id: "c0000001",
      t: "adjust",
      at: at(21, 12),
      date: "2025-10-21",
      project: "acme",
      delta: -1800,
      note: "forgot to start",
    },
  ]
  appendFileSync(
    join(dir, "events.ndjson"),
    `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
  )
}

const weekArgs = ["--from", "2025-10-20", "--to", "2025-10-26"]

test("log lists Entries and Adjustments and reconciles totals", () => {
  withTempDir((dir) => {
    seedWeek(dir)
    const result = run(dir, ["log", ...weekArgs])
    assert.equal(result.status, 0)
    assert.match(result.stdout, /new parser/)
    assert.match(result.stdout, /adjustment · forgot to start/)
    assert.match(result.stdout, /2h30m/) // 1h + 1h30m timed + 0.5h adjustment = 3h
    assert.equal(result.stderr, "")
  })
})

test("log --json is the frozen version-1 shape", () => {
  withTempDir((dir) => {
    seedWeek(dir)
    const parsed = JSON.parse(run(dir, ["log", ...weekArgs, "--json"]).stdout)
    assert.equal(parsed.version, 1)
    assert.deepEqual(parsed.query, { from: "2025-10-20", to: "2025-10-26", project: null })
    assert.equal(parsed.entries.length, 4)
    assert.equal(parsed.entries[0].kind, "timed")
    assert.equal(parsed.entries[0].durationSeconds, 3600)
    assert.equal(parsed.entries[3].kind, "adjust")
    assert.equal(parsed.entries[3].note, "forgot to start")
    assert.equal(parsed.totals.timedSeconds, 10800)
    assert.equal(parsed.totals.adjustedSeconds, -1800)
    assert.equal(parsed.totals.totalSeconds, 9000)
  })
})

test("log --project filters case-insensitively", () => {
  withTempDir((dir) => {
    seedWeek(dir)
    const parsed = JSON.parse(run(dir, ["log", ...weekArgs, "--project", "ACME", "--json"]).stdout)
    assert.equal(parsed.query.project, "ACME")
    assert.equal(parsed.entries.every((entry: { project: string }) => entry.project === "acme"), true)
  })
})

test("log --limit keeps the most recent rows", () => {
  withTempDir((dir) => {
    seedWeek(dir)
    const parsed = JSON.parse(run(dir, ["log", ...weekArgs, "--limit", "1", "--json"]).stdout)
    assert.equal(parsed.entries.length, 1)
    assert.equal(parsed.entries[0].kind, "adjust")
  })
})

test("report --json always contains byProject and byDay", () => {
  withTempDir((dir) => {
    seedWeek(dir)
    const parsed = JSON.parse(run(dir, ["report", ...weekArgs, "--json"]).stdout)
    assert.equal(parsed.version, 1)
    assert.deepEqual(parsed.range, { from: "2025-10-20", to: "2025-10-26", weekStart: "monday" })
    assert.deepEqual(parsed.byProject.map((project: { project: string }) => project.project), [
      "acme",
      "beta",
    ])
    assert.equal(parsed.byProject[0].timedSeconds, 9000)
    assert.equal(parsed.byProject[0].adjustedSeconds, -1800)
    assert.equal(parsed.byProject[0].totalSeconds, 7200)
    assert.equal(parsed.byDay.length, 7)
  })
})

test("report --by day and --details render grids", () => {
  withTempDir((dir) => {
    seedWeek(dir)
    const grid = run(dir, ["report", ...weekArgs, "--by", "day"])
    assert.equal(grid.status, 0)
    assert.match(grid.stdout, /Total/)
    assert.match(grid.stdout, /2h00/)
    assert.match(grid.stdout, /0h30/)

    const details = run(dir, ["report", ...weekArgs, "--details"])
    assert.equal(details.status, 0)
    assert.match(details.stdout, /new parser/)
    assert.match(details.stdout, /adjustments/)
  })
})

test("export is the exact raw Log and round-trips through a JSONL parser", () => {
  withTempDir((dir) => {
    seedWeek(dir)
    const raw = readFileSync(join(dir, "events.ndjson"), "utf8")
    const exported = run(dir, ["export"])
    assert.equal(exported.status, 0)
    assert.equal(exported.stdout, raw)

    const parsed = exported.stdout
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { v: number; t: string })
    assert.equal(parsed.length, 7)
    assert.equal(parsed.every((event) => event.v === 1), true)
  })
})

test("invalid read filters are usage errors", () => {
  withTempDir((dir) => {
    assert.equal(run(dir, ["log", "--limit", "0"]).status, 2)
    assert.equal(run(dir, ["report", "--by", "week"]).status, 2)
    assert.equal(run(dir, ["log", "--today", "--week"]).status, 2)
    assert.equal(run(dir, ["report", "--from", "nope"]).status, 2)
  })
})
