import { test } from "node:test"
import assert from "node:assert/strict"
import { parseArgs } from "../../src/adapters/in/cli/args.ts"
import { UsageError } from "../../src/application/errors.ts"

test("the first positional is the command; the rest are operands", () => {
  const parsed = parseArgs(["start", "acme", "new parser"])
  assert.equal(parsed.command, "start")
  assert.deepEqual(parsed.operands, ["acme", "new parser"])
})

test("global flags are accepted before or after the command", () => {
  const before = parseArgs(["--json", "status"])
  assert.equal(before.command, "status")
  assert.equal(before.options.json, true)

  const after = parseArgs(["status", "--json"])
  assert.equal(after.command, "status")
  assert.equal(after.options.json, true)
})

test("no arguments means no command (defaults to status)", () => {
  assert.equal(parseArgs([]).command, null)
})

test("--dir takes a value in both forms", () => {
  assert.equal(parseArgs(["--dir", "/tmp/x", "status"]).options.dir, "/tmp/x")
  assert.equal(parseArgs(["--dir=/tmp/x", "status"]).options.dir, "/tmp/x")
})

test("--icons validates its value", () => {
  assert.equal(parseArgs(["--icons", "nerd", "status"]).options.icons, "nerd")
  assert.equal(parseArgs(["--icons=ascii", "status"]).options.icons, "ascii")
  assert.throws(() => parseArgs(["--icons", "wat"]), UsageError)
})

test("--help, --version and --strict are booleans", () => {
  const parsed = parseArgs(["--help", "--version", "--strict", "status"])
  assert.equal(parsed.options.help, true)
  assert.equal(parsed.options.version, true)
  assert.equal(parsed.options.strict, true)
})

test("--force is a boolean accepted before or after the command", () => {
  assert.equal(parseArgs(["stop", "--force"]).options.force, true)
  assert.equal(parseArgs(["--force", "switch", "beta"]).options.force, true)
  assert.equal(parseArgs(["stop"]).options.force, false)
})

test("an unknown flag is a usage error", () => {
  assert.throws(() => parseArgs(["status", "--nope"]), UsageError)
})

test("--dir with no value is a usage error", () => {
  assert.throws(() => parseArgs(["status", "--dir"]), UsageError)
})

test("--date and --note take values in both forms", () => {
  assert.equal(parseArgs(["add", "acme", "30m", "--date", "today"]).options.date, "today")
  assert.equal(parseArgs(["add", "acme", "30m", "--date=yesterday"]).options.date, "yesterday")
  assert.equal(parseArgs(["add", "acme", "30m", "--note", "forgot"]).options.note, "forgot")
  assert.equal(parseArgs(["add", "acme", "30m", "--note=late"]).options.note, "late")
  assert.equal(parseArgs(["status"]).options.date, null)
  assert.equal(parseArgs(["status"]).options.note, null)
})

test("--date and --note with no value are usage errors", () => {
  assert.throws(() => parseArgs(["add", "acme", "30m", "--date"]), UsageError)
  assert.throws(() => parseArgs(["add", "acme", "30m", "--note"]), UsageError)
})
