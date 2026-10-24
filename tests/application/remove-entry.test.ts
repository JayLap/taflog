import { test } from "node:test"
import assert from "node:assert/strict"
import { FakeClock, InMemoryEventLog } from "../support/fakes.ts"
import { RemoveEntry } from "../../src/application/remove-entry.ts"
import {
  NothingToRemoveError,
  RunningEntryError,
  UnknownEntryError,
  UsageError,
} from "../../src/application/errors.ts"
import type { Event } from "../../src/domain/events.ts"

const at = "2025-10-23T09:12:00.000Z"

const start = (id: string, project: string): Event => ({
  v: 1,
  id,
  t: "start",
  at,
  project,
})

const stop = (id: string, entry: string): Event => ({
  v: 1,
  id,
  t: "stop",
  at: "2025-10-23T09:36:00.000Z",
  entry,
})

const adjust = (id: string, project: string, delta: number): Event => ({
  v: 1,
  id,
  t: "adjust",
  at,
  date: "2025-10-23",
  project,
  delta,
})

const fixedId = (): string => "ffffffff"

test("RemoveEntry tombstones an Entry by full id", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([start("aaaaaaa1", "acme"), stop("bbbbbbb2", "aaaaaaa1")])
  const result = await new RemoveEntry(clock, log, fixedId).execute({ id: "aaaaaaa1" })

  assert.equal(result.removed.kind, "entry")
  assert.equal(log.events.length, 3)
  assert.deepEqual(log.events[2], {
    v: 1,
    id: "ffffffff",
    t: "delete",
    at: new Date(at).toISOString(),
    entry: "aaaaaaa1",
  })
})

test("RemoveEntry resolves an unambiguous prefix", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([start("aaaaaaa1", "acme"), stop("bbbbbbb2", "aaaaaaa1")])
  const result = await new RemoveEntry(clock, log, fixedId).execute({ id: "aaaa" })
  assert.equal(result.removed.kind, "entry")
  assert.equal(log.events[2]?.t === "delete" ? log.events[2].entry : null, "aaaaaaa1")
})

test("RemoveEntry refuses an ambiguous prefix as a usage error", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([
    adjust("aaaaaaa1", "acme", 600),
    adjust("aaaaaaa2", "beta", 600),
  ])
  await assert.rejects(
    () => new RemoveEntry(clock, log, fixedId).execute({ id: "aaaa" }),
    (error: unknown) => error instanceof UsageError && /ambiguous/.test(error.message),
  )
  assert.equal(log.events.length, 2)
})

test("RemoveEntry reports an unknown id", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog()
  await assert.rejects(
    () => new RemoveEntry(clock, log, fixedId).execute({ id: "zzz" }),
    UnknownEntryError,
  )
  assert.equal(log.events.length, 0)
})

test("RemoveEntry removes the most recent Entry or Adjustment when no id is given", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([
    start("aaaaaaa1", "acme"),
    stop("bbbbbbb2", "aaaaaaa1"),
    adjust("ccccccc3", "beta", -600),
  ])
  const result = await new RemoveEntry(clock, log, fixedId).execute({})
  assert.equal(result.removed.kind, "adjustment")
  assert.equal(log.events[3]?.t === "delete" ? log.events[3].entry : null, "ccccccc3")
})

test("bare rm on an empty log reports nothing to remove", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog()
  await assert.rejects(() => new RemoveEntry(clock, log, fixedId).execute({}), NothingToRemoveError)
})

test("bare rm never removes the open Timer", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([start("aaaaaaa1", "acme")])
  await assert.rejects(() => new RemoveEntry(clock, log, fixedId).execute({}), NothingToRemoveError)
})

test("RemoveEntry refuses to tombstone the open Timer", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([start("aaaaaaa1", "acme")])
  await assert.rejects(
    () => new RemoveEntry(clock, log, fixedId).execute({ id: "aaaaaaa1" }),
    RunningEntryError,
  )
  assert.equal(log.events.length, 1)
})

test("RemoveEntry tombstones an Adjustment", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([adjust("aaaaaaa1", "acme", 600)])
  const result = await new RemoveEntry(clock, log, fixedId).execute({ id: "aaaaaaa1" })
  assert.equal(result.removed.kind, "adjustment")
  assert.equal(result.removed.kind === "adjustment" ? result.removed.adjustment.delta : null, 600)
})

test("RemoveEntry surfaces the skipped-line count from the log", async () => {
  const clock = new FakeClock(at)
  const log = new InMemoryEventLog([adjust("aaaaaaa1", "acme", 600)], 4)
  const result = await new RemoveEntry(clock, log, fixedId).execute({ id: "aaaaaaa1" })
  assert.equal(result.skipped, 4)
})