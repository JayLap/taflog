import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(new URL("../dist/main.js", import.meta.url))

function run(...args: string[]): { stdout: string; status: number } {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" })
    return { stdout, status: 0 }
  } catch (err) {
    const e = err as { stdout?: string; status?: number }
    return { stdout: e.stdout ?? "", status: e.status ?? 1 }
  }
}

test("--help prints usage", () => {
  const { stdout, status } = run("--help")
  assert.equal(status, 0)
  assert.match(stdout, /Usage:/)
  assert.match(stdout, /taflog start/)
})

test("--version prints the package version", () => {
  const { stdout, status } = run("--version")
  assert.equal(status, 0)
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+/)
})

test("a command is a usage error until Phase 1", () => {
  const { status } = run("status")
  assert.equal(status, 2)
})
