import { test } from "node:test"
import assert from "node:assert/strict"
import type { Adjustment, Entry } from "../../src/domain/entry.ts"
import { buildReport } from "../../src/domain/report.ts"
import { formatLocalDate } from "../../src/domain/datetime.ts"

const day = (date: number, hour = 0, minute = 0): Date => new Date(2025, 9, date, hour, minute)

function entry(
  id: string,
  project: string,
  description: string,
  start: Date,
  end: Date,
): Entry {
  return { id, project, description, start, end }
}

function adjustment(id: string, project: string, date: string, delta: number): Adjustment {
  return { id, project, date, delta }
}

/**
 * SPEC §9.3 fixture: a five-day week for acme and beta. The numbers are
 * deliberately simple so the grid and summary agree exactly:
 * acme timed 16h45m with a -30m Adjustment, beta timed 2h45m.
 */
function weekFixture(): { entries: Entry[]; adjustments: Adjustment[] } {
  const entries: Entry[] = [
    // acme: 8h30m of "new parser"
    entry("a1", "acme", "new parser", day(20, 9), day(20, 10)),
    entry("a2", "acme", "new parser", day(21, 9), day(21, 10, 30)),
    entry("a3", "acme", "new parser", day(22, 9), day(22, 11)),
    entry("a4", "acme", "new parser", day(23, 9), day(23, 10, 45)),
    entry("a5", "acme", "new parser", day(24, 9), day(24, 11, 15)),
    // acme: 7h15m of "code review"
    entry("a6", "acme", "code review", day(20, 11), day(20, 11, 30)),
    entry("a7", "acme", "code review", day(21, 11), day(21, 13)),
    entry("a8", "acme", "code review", day(22, 11), day(22, 12, 30)),
    entry("a9", "acme", "code review", day(23, 11), day(23, 12, 30)),
    entry("a10", "acme", "code review", day(24, 11), day(24, 12, 45)),
    // acme: 1h of "standup"
    entry("a11", "acme", "standup", day(20, 8), day(20, 8, 30)),
    entry("a12", "acme", "standup", day(22, 8), day(22, 8, 30)),
    // beta: 2h45m of "emails"
    entry("b1", "beta", "emails", day(20, 9), day(20, 9, 30)),
    entry("b2", "beta", "emails", day(21, 9), day(21, 9, 15)),
    entry("b3", "beta", "emails", day(22, 9), day(22, 10)),
    entry("b4", "beta", "emails", day(23, 9), day(23, 9, 30)),
    entry("b5", "beta", "emails", day(24, 9), day(24, 9, 30)),
  ]
  return {
    entries,
    adjustments: [adjustment("c1", "acme", "2025-10-23", -1800)],
  }
}

test("buildReport reconciles project rows: timed + adjusted = total", () => {
  const { entries, adjustments } = weekFixture()
  const report = buildReport(entries, adjustments, day(20), day(27), "monday")

  assert.deepEqual(report.range, {
    from: "2025-10-20",
    to: "2025-10-26",
    weekStart: "monday",
  })

  const acme = report.byProject.find((project) => project.project === "acme")
  assert.ok(acme)
  assert.equal(acme.timedSeconds, 16 * 3600 + 45 * 60)
  assert.equal(acme.adjustedSeconds, -1800)
  assert.equal(acme.totalSeconds, 16 * 3600 + 15 * 60)

  const beta = report.byProject.find((project) => project.project === "beta")
  assert.ok(beta)
  assert.equal(beta.timedSeconds, 2 * 3600 + 45 * 60)
  assert.equal(beta.adjustedSeconds, 0)
  assert.equal(beta.totalSeconds, beta.timedSeconds)
})

test("buildReport orders projects and details by total descending", () => {
  const { entries, adjustments } = weekFixture()
  const report = buildReport(entries, adjustments, day(20), day(27), "monday")
  assert.deepEqual(report.byProject.map((project) => project.project), ["acme", "beta"])
  assert.deepEqual(
    report.byProject[0]?.details.map((detail) => detail.description),
    ["new parser", "code review", "standup"],
  )
})

test("buildReport gives each detail only the days it has time on", () => {
  const { entries, adjustments } = weekFixture()
  const report = buildReport(entries, adjustments, day(20), day(27), "monday")
  const acme = report.byProject[0]!
  const standup = acme.details.find((detail) => detail.description === "standup")!
  assert.deepEqual(standup.byDay, [
    { date: "2025-10-20", timedSeconds: 1800 },
    { date: "2025-10-22", timedSeconds: 1800 },
  ])
  assert.equal(standup.totalSeconds, 3600)
})

test("buildReport keeps adjustment days for the details adjustment sub-row", () => {
  const { entries, adjustments } = weekFixture()
  const report = buildReport(entries, adjustments, day(20), day(27), "monday")
  const acme = report.byProject[0]!
  assert.deepEqual(acme.adjustmentDays, [{ date: "2025-10-23", deltaSeconds: -1800 }])
})

test("buildReport byDay contains every local day and splits midnight-spanning Entries", () => {
  const crossing: Entry = entry(
    "x1",
    "gamma",
    "",
    new Date(2025, 9, 21, 23, 0),
    new Date(2025, 9, 22, 1, 0),
  )
  const report = buildReport([crossing], [], day(20), day(27), "monday")
  assert.equal(report.byDay.length, 7)
  const monday = report.byDay.find((item) => item.date === "2025-10-21")!
  const tuesday = report.byDay.find((item) => item.date === "2025-10-22")!
  assert.equal(monday.totalSeconds, 3600)
  assert.equal(tuesday.totalSeconds, 3600)
  assert.deepEqual(monday.projects, [{ project: "gamma", totalSeconds: 3600 }])
})

test("buildReport buckets an untitled Entry as (no description)", () => {
  const report = buildReport(
    [entry("x1", "gamma", "", day(20, 9), day(20, 10))],
    [],
    day(20),
    day(21),
    "monday",
  )
  assert.equal(report.byProject[0]?.details[0]?.description, "(no description)")
})

test("buildReport allows a negative Adjustment to make a project total negative", () => {
  const report = buildReport(
    [],
    [adjustment("c1", "acme", "2025-10-20", -1800)],
    day(20),
    day(21),
    "monday",
  )
  const acme = report.byProject[0]!
  assert.equal(acme.totalSeconds, -1800)
  assert.equal(report.byDay[0]?.totalSeconds, -1800)
  assert.equal(formatLocalDate(day(20)), "2025-10-20")
})
