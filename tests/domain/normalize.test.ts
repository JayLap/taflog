import { test } from "node:test"
import assert from "node:assert/strict"
import type { Adjustment, Entry } from "../../src/domain/entry.ts"
import { DEFAULT_DAY_TARGETS } from "../../src/domain/config.ts"
import { allocate, normalizeReport, selectProject } from "../../src/domain/normalize.ts"
import { buildReport } from "../../src/domain/report.ts"

const H = 3600
const M = 60
// 2025-10-20 is a Monday.
const at = (date: number, hour: number, minute = 0): Date => new Date(2025, 9, date, hour, minute)
const entry = (id: string, project: string, description: string, start: Date, end: Date): Entry => ({
  id,
  project,
  description,
  start,
  end,
})
const options = { dayTargets: DEFAULT_DAY_TARGETS, step: 15 * M, today: "2025-10-27" }

/** The issue's example: devops 4h13 and support 2h on a Monday, target 7h30. */
function mondayEntries(): Entry[] {
  return [
    entry("a", "project-1", "devops", at(20, 8), at(20, 12, 13)),
    entry("b", "project-2", "support", at(20, 13), at(20, 15)),
  ]
}

test("allocate sums exactly to the budget and keeps the largest remainder in step units", () => {
  assert.deepEqual(allocate([4 * H + 13 * M, 2 * H], 7.5 * H, 15 * M), [5 * H, 2.5 * H])
  assert.deepEqual(allocate([4 * H + 13 * M, 2 * H], 7.5 * H, 5 * M), [5 * H + 5 * M, 2 * H + 25 * M])
})

test("allocate keeps a minimum of one step per bucket, taken from the largest", () => {
  const result = allocate([11 * H, 5 * M], 7.5 * H, 15 * M)
  assert.equal(result[1], 15 * M)
  assert.equal(result[0]! + result[1]!, 7.5 * H)
})

test("allocate puts a budget remainder smaller than a step on the largest bucket", () => {
  const result = allocate([3 * H, 1 * H], 4 * H + 7 * M, 15 * M)
  assert.equal(result[0]! + result[1]!, 4 * H + 7 * M)
  assert.ok(result[0]! > result[1]!)
})

test("allocate is total, non-negative and deterministic over many shapes", () => {
  for (let count = 1; count <= 7; count += 1) {
    for (let seed = 1; seed <= 20; seed += 1) {
      const weights = Array.from({ length: count }, (_, index) => ((seed * (index + 3)) % 17 + 1) * 7 * M)
      const budget = (5 + (seed % 4)) * H + (seed % 3) * 5 * M
      const once = allocate(weights, budget, 5 * M)
      assert.equal(once.reduce((a, b) => a + b, 0), budget)
      assert.ok(once.every((value) => value > 0))
      assert.deepEqual(once, allocate(weights, budget, 5 * M))
    }
  }
})

test("normalizeReport rescales a completed day to its target (issue example)", () => {
  const report = buildReport(mondayEntries(), [], at(20, 0), at(27, 0))
  const result = normalizeReport(report, options)

  const byProject = Object.fromEntries(result.byProject.map((p) => [p.project, p.totalSeconds]))
  assert.deepEqual(byProject, { "project-1": 5 * H, "project-2": 2.5 * H })
  assert.equal(result.byDay[0]?.totalSeconds, 7.5 * H)
  assert.deepEqual(result.byDay[0]?.projects, [
    { project: "project-1", totalSeconds: 5 * H },
    { project: "project-2", totalSeconds: 2.5 * H },
  ])
  assert.deepEqual(result.normalization, {
    stepSeconds: 15 * M,
    days: [
      {
        date: "2025-10-20",
        targetSeconds: 7.5 * H,
        originalSeconds: 6 * H + 13 * M,
        normalizedSeconds: 7.5 * H,
      },
    ],
  })
})

