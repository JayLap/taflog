import { test } from "node:test"
import assert from "node:assert/strict"
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Event } from "../../src/domain/events.ts"
import { CorruptLogError } from "../../src/domain/errors.ts"
import { JsonlEventLog } from "../../src/adapters/out/store/jsonl-event-log.ts"

const startEvent: Event = {
  v: 1,
  id: "aaaaaaa1",
  t: "start",
  at: "2025-10-23T09:12:00.000Z",
  project: "acme",
}
const stopEvent: Event = {
  v: 1,
  id: "bbbbbbb2",
  t: "stop",
  at: "2025-10-23T09:36:00.000Z",
  entry: "aaaaaaa1",
}

function withTempDir<T>(fn: (file: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "taflog-store-"))
  try {
    return fn(join(dir, "events.ndjson"))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("readAll returns empty state when the file does not exist", async () => {
  await withTempDir(async (file) => {
    const log = new JsonlEventLog(file)
    assert.deepEqual(await log.readAll(), { events: [], skipped: 0 })
  })
})

test("append writes exactly one event per line", async () => {
  await withTempDir(async (file) => {
    const log = new JsonlEventLog(file)
    await log.append(startEvent)
    await log.append(stopEvent)
    const raw = readFileSync(file, "utf8")
    assert.ok(raw.endsWith("\n"))
    const lines = raw.split("\n").filter((line) => line !== "")
    assert.equal(lines.length, 2)
    assert.deepEqual(JSON.parse(lines[0]!), startEvent)
    assert.deepEqual(JSON.parse(lines[1]!), stopEvent)
  })
})

test("readAll round-trips appended events", async () => {
  await withTempDir(async (file) => {
    const log = new JsonlEventLog(file)
    await log.append(startEvent)
    await log.append(stopEvent)
    assert.deepEqual(await log.readAll(), { events: [startEvent, stopEvent], skipped: 0 })
  })
})

test("readAll skips and counts corrupt lines", async () => {
  await withTempDir(async (file) => {
    writeFileSync(file, `${JSON.stringify(startEvent)}\n{not json\n\n${JSON.stringify(stopEvent)}\n`)
    const result = await new JsonlEventLog(file).readAll()
    assert.deepEqual(result.events, [startEvent, stopEvent])
    assert.equal(result.skipped, 1)
  })
})

test("readAll counts structurally invalid events as skipped", async () => {
  await withTempDir(async (file) => {
    appendFileSync(file, `${JSON.stringify({ hello: "world" })}\n`)
    const result = await new JsonlEventLog(file).readAll()
    assert.equal(result.events.length, 0)
    assert.equal(result.skipped, 1)
  })
})

test("strict mode fails on corrupt lines instead of skipping", async () => {
  await withTempDir(async (file) => {
    appendFileSync(file, `${JSON.stringify(startEvent)}\nbroken\n`)
    const log = new JsonlEventLog(file, { strict: true })
    await assert.rejects(
      () => log.readAll(),
      (error: unknown) => error instanceof CorruptLogError && error.skipped === 1,
    )
  })
})
