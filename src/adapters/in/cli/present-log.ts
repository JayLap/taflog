import type { LogItem, QueryLogResult } from "../../../application/query-log.ts"
import { formatLocalTime } from "../../../domain/datetime.ts"
import { rangeTitle } from "./range-title.ts"
import { createStyle, sanitizeForTerminal, type Style } from "./style.ts"

export interface LogRenderOptions {
  style?: Style
  ids?: boolean
  seconds?: boolean
}

/** Terminal presenter for `log` (SPEC §9.2). Always ends with a newline. */
export function renderLog(result: QueryLogResult, options: LogRenderOptions = {}): string {
  const style = options.style ?? createStyle()
  if (result.items.length === 0) {
    return `No entries in this range.\n`
  }

  const projectWidth = Math.max(
    1,
    ...result.items.map((item) => projectLabel(item, options.ids === true).length),
  )
  const lines = [rangeTitle(result.range, style, result.totals.totalSeconds)]
  for (const item of result.items) {
    lines.push(renderItem(item, projectWidth, style, options))
  }
  return `${lines.join("\n")}\n`
}

function renderItem(
  item: LogItem,
  projectWidth: number,
  style: Style,
  options: LogRenderOptions,
): string {
  const projectPlain = projectLabel(item, options.ids === true)
  const descriptionPlain = describe(item, style)
  const available =
    Number.isFinite(style.width) && descriptionPlain !== ""
      ? style.width - (25 + projectWidth + 3)
      : Number.POSITIVE_INFINITY
  const description = descriptionPlain === "" ? "" : style.truncate(descriptionPlain, available)

  const left =
    item.kind === "timed"
      ? `  ${`${formatLocalTime(item.start)} → ${formatLocalTime(item.end)}`.padEnd(16)}${duration(
          item,
          options,
          style,
        ).padStart(4)}`
      : `${" ".repeat(19)}${style.signed(item.deltaSeconds)}`

  let entry = `${left.padEnd(25)}${style.project(projectPlain)}`
  if (description === "") return entry
  entry += " ".repeat(projectWidth - projectPlain.length)
  return `${entry}   ${style.meta(description)}`
}

function projectLabel(item: LogItem, ids: boolean): string {
  const project = sanitizeForTerminal(item.project)
  return ids ? `${project} ${sanitizeForTerminal(item.id)}` : project
}

function describe(item: LogItem, style: Style): string {
  if (item.kind === "timed") return sanitizeForTerminal(item.description)
  const note =
    item.note === undefined ? "" : ` ${style.glyphs.project} ${sanitizeForTerminal(item.note)}`
  return `adjustment${note}`
}

function duration(item: LogItem, options: LogRenderOptions, style: Style): string {
  if (item.kind !== "timed") return ""
  if (options.seconds === true) {
    const seconds = item.durationSeconds % 60
    return `${style.duration(item.durationSeconds)}${String(seconds).padStart(2, "0")}s`
  }
  return style.duration(item.durationSeconds)
}

/** JSON presenter for `log`; frozen `version: 1`, seconds only (SPEC §9.5). */
export function logJson(result: QueryLogResult, options: { pretty?: boolean } = {}): string {
  const entries = result.items.map((item) => {
    if (item.kind === "timed") {
      return {
        kind: "timed",
        id: item.id,
        project: item.project,
        description: item.description,
        start: item.start.toISOString(),
        end: item.end.toISOString(),
        durationSeconds: item.durationSeconds,
      }
    }
    return {
      kind: "adjust",
      id: item.id,
      date: item.date,
      project: item.project,
      deltaSeconds: item.deltaSeconds,
      ...(item.note === undefined ? {} : { note: item.note }),
    }
  })

  const payload = {
    version: 1,
    query: result.query,

    entries,
    totals: result.totals,
  }
  return `${JSON.stringify(payload, null, options.pretty === true ? 2 : undefined)}\n`
}
