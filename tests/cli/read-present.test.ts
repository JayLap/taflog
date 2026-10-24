import { test } from "node:test"
import assert from "node:assert/strict"
import type { QueryLogResult } from "../../src/application/query-log.ts"
import type { BuildReportResult } from "../../src/application/build-report.ts"
import type { DateRange } from "../../src/application/range.ts"
import { logJson, renderLog } from "../../src/adapters/in/cli/present-log.ts"
import { renderReport, reportJson } from "../../src/adapters/in/cli/present-report.ts"
import { createStyle } from "../../src/adapters/in/cli/style.ts"
import type { Report } from "../../src/domain/report.ts"

const today: DateRange = {
  from: new Date(2025, 9, 23),
  to: new Date(2025, 9, 24),
  fromDate: "2025-10-23",
  toDate: "2025-10-23",
  preset: "today",
}

const week: DateRange = {
  from: new Date(2025, 9, 20),
  to: new Date(2025, 9, 27),
  fromDate: "2025-10-20",
  toDate: "2025-10-26",
  preset: "week",
}

function logResult(): QueryLogResult {
  return {
    skipped: 0,
    range: today,
    project: null,
    query: { from: "2025-10-23", to: "2025-10-23", project: null },
    items: [
      {
        kind: "timed",
        id: "aaaaaaa1",
        project: "acme",
        description: "new parser",
        start: new Date(2025, 9, 23, 9, 12),
        end: new Date(2025, 9, 23, 9, 36),
        durationSeconds: 1440,
      },
      {
        kind: "timed",
        id: "bbbbbbb2",
        project: "acme",
        description: "review",
        start: new Date(2025, 9, 23, 9, 36),
        end: new Date(2025, 9, 23, 10, 42),
        durationSeconds: 3960,
      },
      {
        kind: "adjust",
        id: "ccccccc3",
        project: "acme",
        date: "2025-10-23",
        deltaSeconds: 3000,
        note: "forgot to start",
      },
      {
        kind: "adjust",
        id: "ddddddd4",
        project: "beta",
        date: "2025-10-23",
        deltaSeconds: -1800,
      },
    ],
    totals: { timedSeconds: 5400, adjustedSeconds: 1200, totalSeconds: 6600 },
  }
}

function report(): Report {
  return {
    range: { from: "2025-10-20", to: "2025-10-26", weekStart: "monday" },
    byProject: [
      {
        project: "acme",
        timedSeconds: 60300,
        adjustedSeconds: -1800,
        totalSeconds: 58500,
        adjustmentDays: [{ date: "2025-10-23", deltaSeconds: -1800 }],
        details: [
          {
            description: "new parser",
            totalSeconds: 30600,
            byDay: [
              { date: "2025-10-20", timedSeconds: 3600 },
              { date: "2025-10-21", timedSeconds: 5400 },
            ],
          },
          {
            description: "review",
            totalSeconds: 26100,
            byDay: [{ date: "2025-10-20", timedSeconds: 1800 }],
          },
        ],
      },
      {
        project: "beta",
        timedSeconds: 9900,
        adjustedSeconds: 0,
        totalSeconds: 9900,
        adjustmentDays: [],
        details: [
          {
            description: "emails",
            totalSeconds: 9900,
            byDay: [{ date: "2025-10-20", timedSeconds: 1800 }],
          },
        ],
      },
    ],
    byDay: [
      {
        date: "2025-10-20",
        totalSeconds: 7200,
        projects: [
          { project: "acme", totalSeconds: 5400 },
          { project: "beta", totalSeconds: 1800 },
        ],
      },
      { date: "2025-10-21", totalSeconds: 5400, projects: [{ project: "acme", totalSeconds: 5400 }] },
      { date: "2025-10-22", totalSeconds: 0, projects: [] },
      { date: "2025-10-23", totalSeconds: -1800, projects: [{ project: "acme", totalSeconds: -1800 }] },
      { date: "2025-10-24", totalSeconds: 0, projects: [] },
      { date: "2025-10-25", totalSeconds: 0, projects: [] },
      { date: "2025-10-26", totalSeconds: 0, projects: [] },
    ],
  }
}

function reportResult(): BuildReportResult {
  return { skipped: 0, range: week, report: report() }
}

test("logJson is the frozen version-1 shape", () => {
  assert.deepEqual(JSON.parse(logJson(logResult())), {
    version: 1,
    query: { from: "2025-10-23", to: "2025-10-23", project: null },
    entries: [
      {
        kind: "timed",
        id: "aaaaaaa1",
        project: "acme",
        description: "new parser",
        start: new Date(2025, 9, 23, 9, 12).toISOString(),
        end: new Date(2025, 9, 23, 9, 36).toISOString(),
        durationSeconds: 1440,
      },
      {
        kind: "timed",
        id: "bbbbbbb2",
        project: "acme",
        description: "review",
        start: new Date(2025, 9, 23, 9, 36).toISOString(),
        end: new Date(2025, 9, 23, 10, 42).toISOString(),
        durationSeconds: 3960,
      },
      {
        kind: "adjust",
        id: "ccccccc3",
        date: "2025-10-23",
        project: "acme",
        deltaSeconds: 3000,
        note: "forgot to start",
      },
      {
        kind: "adjust",
        id: "ddddddd4",
        date: "2025-10-23",
        project: "beta",
        deltaSeconds: -1800,
      },
    ],
    totals: { timedSeconds: 5400, adjustedSeconds: 1200, totalSeconds: 6600 },
  })
})

