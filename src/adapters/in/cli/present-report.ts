import type { BuildReportResult } from "../../../application/build-report.ts"
import type { DateRange } from "../../../application/range.ts"
import type { Report, ReportDay, ReportProject } from "../../../domain/report.ts"
import {
  formatShortWeekday,
  isWeekend,
} from "../../../domain/datetime.ts"
import { formatDuration } from "../../../domain/duration.ts"
import { rangeTitle } from "./range-title.ts"
import { createStyle, type Style } from "./style.ts"

export interface ReportRenderOptions {
  style?: Style
  /** `--by day`: show the day grid instead of the project summary. */
  grid?: boolean
  /** `--details`: add Description (and `adjustments`) sub-rows. */
  details?: boolean
}

interface GridColumn {
  date: string
  label: string
  day: ReportDay | undefined
}

/** Terminal presenter for `report` (SPEC §9.3). Always ends with a newline. */
export function renderReport(result: BuildReportResult, options: ReportRenderOptions = {}): string {
  const style = options.style ?? createStyle()
  const report = result.report
  if (report.byProject.length === 0) {
    return `No time tracked in this range.\n`
  }

  const total = report.byProject.reduce((sum, project) => sum + project.totalSeconds, 0)
  const title = rangeTitle(result.range, style, total)
  const body =
    options.grid === true || options.details === true
      ? renderGrid(report, result.range, style, options.details === true)
      : renderSummary(report.byProject, style)
  return `${[title, ...body].map((line) => style.truncate(line, style.width)).join("\n")}\n`
}

function renderSummary(projects: ReportProject[], style: Style): string[] {
  const projectWidth = Math.max(...projects.map((project) => project.project.length))
  const totalWidth = Math.max(...projects.map((project) => formatDuration(project.totalSeconds).length))
  const timedWidth = Math.max(...projects.map((project) => formatDuration(project.timedSeconds).length))

  return projects.map((project) => {
    let line = `  ${project.project.padEnd(projectWidth)}   ${formatDuration(project.totalSeconds).padStart(totalWidth)}    timed ${formatDuration(project.timedSeconds).padStart(timedWidth)}`
    if (project.adjustedSeconds !== 0) {
      line += ` ${style.glyphs.project} adjusted ${style.signed(project.adjustedSeconds)}`
    }
    return line.replace(project.project, style.project(project.project))
  })
}

function renderGrid(
  report: Report,
  range: DateRange,
  style: Style,
  details: boolean,
): string[] {
  const columns = gridColumns(report, range)
  const labelWidth = Math.max(8, ...gridLabels(report, details).map((label) => label.length))
  const cellWidth = 8
  const pad = (value: string): string => value.padStart(cellWidth)
  const label = (value: string): string => value.padEnd(labelWidth)

  const header = `${label("")}${columns.map((column) => pad(column.label)).join("")}${pad("Total")}`.trimEnd()
  const lines = [header]

  let grandTotal = 0
  for (const project of report.byProject) {
    grandTotal += project.totalSeconds
    const cells = columns
      .map((column) => pad(gridDuration(dayProjectTotal(column.day, project.project))))
      .join("")
    const row = `${label(`  ${project.project}`)}${cells}${pad(gridDuration(project.totalSeconds))}`.trimEnd()
    lines.push(row.replace(project.project, style.project(project.project)))

    if (details) {
      for (const detail of project.details) {
        const cells = columns
          .map((column) => {
            const timed = detail.byDay.find((item) => item.date === column.date)?.timedSeconds ?? 0
            return timed === 0 ? " ".repeat(cellWidth) : pad(gridDuration(timed))
          })
          .join("")
        lines.push(
          `${label(`    ${detail.description}`)}${cells}${pad(gridDuration(detail.totalSeconds))}`.trimEnd(),
        )
      }

      if (project.adjustmentDays.length > 0) {
        const cells = columns
          .map((column) => {
            const delta = project.adjustmentDays.find((item) => item.date === column.date)?.deltaSeconds ?? 0
            return delta === 0 ? " ".repeat(cellWidth) : pad(style.signed(delta))
          })
          .join("")
        lines.push(
          `${label("    adjustments")}${cells}${pad(style.signed(project.adjustedSeconds))}`.trimEnd(),
        )
      }
    }
  }

  const rule = style.icons === "ascii" ? "-" : "─"
  lines.push(
    `  ${rule.repeat(Math.max(0, labelWidth + (columns.length + 1) * cellWidth - 2))}`,
  )

  const totals = columns
    .map((column) => pad(gridDuration(column.day?.totalSeconds ?? 0)))
    .join("")
  lines.push(`${label("  Total")}${totals}${pad(gridDuration(grandTotal))}`.trimEnd())

  return lines
}

function gridLabels(report: Report, details: boolean): string[] {
  const labels: string[] = []
  for (const project of report.byProject) {
    labels.push(`  ${project.project}`)
    if (details) {
      for (const detail of project.details) labels.push(`    ${detail.description}`)
      if (project.adjustmentDays.length > 0) labels.push("    adjustments")
    }
  }
  labels.push("  Total")
  return labels
}

function gridColumns(report: Report, range: DateRange): GridColumn[] {
  const days = report.byDay
  if (days.length !== 7) {
    return days.map((day) => ({
      date: day.date,
      label: days.length <= 7 ? formatShortWeekday(new Date(`${day.date}T00:00:00`)) : day.date.slice(8),
      day,
    }))
  }

  const ordered = days.map((day) => ({ day, weekend: isWeekend(new Date(`${day.date}T00:00:00`)) }))
  const weekdays = ordered.filter((item) => !item.weekend)
  const weekend = ordered.filter((item) => item.weekend)
  const includeWeekend = weekend.some((item) => item.day.totalSeconds !== 0)
  const chosen = includeWeekend ? [...weekdays, ...weekend] : weekdays

  return chosen.map((item) => ({
    date: item.day.date,
    label: formatShortWeekday(new Date(`${item.day.date}T00:00:00`)),
    day: item.day,
  }))
}

function dayProjectTotal(day: ReportDay | undefined, project: string): number {
  if (day === undefined) return 0
  return day.projects.find((item) => item.project === project)?.totalSeconds ?? 0
}

/** Grid durations always show hours, without a trailing `m` (`0h30`, `2h00`). */
function gridDuration(seconds: number): string {
  const sign = seconds < 0 ? "−" : ""
  const totalMinutes = Math.floor(Math.abs(seconds) / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${sign}${hours}h${String(minutes).padStart(2, "0")}`
}

/** JSON presenter for `report`; frozen `version: 1`, seconds only (SPEC §9.5). */
export function reportJson(result: BuildReportResult, options: { pretty?: boolean } = {}): string {
  const report = result.report
  const payload = {
    version: 1,
    range: report.range,
    byProject: report.byProject.map((project) => ({
      project: project.project,
      timedSeconds: project.timedSeconds,
      adjustedSeconds: project.adjustedSeconds,
      totalSeconds: project.totalSeconds,
      details: project.details.map((detail) => ({
        description: detail.description,
        totalSeconds: detail.totalSeconds,
        byDay: detail.byDay,
      })),
    })),
    byDay: report.byDay,
  }
  return `${JSON.stringify(payload, null, options.pretty === true ? 2 : undefined)}\n`
}
