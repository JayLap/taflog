import { test } from "node:test"
import assert from "node:assert/strict"
import type { Event } from "../../src/domain/events.ts"
import {
  deriveAdjustments,
  deriveEntries,
  deriveTimer,
  reduceEvents,
} from "../../src/domain/reduce.ts"

const at = (time: string): string => `2025-10-23T${time}:00.000Z`

const start = (
  id: string,
  project: string,
  time: string,
  description?: string,
): Event => ({
  v: 1,
  id,
  t: "start",
  at: at(time),
  project,
  ...(description === undefined ? {} : { description }),
})

const stop = (id: string, entry: string, time: string, description?: string): Event => ({
  v: 1,
  id,
  t: "stop",
  at: at(time),
  entry,
  ...(description === undefined ? {} : { description }),
})

const switchTo = (id: string, from: string, project: string, time: string): Event => ({
  v: 1,
  id,
  t: "switch",
  at: at(time),
  from,
  project,
})

const adjust = (id: string, project: string, date: string, delta: number, note?: string): Event => ({
  v: 1,
  id,
  t: "adjust",
  at: at("12:00"),
  date,
  project,
  delta,
  ...(note === undefined ? {} : { note }),
})

const del = (id: string, entry: string): Event => ({
  v: 1,
  id,
  t: "delete",
  at: at("12:00"),
  entry,
})

test("deriveTimer returns null on an empty log", () => {
  assert.equal(deriveTimer([]), null)
  assert.deepEqual(deriveEntries([]), [])
})

test("a start opens a Timer", () => {
  const timer = deriveTimer([start("aaaaaaa1", "acme", "09:12", "new parser")])
  assert.equal(timer?.id, "aaaaaaa1")
  assert.equal(timer?.project, "acme")
  assert.equal(timer?.description, "new parser")
  assert.equal(timer?.start.toISOString(), at("09:12"))
})

test("a stop closes the matching open Entry", () => {
  const events = [start("aaaaaaa1", "acme", "09:12", "new parser"), stop("bbbbbbb2", "aaaaaaa1", "09:36")]
  assert.equal(deriveTimer(events), null)
  const entries = deriveEntries(events)
  assert.equal(entries.length, 1)
  assert.deepEqual(
    { id: entries[0]?.id, project: entries[0]?.project, description: entries[0]?.description },
    { id: "aaaaaaa1", project: "acme", description: "new parser" },
  )
  assert.equal(entries[0]?.start.toISOString(), at("09:12"))
  assert.equal(entries[0]?.end.toISOString(), at("09:36"))
})

test("a stop may override the Description", () => {
  const events = [start("aaaaaaa1", "acme", "09:12", "old"), stop("bbbbbbb2", "aaaaaaa1", "09:36", "new")]
  assert.equal(deriveEntries(events)[0]?.description, "new")
})

test("a switch closes the previous Entry and opens the next at the same instant", () => {
  const events = [
    start("aaaaaaa1", "acme", "09:12"),
    switchTo("bbbbbbb2", "aaaaaaa1", "beta", "09:36"),
    stop("ccccccc3", "bbbbbbb2", "10:42"),
  ]
  const entries = deriveEntries(events)
  assert.equal(entries.length, 2)
  assert.equal(entries[0]?.end.toISOString(), at("09:36"))
  assert.equal(entries[1]?.start.toISOString(), at("09:36"))
  assert.equal(entries[1]?.project, "beta")
  assert.equal(deriveTimer(events), null)
})

test("a switch while idle simply opens a Timer", () => {
  const events = [switchTo("bbbbbbb2", "missing0", "beta", "09:36")]
  assert.equal(deriveTimer(events)?.id, "bbbbbbb2")
  assert.equal(deriveEntries(events).length, 0)
})

test("delete tombstones an Entry", () => {
  const events = [
    start("aaaaaaa1", "acme", "09:12"),
    stop("bbbbbbb2", "aaaaaaa1", "09:36"),
    del("ccccccc3", "aaaaaaa1"),
  ]
  assert.deepEqual(deriveEntries(events), [])
})

test("an orphan Timer is never auto-closed", () => {
  const events = [start("aaaaaaa1", "acme", "09:12")]
  assert.equal(deriveEntries(events).length, 0)
  assert.equal(deriveTimer(events)?.id, "aaaaaaa1")
})

test("adjust events derive Adjustments and delete tombstones them", () => {
  const events = [
    adjust("aaaaaaa1", "acme", "2025-10-23", 3000, "forgot to start"),
    adjust("bbbbbbb2", "beta", "2025-10-23", -1800),
  ]
  const adjustments = deriveAdjustments(events)
  assert.equal(adjustments.length, 2)
  assert.deepEqual(
    { project: adjustments[0]?.project, delta: adjustments[0]?.delta, note: adjustments[0]?.note },
    { project: "acme", delta: 3000, note: "forgot to start" },
  )
  assert.deepEqual(deriveAdjustments([...events, del("ccccccc3", "aaaaaaa1")]).map((a) => a.id), ["bbbbbbb2"])
})

test("reduceEvents returns the whole derived state", () => {
  const state = reduceEvents([start("aaaaaaa1", "acme", "09:12")])
  assert.equal(state.timer?.id, "aaaaaaa1")
  assert.deepEqual(state.entries, [])
  assert.deepEqual(state.adjustments, [])
})

test("an Adjustment is independent of a running Timer", () => {
  const events = [
    start("aaaaaaa1", "acme", "09:12"),
    adjust("bbbbbbb2", "beta", "2025-10-23", 3000),
  ]
  const state = reduceEvents(events)
  assert.equal(state.timer?.id, "aaaaaaa1")
  assert.deepEqual(state.adjustments.map((adjustment) => adjustment.project), ["beta"])
})
