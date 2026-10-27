import { test } from "node:test"
import assert from "node:assert/strict"
import { InMemoryEventLog } from "../support/fakes.ts"
import { LogCandidates } from "../../src/application/log-candidates.ts"
import type { Event } from "../../src/domain/events.ts"

const at = (time: string): string => `2025-10-23T${time}:00.000Z`

function seeded(): InMemoryEventLog {
  const events: Event[] = [
    { v: 1, id: "aaaaaaa1", t: "start", at: at("09:00"), project: "acme", description: "new parser" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("09:30"), entry: "aaaaaaa1" },
    { v: 1, id: "ccccccc3", t: "start", at: at("09:30"), project: "acme", description: "review" },
    { v: 1, id: "ddddddd4", t: "stop", at: at("10:00"), entry: "ccccccc3" },
    { v: 1, id: "eeeeeee5", t: "start", at: at("10:00"), project: "beta", description: "emails" },
    { v: 1, id: "fffffff6", t: "stop", at: at("10:30"), entry: "eeeeeee5" },
    {
      v: 1,
      id: "ggggggg7",
      t: "adjust",
      at: at("10:45"),
      date: "2025-10-23",
      project: "beta",
      delta: 600,
    },
    { v: 1, id: "hhhhhhh8", t: "start", at: at("10:30"), project: "gamma", description: "current" },
  ]
  return new InMemoryEventLog(events)
}

test("LogCandidates projects are unique and most-recent-first", async () => {
  const result = await new LogCandidates(seeded()).execute({ kind: "project" })
  assert.deepEqual(result.candidates, ["gamma", "beta", "acme"])
})

test("LogCandidates descriptions are unique and most-recent-first", async () => {
  const result = await new LogCandidates(seeded()).execute({ kind: "description" })
  assert.deepEqual(result.candidates, ["current", "emails", "review", "new parser"])
})

test("LogCandidates filters descriptions by Project case-insensitively", async () => {
  const result = await new LogCandidates(seeded()).execute({
    kind: "description",
    project: "ACME",
  })
  assert.deepEqual(result.candidates, ["review", "new parser"])
})

test("LogCandidates deduplicates case-insensitively and drops blank descriptions", async () => {
  const log = new InMemoryEventLog([
    { v: 1, id: "aaaaaaa1", t: "start", at: at("09:00"), project: "acme", description: "Review" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("09:30"), entry: "aaaaaaa1" },
    { v: 1, id: "ccccccc3", t: "start", at: at("09:30"), project: "acme", description: "review" },
    { v: 1, id: "ddddddd4", t: "stop", at: at("10:00"), entry: "ccccccc3" },
    { v: 1, id: "eeeeeee5", t: "start", at: at("10:00"), project: "acme" },
    { v: 1, id: "fffffff6", t: "stop", at: at("10:30"), entry: "eeeeeee5" },
  ])
  const result = await new LogCandidates(log).execute({ kind: "description", project: "acme" })
  assert.deepEqual(result.candidates, ["review"])
})

test("LogCandidates project order follows event recency, including Adjustments", async () => {
  const log = new InMemoryEventLog([
    { v: 1, id: "aaaaaaa1", t: "start", at: at("09:00"), project: "acme" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("09:30"), entry: "aaaaaaa1" },
    {
      v: 1,
      id: "ccccccc3",
      t: "adjust",
      at: at("12:00"),
      date: "2025-10-23",
      project: "beta",
      delta: 600,
    },
  ])
  const result = await new LogCandidates(log).execute({ kind: "project" })
  assert.deepEqual(result.candidates, ["beta", "acme"])
})

test("LogCandidates ignores tombstoned Entries", async () => {
  const log = new InMemoryEventLog([
    { v: 1, id: "aaaaaaa1", t: "start", at: at("09:00"), project: "gone" },
    { v: 1, id: "bbbbbbb2", t: "stop", at: at("09:30"), entry: "aaaaaaa1" },
    { v: 1, id: "ccccccc3", t: "delete", at: at("10:00"), entry: "aaaaaaa1" },
  ])
  const result = await new LogCandidates(log).execute({ kind: "project" })
  assert.deepEqual(result.candidates, [])
})
