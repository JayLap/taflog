import type { AddAdjustment, SubAdjustment } from "../../../application/adjustment.ts"
import type { BuildReport } from "../../../application/build-report.ts"
import type { ExportLog } from "../../../application/export-log.ts"
import type { QueryLog } from "../../../application/query-log.ts"
import type { RemoveEntry } from "../../../application/remove-entry.ts"
import type { StartTask } from "../../../application/start-task.ts"
import type { ShowStatus } from "../../../application/status.ts"
import type { StopTask } from "../../../application/stop-task.ts"
import type { SwitchTask } from "../../../application/switch-task.ts"
import { UsageError } from "../../../application/errors.ts"
import type { WeekStart } from "../../../domain/datetime.ts"
import { TaflogError } from "../../../domain/errors.ts"
import type { ParsedArgs } from "./args.ts"
import {
  configJson,
  CONFIG_ORDER,
  renderConfig,
  renderSet,
  type ConfigView,
} from "./present-config.ts"
import {
  renderAdjusted,
  renderRemoved,
  renderStarted,
  renderStatus,
  renderStopped,
  renderSwitched,
  statusJson,
} from "./present.ts"
import { logJson, renderLog } from "./present-log.ts"
import { renderReport, reportJson } from "./present-report.ts"
import { createStyle, resolveColor, resolveIcons } from "./style.ts"

/** Everything the CLI needs, injected by the composition root (ADR-0005). */
export interface CliDeps {
  startTask: StartTask
  stopTask: StopTask
  switchTask: SwitchTask
  showStatus: ShowStatus
  addAdjustment: AddAdjustment
  subAdjustment: SubAdjustment
  removeEntry: RemoveEntry
  queryLog: QueryLog
  buildReport: BuildReport
  exportLog: ExportLog
  /** Effective configuration plus its sources; `config` renders it (SPEC §7). */
  config: ConfigView
  /** Validate and merge-write one config key; throws on bad input (SPEC §7). */
  setConfig: (key: string, value: string) => Promise<{ key: string; value: string | number }>
  version: string
  stdout: (chunk: string) => void
  stderr: (chunk: string) => void
  /** Presentation environment; defaults keep tests terminal-free. */
  env?: NodeJS.ProcessEnv
  isTTY?: boolean
  columns?: number
}

export const USAGE = `taflog — minimalist CLI time tracker

Usage:
  taflog start <project> [description]
  taflog stop [description]
  taflog switch <project> [description]
  taflog status
  taflog log [filters]
  taflog report [filters]
  taflog add <project> <duration> [--date D] [--note N]
  taflog sub <project> <duration> [--date D] [--note N]
  taflog rm [<id>]
  taflog config [<key>]
  taflog set <key> <value>
  taflog export

Filters:
  --today, --week, --month    preset window (log defaults to today; report to this week)
  --project <p>               case-insensitive Project filter
  --from <date> --to <date>   explicit window
  --limit <n>                 newest entries (log)
  --by <project|day>          report grouping
  --details                   add Description sub-rows to the report grid
  --ids                       show Entry/Adjustment identities (log)
  --seconds                   show seconds alongside rendered durations

Global flags:
  --dir <path>              data directory
  --json                    machine-readable output
  --pretty                  indent --json output
  --no-color                disable colour
  --icons <auto|nerd|ascii> glyph profile
  --strict                  fail on unreadable log lines
  --force                   close a forgotten running Timer
  -h, --help                show this help
  -V, --version             show version

Docs: README.md · SPEC.md · PLAN.md · GLOSSARY.md
`

/**
 * Turn parsed arguments into use-case calls and rendered output. Returns the
 * process exit code; never calls `process.exit` (SPEC §8.4).
 */
