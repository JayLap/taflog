import type { Adjustment, Entry } from "./entry.ts"
import {
  addLocalDays,
  enumerateLocalDays,
  formatLocalDate,
  overlapSeconds,
  parseLocalDate,
  type WeekStart,
} from "./datetime.ts"

/** A Description's timed total and the days it has time on. */
export interface ReportDetail {
  description: string
  totalSeconds: number
  byDay: Array<{ date: string; timedSeconds: number }>
}

/** One Project row in a Report. */
export interface ReportProject {
  project: string
  timedSeconds: number
  adjustedSeconds: number
  totalSeconds: number
  details: ReportDetail[]
  /** Days with an Adjustment; kept for the terminal `adjustments` sub-row. */
  adjustmentDays: Array<{ date: string; deltaSeconds: number }>
}

/** One column/row of the by-day view. */
export interface ReportDay {
  date: string
  totalSeconds: number
  projects: Array<{ project: string; totalSeconds: number }>
}

/** One day a Normalization rescaled, with its totals before and after. */
export interface NormalizedDay {
  date: string
  targetSeconds: number
  originalSeconds: number
  normalizedSeconds: number
}

/** Present on a Report that went through `normalizeReport` (SPEC §9.3). */
export interface Normalization {
  stepSeconds: number
  days: NormalizedDay[]
}

/** The derived Report (SPEC §9.3, §9.5). */
export interface Report {
  range: { from: string; to: string; weekStart: WeekStart }
  byProject: ReportProject[]
  byDay: ReportDay[]
  normalization?: Normalization
}

interface DetailBucket {
  byDay: Map<string, number>
}

interface ProjectBucket {
  timedSeconds: number
  adjustedSeconds: number
  details: Map<string, DetailBucket>
  adjustmentByDay: Map<string, number>
}

const UNTITLED = "(no description)"

/**
 * Aggregate Entries and Adjustments over `[from, to)` (SPEC §9.3). Entries are
 * split across the local days they cross; Adjustments count on their `date`.
 * Every Project row reconciles as `timed + adjusted = total`.
 */
export function buildReport(
  entries: Entry[],
  adjustments: Adjustment[],
  from: Date,
  to: Date,
  weekStart: WeekStart = "monday",
): Report {
  const days = enumerateLocalDays(from, to)
  const projects = new Map<string, ProjectBucket>()

  const projectBucket = (project: string): ProjectBucket => {
    let bucket = projects.get(project)
    if (bucket === undefined) {
      bucket = {
        timedSeconds: 0,
        adjustedSeconds: 0,
        details: new Map(),
        adjustmentByDay: new Map(),
      }
      projects.set(project, bucket)
    }
    return bucket
  }

  for (const entry of entries) {
    const description = entry.description.trim() === "" ? UNTITLED : entry.description
    for (const day of days) {
      const next = addLocalDays(day, 1)
      const seconds = Math.floor(overlapSeconds(entry.start, entry.end, day, next))
      if (seconds === 0) continue
      const date = formatLocalDate(day)
      const bucket = projectBucket(entry.project)
      bucket.timedSeconds += seconds

      let detail = bucket.details.get(description)
      if (detail === undefined) {
        detail = { byDay: new Map() }
        bucket.details.set(description, detail)
      }
      detail.byDay.set(date, (detail.byDay.get(date) ?? 0) + seconds)
    }
  }

  for (const adjustment of adjustments) {
    const localDay = parseLocalDate(adjustment.date)
    if (localDay === null) continue
    if (localDay.getTime() < from.getTime() || localDay.getTime() >= to.getTime()) continue

    const date = formatLocalDate(localDay)
    const bucket = projectBucket(adjustment.project)
    bucket.adjustedSeconds += adjustment.delta
    bucket.adjustmentByDay.set(
      date,
      (bucket.adjustmentByDay.get(date) ?? 0) + adjustment.delta,
    )
  }

  const allProjects: ReportProject[] = []
  for (const [project, bucket] of projects) {
    const details: ReportDetail[] = []
    for (const [description, detail] of bucket.details) {
      const byDayList = [...detail.byDay.entries()]
        .filter(([, seconds]) => seconds !== 0)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, timedSeconds]) => ({ date, timedSeconds }))
      const totalSeconds = byDayList.reduce((sum, item) => sum + item.timedSeconds, 0)
      details.push({ description, totalSeconds, byDay: byDayList })
    }
    details.sort(compareDetails)

    const adjustmentDays = [...bucket.adjustmentByDay.entries()]
      .filter(([, delta]) => delta !== 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, deltaSeconds]) => ({ date, deltaSeconds }))

    allProjects.push({
      project,
      timedSeconds: bucket.timedSeconds,
      adjustedSeconds: bucket.adjustedSeconds,
      totalSeconds: bucket.timedSeconds + bucket.adjustedSeconds,
      details,
      adjustmentDays,
    })
  }
  const byDay = deriveByDay(allProjects, days.map(formatLocalDate))
  const byProject = allProjects
    .filter(
      (project) =>
        project.timedSeconds !== 0 || project.adjustedSeconds !== 0 || project.details.length > 0,
    )
    .sort(compareProjects)

  const first = days[0]
  const last = days.at(-1)
  return {
    range: {
      from: first === undefined ? formatLocalDate(from) : formatLocalDate(first),
      to: last === undefined ? formatLocalDate(from) : formatLocalDate(last),
      weekStart,
    },
    byProject,
    byDay,
  }
}

/** Largest Project first, ties by name. */
export function compareProjects(
  left: Pick<ReportProject, "project" | "totalSeconds">,
  right: Pick<ReportProject, "project" | "totalSeconds">,
): number {
  return right.totalSeconds - left.totalSeconds || left.project.localeCompare(right.project)
}

/** Largest Description first, ties by text. */
export function compareDetails(left: ReportDetail, right: ReportDetail): number {
  return (
    right.totalSeconds - left.totalSeconds || left.description.localeCompare(right.description)
  )
}

/**
 * The by-day view: each date's Total time per Project, summed from the
 * Projects' Timed sub-rows and Adjustment days. Days with no time keep an
 * empty row.
 */
export function deriveByDay(byProject: ReportProject[], dates: string[]): ReportDay[] {
  return dates.map((date) => {
    const projects = byProject
      .map((project) => ({
        project: project.project,
        totalSeconds:
          project.details.reduce(
            (sum, detail) =>
              sum + (detail.byDay.find((item) => item.date === date)?.timedSeconds ?? 0),
            0,
          ) + (project.adjustmentDays.find((item) => item.date === date)?.deltaSeconds ?? 0),
      }))
      .filter((project) => project.totalSeconds !== 0)
      .sort(compareProjects)
    return {
      date,
      totalSeconds: projects.reduce((sum, project) => sum + project.totalSeconds, 0),
      projects,
    }
  })
}
