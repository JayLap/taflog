import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Phase 6 DoD: `npm pack` → `npm install -g` into a temp prefix → run the
 * installed `taflog`. `--ignore-scripts` keeps the test from rebuilding `dist/`
 * while the rest of the suite is reading it; `prepare` is exercised by `pretest`
 * and by a real release.
 */
const root = fileURLToPath(new URL("../..", import.meta.url))

/**
 * Invoke npm portably. Under `npm test`, `npm_execpath` points at npm's JS
 * entry so it can run through `node` without a shell; outside npm, fall back to
 * the platform launcher.
 */
function npmRun(args: string[], cwd = root): string {
  const npmCli = process.env.npm_execpath
  const command = npmCli === undefined ? (process.platform === "win32" ? "npm.cmd" : "npm") : process.execPath
  const argv = npmCli === undefined ? args : [npmCli, ...args]
  const result = spawnSync(command, argv, {
    cwd,
    encoding: "utf8",
    shell: npmCli === undefined && process.platform === "win32",
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`npm ${args.join(" ")} failed (${result.status}):\n${result.stderr}`)
  }
  return result.stdout ?? ""
}

test("the packed tarball installs globally and the installed CLI runs", { timeout: 240_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "taflog-pack-"))
  try {
    const packDir = join(dir, "pack")
    const prefix = join(dir, "prefix")
    const data = join(dir, "data")
    mkdirSync(packDir)
    mkdirSync(data, { recursive: true })

    const packed = JSON.parse(
      npmRun(["pack", "--json", "--ignore-scripts", "--pack-destination", packDir]),
    ) as Array<{ filename: string; version: string; files: Array<{ path: string }> }>
    const info = packed[0]!
    assert.equal(info.version, "0.1.0")

    const paths = info.files.map((file) => file.path)
    assert.ok(paths.includes("dist/main.js"), "tarball ships the CLI entry point")
    assert.ok(paths.includes("package.json"), "tarball ships package.json")
    assert.ok(paths.every((path) => !path.startsWith("src/")), "tarball excludes src/")
    assert.ok(paths.every((path) => !path.startsWith("tests/")), "tarball excludes tests/")

    const tarball = join(packDir, info.filename)
    assert.ok(existsSync(tarball))

    npmRun(["install", "-g", tarball, "--ignore-scripts", "--prefix", prefix])

    const installed = join(prefix, "node_modules", "taflog", "dist", "main.js")
    assert.ok(existsSync(installed), "global install places dist/main.js under the prefix")
    assert.ok(
      readdirSync(prefix).some((entry) => entry.startsWith("taflog")),
      "global install creates a bin shim in the prefix",
    )

    const run = (args: string[]) =>
      spawnSync(process.execPath, [installed, ...args], {
        encoding: "utf8",
        env: {
          ...process.env,
          TAFLOG_DIR: data,
          TAFLOG_CONFIG: join(dir, "config.json"),
          NO_COLOR: "1",
        },
      })

    const started = run(["start", "acme", "pack smoke"])
    assert.equal(started.status, 0, started.stderr)
    assert.equal(run(["status"]).status, 0)
    assert.equal(run(["stop"]).status, 0)
    const report = run(["report", "--today"])
    assert.equal(report.status, 0, report.stderr)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