test("logJson --pretty indents but keeps the same shape", () => {
  const pretty = logJson(logResult(), { pretty: true })
  assert.match(pretty, /^\{\n {2}"version": 1,/)
  assert.deepEqual(JSON.parse(pretty), JSON.parse(logJson(logResult())))
})

test("renderLog renders the SPEC §9.2 header and rows", () => {
  const text = renderLog(logResult(), { style: createStyle() })
  const lines = text.trimEnd().split("\n")
  assert.equal(lines[0], "Today · Thu 2025-10-23 · 1h50m")
  assert.match(lines[1] ?? "", /^ {2}09:12 → 09:36.*24m.*acme.*new parser$/)
  assert.match(lines[2] ?? "", /^ {2}09:36 → 10:42.*1h06m.*acme.*review$/)
  assert.match(lines[3] ?? "", /\+50m.*acme.*adjustment · forgot to start$/)
  assert.match(lines[4] ?? "", /−30m.*beta.*adjustment$/)
})

test("renderLog --ids shows each identity", () => {
  const text = renderLog(logResult(), { style: createStyle(), ids: true })
  for (const id of ["aaaaaaa1", "bbbbbbb2", "ccccccc3", "ddddddd4"]) {
    assert.match(text, new RegExp(id))
  }
})

test("renderLog truncates a long Description to the terminal width", () => {
  const result = logResult()
  result.items[0] = {
    ...result.items[0]!,
    description: "a very long description that will not fit on a narrow terminal at all",
  }
  const line = renderLog(result, { style: createStyle({ width: 50 }) })
    .split("\n")
    .find((item) => item.includes("09:12"))!
  assert.ok(line.length <= 50, `line was ${line.length} chars: ${JSON.stringify(line)}`)
  assert.match(line, /…$/)
})

test("renderLog uses an ASCII one-line empty state", () => {
  const result = logResult()
  result.items = []
  const text = renderLog(result, { style: createStyle({ icons: "ascii" }) })
  assert.match(text, /No entries/)
  assert.doesNotMatch(text, /[●○]/)
})

test("ascii icons and colour are opt-in through the Style", () => {
  const plain = renderLog(logResult(), { style: createStyle({ icons: "ascii" }) })
  assert.doesNotMatch(plain, /\u001b\[/)
  const coloured = renderLog(logResult(), { style: createStyle({ color: true }) })
  assert.match(coloured, /\u001b\[/)
})

test("reportJson always carries version 1, byProject, and byDay", () => {
  const parsed = JSON.parse(reportJson(reportResult()))
  assert.equal(parsed.version, 1)
  assert.deepEqual(parsed.range, {
    from: "2025-10-20",
    to: "2025-10-26",
    weekStart: "monday",
  })
  assert.equal(parsed.byProject[0].project, "acme")
  assert.equal(parsed.byProject[0].details[0].description, "new parser")
  assert.deepEqual(parsed.byProject[0].details[0].byDay[0], {
    date: "2025-10-20",
    timedSeconds: 3600,
  })
  assert.equal(parsed.byDay.length, 7)
  assert.equal(parsed.byDay[0].projects[1].project, "beta")
  // Internal details used only by the terminal must not leak into JSON.
  assert.equal("adjustmentDays" in parsed.byProject[0], false)
})

test("report summary reconciles timed, adjusted, and total", () => {
  const text = renderReport(reportResult(), { style: createStyle() })
  const lines = text.trimEnd().split("\n")
  assert.match(lines[0] ?? "", /^Week 43 · Mon 20 → Sun 26 Oct 2025 · 19h00m$/)
  assert.match(lines[1] ?? "", /^ {2}acme\s+16h15m\s+timed 16h45m · adjusted −30m$/)
  assert.match(lines[2] ?? "", /^ {2}beta\s+2h45m\s+timed\s+2h45m$/)
})

test("report --by day renders a weekday grid with a Total row", () => {
  const text = renderReport(reportResult(), { style: createStyle(), grid: true })
  const lines = text.trimEnd().split("\n")
  assert.match(lines[1] ?? "", /Mon/)
  assert.match(lines[1] ?? "", /Fri/)
  assert.match(lines[1] ?? "", /Total/)
  assert.match(lines.at(-1) ?? "", /Total/)
  assert.doesNotMatch(lines[1] ?? "", /Sat/)
  assert.match(lines.find((line) => line.includes("acme")) ?? "", /2h00|1h30/)
  const total = lines.at(-1) ?? ""
  assert.match(total, /Total/)
  assert.match(total, /2h00/)
})

test("report --details adds Description sub-rows and blank days", () => {
  const text = renderReport(reportResult(), { style: createStyle(), grid: true, details: true })
  const lines = text.trimEnd().split("\n")
  assert.match(lines.find((line) => line.includes("new parser")) ?? "", /1h30/)
  const review = lines.find((line) => line.includes("review")) ?? ""
  assert.match(review, /0h30/)
  assert.match(text, /adjustments/)
  const adjustments = lines.find((line) => line.includes("adjustments")) ?? ""
  assert.match(adjustments, /−30m/)
  const acme = lines.find((line) => /^ {2}acme/.test(line)) ?? ""
  const subRows = lines.filter((line) => /^ {4}/.test(line))
  assert.ok(acme.length > 0 && subRows.length >= 4)
})

test("report uses a one-line empty state", () => {
  const empty = reportResult()
  empty.report.byProject = []
  empty.report.byDay = []
  assert.match(renderReport(empty, { style: createStyle() }), /No time tracked/)
})