export async function runCli(parsed: ParsedArgs, deps: CliDeps): Promise<number> {
  if (parsed.options.version) {
    deps.stdout(`${deps.version}\n`)
    return 0
  }
  if (parsed.options.help || parsed.command === "help") {
    deps.stdout(USAGE)
    return 0
  }

  const env = deps.env ?? process.env
  const style = createStyle({
    icons: resolveIcons(parsed.options.icons, env, deps.config.icons.value),
    color: resolveColor(
      parsed.options.noColor,
      env,
      deps.isTTY === true,
      deps.config.color.value,
    ),
    width: deps.columns ?? Number.POSITIVE_INFINITY,
  })

  const command = parsed.command ?? "status"
  try {
    switch (command) {
      case "status": {
        const result = await deps.showStatus.execute()
        warnSkipped(result.skipped, deps)
        deps.stdout(parsed.options.json ? statusJson(result) : renderStatus(result, style))
        return 0
      }
      case "start": {
        const project = parsed.operands[0]
        if (project === undefined) throw new UsageError("start requires a <project>")
        const description = joinOperands(parsed.operands.slice(1))
        const result = await deps.startTask.execute({
          project,
          ...(description === undefined ? {} : { description }),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderStarted(result, style))
        return 0
      }
      case "stop": {
        const description = joinOperands(parsed.operands)
        const result = await deps.stopTask.execute({
          ...(description === undefined ? {} : { description }),
          ...(parsed.options.force ? { force: true } : {}),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderStopped(result, style))
        return 0
      }
      case "switch": {
        const project = parsed.operands[0]
        if (project === undefined) throw new UsageError("switch requires a <project>")
        const description = joinOperands(parsed.operands.slice(1))
        const result = await deps.switchTask.execute({
          project,
          ...(description === undefined ? {} : { description }),
          ...(parsed.options.force ? { force: true } : {}),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderSwitched(result, style))
        return 0
      }
      case "add":
      case "sub": {
        const [project, duration, ...rest] = parsed.operands
        if (project === undefined || duration === undefined || rest.length > 0) {
          throw new UsageError(`${command} requires <project> <duration>`)
        }
        const task = command === "add" ? deps.addAdjustment : deps.subAdjustment
        const result = await task.execute({
          project,
          duration,
          ...(parsed.options.date === null ? {} : { date: parsed.options.date }),
          ...(parsed.options.note === null ? {} : { note: parsed.options.note }),
        })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderAdjusted(result, style))
        return 0
      }
      case "rm": {
        if (parsed.operands.length > 1) throw new UsageError("rm takes at most one <id>")
        const id = parsed.operands[0]
        const result = await deps.removeEntry.execute(id === undefined ? {} : { id })
        warnSkipped(result.skipped, deps)
        deps.stdout(renderRemoved(result, style))
        return 0
      }
      case "log": {
        const result = await deps.queryLog.execute(rangeInput(parsed, deps.config.weekStart.value))
        warnSkipped(result.skipped, deps)
        deps.stdout(
          parsed.options.json
            ? logJson(result, { pretty: parsed.options.pretty })
            : renderLog(result, {
                style,
                ids: parsed.options.ids,
                seconds: parsed.options.seconds,
              }),
        )
        return 0
      }
      case "report": {
        const result = await deps.buildReport.execute(rangeInput(parsed, deps.config.weekStart.value))
        warnSkipped(result.skipped, deps)
        deps.stdout(
          parsed.options.json
            ? reportJson(result, { pretty: parsed.options.pretty })
            : renderReport(result, {
                style,
                grid: parsed.options.by === "day" || parsed.options.details,
                details: parsed.options.details,
              }),
        )
        return 0
      }
      case "config": {
        if (parsed.operands.length > 1) throw new UsageError("config takes at most one <key>")
        const rawKey = parsed.operands[0]
        if (rawKey !== undefined && !CONFIG_ORDER.includes(rawKey as keyof ConfigView)) {
          throw new UsageError(`unknown config key: ${rawKey}`)
        }
        const key = rawKey as keyof ConfigView | undefined
        deps.stdout(
          parsed.options.json
            ? configJson(deps.config, {
                pretty: parsed.options.pretty,
                ...(key === undefined ? {} : { key }),
              })
            : renderConfig(deps.config, {
                style,
                ...(key === undefined ? {} : { key }),
              }),
        )
        return 0
      }
      case "set": {
        const [key, value] = parsed.operands
        if (key === undefined || value === undefined || parsed.operands.length > 2) {
          throw new UsageError("set requires <key> <value>")
        }
        deps.stdout(renderSet(await deps.setConfig(key, value)))
        return 0
      }
      case "export": {
        deps.stdout(await deps.exportLog.execute())
        return 0
      }
      default:
        throw new UsageError(`unknown command: ${command}`)
    }
  } catch (error) {
    if (error instanceof TaflogError) {
      deps.stderr(`taflog: ${error.message}\n`)
      return error.exitCode
    }
    throw error
  }
}

function rangeInput(
  parsed: ParsedArgs,
  weekStart: WeekStart,
): {
  today?: boolean
  week?: boolean
  month?: boolean
  project?: string
  from?: string
  to?: string
  limit?: number
  weekStart: WeekStart
} {
  return {
    ...(parsed.options.today ? { today: true } : {}),
    ...(parsed.options.week ? { week: true } : {}),
    ...(parsed.options.month ? { month: true } : {}),
    ...(parsed.options.project === null ? {} : { project: parsed.options.project }),
    ...(parsed.options.from === null ? {} : { from: parsed.options.from }),
    ...(parsed.options.to === null ? {} : { to: parsed.options.to }),
    ...(parsed.options.limit === null ? {} : { limit: parsed.options.limit }),
    weekStart,
  }
}

function joinOperands(parts: string[]): string | undefined {
  const text = parts.join(" ").trim()
  return text === "" ? undefined : text
}

function warnSkipped(skipped: number, deps: CliDeps): void {
  if (skipped > 0) {
    deps.stderr(`warning: skipped ${skipped} unreadable line${skipped === 1 ? "" : "s"}\n`)
  }
}
