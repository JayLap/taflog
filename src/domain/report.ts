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

/** The derived Report (SPEC §9.3, §9.5). */
export interface Report {
  range: { from: string; to: string; weekStart: WeekStart }
  byProject: ReportProject[]
  byDay: ReportDay[]
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

interface DayBucket {
  projects: Map<string, number>
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
  const byDay = new Map<string, DayBucket>()
  for (const day of days) {
    byDay.set(formatLocalDate(day), { projects: new Map() })
  }

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

  const addProjectTime = (date: string, project: string, seconds: number): void => {
    const day = byDay.get(date)
    if (day === undefined) return
    day.projects.set(project, (day.projects.get(project) ?? 0) + seconds)
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

      addProjectTime(date, entry.project, seconds)
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
    addProjectTime(date, adjustment.project, adjustment.delta)
  }

  const byProject: ReportProject[] = []
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
    details.sort(
      (left, right) =>
        right.totalSeconds - left.totalSeconds ||
        left.description.localeCompare(right.description),
    )

    const adjustmentDays = [...bucket.adjustmentByDay.entries()]
      .filter(([, delta]) => delta !== 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, deltaSeconds]) => ({ date, deltaSeconds }))

    if (bucket.timedSeconds === 0 && bucket.adjustedSeconds === 0 && details.length === 0) {
      continue
    }

    byProject.push({
      project,
      timedSeconds: bucket.timedSeconds,
      adjustedSeconds: bucket.adjustedSeconds,
      totalSeconds: bucket.timedSeconds + bucket.adjustedSeconds,
      details,
      adjustmentDays,
    })
  }
  byProject.sort(
    (left, right) =>
      right.totalSeconds - left.totalSeconds || left.project.localeCompare(right.project),
  )

  const byDayList: ReportDay[] = days.map((day) => {
    const date = formatLocalDate(day)
    const bucket = byDay.get(date)!
    const projectList = [...bucket.projects.entries()]
      .filter(([, seconds]) => seconds !== 0)
      .map(([project, totalSeconds]) => ({ project, totalSeconds }))
      .sort(
        (left, right) =>
          right.totalSeconds - left.totalSeconds || left.project.localeCompare(right.project),
      )
    return {
      date,
      totalSeconds: projectList.reduce((sum, project) => sum + project.totalSeconds, 0),
      projects: projectList,
    }
  })

  const first = days[0]
  const last = days.at(-1)
  return {
    range: {
      from: first === undefined ? formatLocalDate(from) : formatLocalDate(first),
      to: last === undefined ? formatLocalDate(from) : formatLocalDate(last),
      weekStart,
    },
    byProject,
    byDay: byDayList,
  }
}
