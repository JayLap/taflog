import { test } from "node:test"
import assert from "node:assert/strict"
import { parseArgs } from "../../src/adapters/in/cli/args.ts"
import { UsageError } from "../../src/application/errors.ts"

test("read-command presets are booleans", () => {
  const parsed = parseArgs(["log", "--today", "--week", "--month"])
  assert.equal(parsed.options.today, true)
  assert.equal(parsed.options.week, true)
  assert.equal(parsed.options.month, true)
})

test("--project, --from, and --to take values in both forms", () => {
  const parsed = parseArgs([
    "log",
    "--project",
    "acme",
    "--from=mon",
    "--to",
    "thu",
  ])
  assert.equal(parsed.options.project, "acme")
  assert.equal(parsed.options.from, "mon")
  assert.equal(parsed.options.to, "thu")
})

test("--limit parses a positive integer", () => {
  assert.equal(parseArgs(["log", "--limit", "10"]).options.limit, 10)
  assert.equal(parseArgs(["log", "--limit=3"]).options.limit, 3)
  assert.throws(() => parseArgs(["log", "--limit", "0"]), UsageError)
  assert.throws(() => parseArgs(["log", "--limit", "nope"]), UsageError)
})

test("--ids, --details, --pretty, and --seconds are booleans", () => {
  const parsed = parseArgs([
    "report",
    "--ids",
    "--details",
    "--pretty",
    "--seconds",
  ])
  assert.equal(parsed.options.ids, true)
  assert.equal(parsed.options.details, true)
  assert.equal(parsed.options.pretty, true)
  assert.equal(parsed.options.seconds, true)
})

test("--by validates project/day", () => {
  assert.equal(parseArgs(["report", "--by", "day"]).options.by, "day")
  assert.equal(parseArgs(["report", "--by=project"]).options.by, "project")
  assert.equal(parseArgs(["report"]).options.by, null)
  assert.throws(() => parseArgs(["report", "--by", "week"]), UsageError)
})

test("read-command flags with no value are usage errors", () => {
  assert.throws(() => parseArgs(["log", "--project"]), UsageError)
  assert.throws(() => parseArgs(["log", "--from"]), UsageError)
  assert.throws(() => parseArgs(["log", "--to"]), UsageError)
  assert.throws(() => parseArgs(["log", "--limit"]), UsageError)
  assert.throws(() => parseArgs(["report", "--by"]), UsageError)
})
