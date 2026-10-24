#!/usr/bin/env node
import { join } from "node:path"
import type { ParsedArgs } from "./adapters/in/cli/args.ts"
import { parseArgs } from "./adapters/in/cli/args.ts"
import { runCli } from "./adapters/in/cli/run.ts"
import { SystemClock } from "./adapters/out/clock/system-clock.ts"
import { JsonlEventLog } from "./adapters/out/store/jsonl-event-log.ts"
import { defaultDataDir } from "./adapters/out/store/paths.ts"
import { UsageError } from "./application/errors.ts"
import { StartTask } from "./application/start-task.ts"
import { ShowStatus } from "./application/status.ts"
import { StopTask } from "./application/stop-task.ts"
import { version } from "./version.ts"

/**
 * Composition root (SPEC §3, ADR-0005): the only module that imports both the
 * driving adapter and the driven adapters, and wires them by hand.
 */
async function main(): Promise<void> {
  let parsed: ParsedArgs
  try {
    parsed = parseArgs(process.argv.slice(2))
  } catch (error) {
    const message = error instanceof UsageError ? error.message : "invalid arguments"
    process.stderr.write(`taflog: ${message}\n`)
    process.stderr.write("Run `taflog --help` for usage.\n")
    process.exit(2)
  }

  const dir = parsed.options.dir ?? process.env.TAFLOG_DIR ?? defaultDataDir()
  const clock = new SystemClock()
  const log = new JsonlEventLog(join(dir, "events.ndjson"), { strict: parsed.options.strict })

  const code = await runCli(parsed, {
    startTask: new StartTask(clock, log),
    stopTask: new StopTask(clock, log),
    showStatus: new ShowStatus(clock, log),
    version: version(),
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
  })
  process.exit(code)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  process.stderr.write(`taflog: ${message}\n`)
  process.exit(1)
})
