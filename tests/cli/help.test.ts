import { test } from "node:test"
import assert from "node:assert/strict"
import { USAGE } from "../../src/adapters/in/cli/run.ts"

/**
 * The README, docs/SPEC.md §8, and `--help` must agree. These tests pin the
 * command and flag surface so a drift fails the build.
 */
const COMMANDS = [
  "start",
  "stop",
  "switch",
  "status",
  "log",
  "report",
  "add",
  "sub",
  "rm",
  "config",
  "set",
  "export",
  "help",
] as const

const FLAGS = [
  "--dir",
  "--json",
  "--pretty",
  "--no-color",
  "--icons",
  "--strict",
  "--force",
  "--seconds",
  "-h",
  "--help",
  "-V",
  "--version",
] as const

test("usage lists every SPEC §8.1 command", () => {
  for (const command of COMMANDS) {
    assert.ok(USAGE.includes(`taflog ${command}`), `usage is missing \`taflog ${command}\``)
  }
})

test("usage lists every global flag from SPEC §8.2", () => {
  for (const flag of FLAGS) {
    assert.ok(USAGE.includes(flag), `usage is missing \`${flag}\``)
  }
})

test("usage points at the project docs", () => {
  for (const doc of ["README.md", "docs/SPEC.md", "docs/GLOSSARY.md"]) {
    assert.ok(USAGE.includes(doc), `usage is missing ${doc}`)
  }
})
