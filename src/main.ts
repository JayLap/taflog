#!/usr/bin/env node
import { join } from "node:path"
import type { ParsedArgs } from "./adapters/in/cli/args.ts"
import { parseArgs } from "./adapters/in/cli/args.ts"
import { promptForAdjustment, promptForTimer } from "./adapters/in/cli/prompt.ts"
import { runCli } from "./adapters/in/cli/run.ts"
import { SystemClock } from "./adapters/out/clock/system-clock.ts"
import {
  JsonConfigStore,
  resolveConfig,
  setConfigValue,
} from "./adapters/out/config/config.ts"
import type { PartialConfig } from "./domain/config.ts"
import { resolveConfigPath } from "./adapters/out/config/paths.ts"
import { JsonlEventLog } from "./adapters/out/store/jsonl-event-log.ts"
import { AddAdjustment, SubAdjustment } from "./application/adjustment.ts"
import { BuildReport } from "./application/build-report.ts"
import { CompleteStart } from "./application/complete-start.ts"
import { UsageError } from "./application/errors.ts"
import { ExportLog } from "./application/export-log.ts"
import { QueryLog } from "./application/query-log.ts"
import { RemoveEntry } from "./application/remove-entry.ts"
import { StartTask } from "./application/start-task.ts"
import { ShowStatus } from "./application/status.ts"
import { StopTask } from "./application/stop-task.ts"
import { SwitchTask } from "./application/switch-task.ts"
import { newId } from "./domain/identity.ts"
import { TaflogError } from "./domain/errors.ts"
import { version } from "./version.ts"

/**
 * Composition root (SPEC §3, ADR-0005): the only module that imports both the
 * driving adapter and the driven adapters, and wires them by hand. It also
 * resolves configuration before constructing anything that depends on it.
 */
async function main(): Promise<number> {
  let parsed: ParsedArgs
  try {
    parsed = parseArgs(process.argv.slice(2))
  } catch (error) {
    const message = error instanceof UsageError ? error.message : "invalid arguments"
    process.stderr.write(`taflog: ${message}\n`)
    process.stderr.write("Run `taflog --help` for usage.\n")
    return 2
  }

  const env = process.env
  const store = new JsonConfigStore(resolveConfigPath(env))

  // `--help`/`--version` must work even when the config file is unusable.
  const wantsHelp = parsed.options.help || parsed.options.version || parsed.command === "help"
  let file: PartialConfig = {}
  if (!wantsHelp) {
    try {
      file = await store.read()
    } catch (error) {
      return fail(error)
    }
  }

  const config = resolveConfig({
    file,
    flags: {
      dir: parsed.options.dir,
      weekStart: null,
      maxTimerHours: null,
      color: parsed.options.noColor ? "never" : null,
      icons: parsed.options.icons,
    },
    env,
  })

  const clock = new SystemClock()
  const log = new JsonlEventLog(join(config.dir.value, "events.ndjson"), {
    strict: parsed.options.strict,
  })
  const maxTimerHours = config.maxTimerHours.value
  const completeStart = new CompleteStart(log)

  const code = await runCli(parsed, {
    startTask: new StartTask(clock, log),
    stopTask: new StopTask(clock, log, newId, maxTimerHours),
    switchTask: new SwitchTask(clock, log, newId, maxTimerHours),
    showStatus: new ShowStatus(clock, log),
    addAdjustment: new AddAdjustment(clock, log),
    subAdjustment: new SubAdjustment(clock, log),
    removeEntry: new RemoveEntry(clock, log),
    queryLog: new QueryLog(clock, log),
    buildReport: new BuildReport(clock, log),
    exportLog: new ExportLog(log),
    timerPrompt: () =>
      promptForTimer({ completeStart, input: process.stdin, output: process.stdout }),
    adjustmentPrompt: () =>
      promptForAdjustment({ completeStart, input: process.stdin, output: process.stdout }),
    config,
    setConfig: (key, value) => setConfigValue(store, key, value),
    version: version(),
    stdout: (chunk) => process.stdout.write(chunk),
    stderr: (chunk) => process.stderr.write(chunk),
    env,
    isTTY: process.stdout.isTTY === true,
    isInputTTY: process.stdin.isTTY === true,
    columns: process.stdout.columns,
  })
  return code
}

/** Print a known `TaflogError` and return its exit code; rethrow anything else. */
function fail(error: unknown): number {
  if (error instanceof TaflogError) {
    process.stderr.write(`taflog: ${error.message}\n`)
    return error.exitCode
  }
  throw error
}

main().then(
  (code) => {
    // Assigning `exitCode` lets pending stdout drain, so `export` never
    // truncates a pipe (unlike `process.exit`).
    process.exitCode = code
  },
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`taflog: ${message}\n`)
    process.exitCode = 1
  },
)
