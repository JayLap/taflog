import type { DayTargets } from "./config.ts"
import { parseLocalDate, weekdayOf } from "./datetime.ts"
import {
  compareDetails,
  compareProjects,
  deriveByDay,
  type NormalizedDay,
  type Report,
  type ReportDetail,
  type ReportProject,
} from "./report.ts"

export interface NormalizeOptions {
  dayTargets: DayTargets
  /** Rounding unit in seconds; every normalized bucket is a multiple of it. */
  step: number
  /** Local date (`YYYY-MM-DD`) of today; only days strictly before it are complete. */
  today: string
}

interface Bucket {
  detail: ReportDetail
  seconds: number
}

/**
 * Split `budget` seconds across buckets in proportion to `weights`, in whole
 * `step` units, so the result sums to exactly `budget` (SPEC §9.3).
 *
 * Largest-remainder allocation: floor each share, then hand the leftover units
 * to the biggest fractional remainders. Every bucket keeps at least one step
 * when there are enough steps to go round (taken from the largest bucket). A
 * budget that is not a multiple of `step` puts its remainder on the largest
 * bucket. Pure and deterministic; ties resolve by weight, then position.
 */
export function allocate(weights: number[], budget: number, step: number): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  const units = Math.floor(budget / step)
  if (weights.length === 0 || total <= 0 || units <= 0) return weights.map(() => 0)

  const quotas = weights.map((weight) => (units * weight) / total)
  const shares = quotas.map((quota) => Math.floor(quota))
  const byRemainder = rank(
    weights.length,
    (left, right) =>
      quotas[right]! - shares[right]! - (quotas[left]! - shares[left]!) ||
      weights[right]! - weights[left]!,
  )
  const leftover = units - shares.reduce((sum, share) => sum + share, 0)
  for (const index of byRemainder.slice(0, leftover)) shares[index]! += 1

  if (units >= weights.length) {
    for (const index of rank(weights.length, (left, right) => weights[right]! - weights[left]!)) {
      if (shares[index]! > 0) continue
      shares[largest(shares)]! -= 1
      shares[index] = 1
    }
  }

  const seconds = shares.map((share) => share * step)
  seconds[largest(seconds)]! += budget - units * step
  return seconds
}

/** Indices `0..count-1` ordered by `compare`, ties by position. */
function rank(count: number, compare: (left: number, right: number) => number): number[] {
  return Array.from({ length: count }, (_, index) => index).sort(
    (left, right) => compare(left, right) || left - right,
  )
}

function largest(values: number[]): number {
  let best = 0
  for (let index = 1; index < values.length; index += 1) {
    if (values[index]! > values[best]!) best = index
  }
  return best
}

/**
 * Rescale each completed day's Timed time to that weekday's target
 * (SPEC §9.3). Per day, every (Project, Description) bucket is scaled by the
 * same ratio and rounded to `step` so the day's Total time equals its target.
 * Adjustments are fixed: they count toward the target but are never scaled, so
 * the Timed buckets share `target − adjusted`.
 *
 * A day is left as-is when it has no target, is not yet complete, has no Timed
 * time, or when Adjustments leave less than one step for Timed time.
 */
export function normalizeReport(report: Report, options: NormalizeOptions): Report {
  const replaced = new Map<string, Map<ReportDetail, number>>()
  const days: NormalizedDay[] = []

  for (const day of report.byDay) {
    const local = parseLocalDate(day.date)
    if (local === null || day.date >= options.today) continue
    const target = options.dayTargets[weekdayOf(local)]
    if (target === null) continue

    const buckets: Bucket[] = []
    let adjusted = 0
    for (const project of report.byProject) {
      adjusted += project.adjustmentDays.find((item) => item.date === day.date)?.deltaSeconds ?? 0
      for (const detail of project.details) {
        const seconds = detail.byDay.find((item) => item.date === day.date)?.timedSeconds ?? 0
        if (seconds > 0) buckets.push({ detail, seconds })
      }
    }

    const budget = target - adjusted
    if (buckets.length === 0 || budget < options.step) continue
    const scaled = allocate(
      buckets.map((bucket) => bucket.seconds),
      budget,
      options.step,
    )
    replaced.set(day.date, new Map(buckets.map((bucket, index) => [bucket.detail, scaled[index]!])))
    days.push({
      date: day.date,
      targetSeconds: target,
      originalSeconds: day.totalSeconds,
      normalizedSeconds: target,
    })
  }

  const byProject = report.byProject.flatMap((project): ReportProject[] => {
    const details = project.details.map((detail): ReportDetail => {
      const byDay = detail.byDay
        .map((item) => ({
          date: item.date,
          timedSeconds: replaced.get(item.date)?.get(detail) ?? item.timedSeconds,
        }))
        .filter((item) => item.timedSeconds !== 0)
      return {
        description: detail.description,
        totalSeconds: byDay.reduce((sum, item) => sum + item.timedSeconds, 0),
        byDay,
      }
    })
    details.sort(compareDetails)
    const timedSeconds = details.reduce((sum, detail) => sum + detail.totalSeconds, 0)
    if (timedSeconds === 0 && project.adjustedSeconds === 0) return []
    return [
      {
        ...project,
        timedSeconds,
        totalSeconds: timedSeconds + project.adjustedSeconds,
        details,
      },
    ]
  })
  byProject.sort(compareProjects)

  return {
    ...report,
    byProject,
    byDay: deriveByDay(
      byProject,
      report.byDay.map((day) => day.date),
    ),
    normalization: { stepSeconds: options.step, days },
  }
}

/** Keep only one Project (case-insensitive) and recompute the by-day view. */
export function selectProject(report: Report, project: string): Report {
  const wanted = project.toLowerCase()
  const byProject = report.byProject.filter((item) => item.project.toLowerCase() === wanted)
  return {
    ...report,
    byProject,
    byDay: deriveByDay(
      byProject,
      report.byDay.map((day) => day.date),
    ),
  }
}