test("normalizeReport scales Description buckets and keeps project = sum of sub-rows", () => {
  const entries = [
    entry("a", "acme", "parser", at(20, 8), at(20, 10)),
    entry("b", "acme", "review", at(20, 10), at(20, 11)),
    entry("c", "beta", "", at(20, 11), at(20, 12)),
  ]
  const result = normalizeReport(buildReport(entries, [], at(20, 0), at(27, 0)), options)
  for (const project of result.byProject) {
    assert.equal(
      project.timedSeconds,
      project.details.reduce((sum, detail) => sum + detail.totalSeconds, 0),
    )
    assert.equal(project.totalSeconds, project.timedSeconds + project.adjustedSeconds)
  }
  const total = result.byProject.reduce((sum, project) => sum + project.totalSeconds, 0)
  assert.equal(total, 7.5 * H)
  assert.deepEqual(
    result.byProject.find((p) => p.project === "acme")?.details.map((d) => d.description),
    ["parser", "review"],
  )
})

test("normalizeReport scales a day down when it is above target", () => {
  const entries = [entry("a", "acme", "x", at(20, 6), at(20, 18))]
  const result = normalizeReport(buildReport(entries, [], at(20, 0), at(27, 0)), options)
  assert.equal(result.byDay[0]?.totalSeconds, 7.5 * H)
})

test("normalizeReport leaves Adjustments fixed and fits Timed time to target − adjusted", () => {
  const adjustments: Adjustment[] = [{ id: "j", project: "acme", date: "2025-10-20", delta: -30 * M }]
  const result = normalizeReport(buildReport(mondayEntries(), adjustments, at(20, 0), at(27, 0)), options)
  assert.equal(result.byDay[0]?.totalSeconds, 7.5 * H)
  const acme = result.byProject.find((p) => p.project === "project-1")
  assert.equal(acme?.adjustedSeconds, 0)
  const withAdjust = buildReport(
    [entry("a", "acme", "x", at(20, 8), at(20, 12)), entry("b", "beta", "y", at(20, 13), at(20, 15))],
    adjustments,
    at(20, 0),
    at(27, 0),
  )
  const fitted = normalizeReport(withAdjust, options)
  const acmeRow = fitted.byProject.find((p) => p.project === "acme")!
  assert.equal(acmeRow.adjustedSeconds, -30 * M)
  assert.equal(acmeRow.timedSeconds + acmeRow.adjustedSeconds + fitted.byProject.find((p) => p.project === "beta")!.totalSeconds, 7.5 * H)
})

test("normalizeReport skips today, days without a target, and unscaled weekend days", () => {
  const entries = [
    ...mondayEntries(),
    entry("s", "acme", "weekend", at(25, 9), at(25, 11)), // Saturday: target off
    entry("t", "acme", "today", at(23, 9), at(23, 10)), // Thursday = today
  ]
  const report = buildReport(entries, [], at(20, 0), at(27, 0))
  const result = normalizeReport(report, { ...options, today: "2025-10-23" })
  assert.equal(result.byDay[5]?.totalSeconds, 2 * H)
  assert.equal(result.byDay[3]?.totalSeconds, 1 * H)
  assert.deepEqual(result.normalization?.days.map((d) => d.date), ["2025-10-20"])
})

test("normalizeReport honours a target configured on a default-off weekday", () => {
  const entries = [entry("s", "acme", "weekend", at(25, 9), at(25, 11))]
  const targets = { ...DEFAULT_DAY_TARGETS, saturday: 4 * H }
  const result = normalizeReport(buildReport(entries, [], at(20, 0), at(27, 0)), {
    ...options,
    dayTargets: targets,
  })
  assert.equal(result.byDay[5]?.totalSeconds, 4 * H)
})

test("normalizeReport leaves a day alone when Adjustments exceed its target", () => {
  const adjustments: Adjustment[] = [{ id: "j", project: "acme", date: "2025-10-20", delta: 8 * H }]
  const report = buildReport(mondayEntries(), adjustments, at(20, 0), at(27, 0))
  const result = normalizeReport(report, options)
  assert.deepEqual(result.byDay, report.byDay)
  assert.deepEqual(result.normalization?.days, [])
})

test("selectProject narrows a normalized report and recomputes by-day", () => {
  const normalized = normalizeReport(buildReport(mondayEntries(), [], at(20, 0), at(27, 0)), options)
  const only = selectProject(normalized, "PROJECT-2")
  assert.deepEqual(only.byProject.map((p) => p.project), ["project-2"])
  assert.equal(only.byDay[0]?.totalSeconds, 2.5 * H)
})
