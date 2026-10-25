import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const cli = fileURLToPath(new URL("../dist/main.js", import.meta.url))

function run(...args: string[]): { stdout: string; status: number } {
  const dir = mkdtempSync(join(tmpdir(), "taflog-main-"))
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      encoding: "utf8",
      env: { ...process.env, TAFLOG_DIR: dir, TAFLOG_CONFIG: join(dir, "config.json") },
    })
    return { stdout, status: 0 }
  } catch (err) {
    const e = err as { stdout?: string; status?: number }
    return { stdout: e.stdout ?? "", status: e.status ?? 1 }
  } finally {
    rmSync(dir, { recursive: true, force: true })
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

test("an unknown command is a usage error", () => {
  assert.equal(run("frobnicate").status, 2)
})
