import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { JsonlEventLog } from "../../src/adapters/out/store/jsonl-event-log.ts"
import { ExportLog } from "../../src/application/export-log.ts"

test("ExportLog returns the raw bytes of the Log, unparsed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "taflog-export-"))
  try {
    const file = join(dir, "events.ndjson")
    const raw =
      '{"v":1,"id":"aaaaaaa1","t":"start","at":"2025-10-23T09:12:00.000Z","project":"acme"}\n{not json\n'
    writeFileSync(file, raw)
    const text = await new ExportLog(new JsonlEventLog(file)).execute()
    assert.equal(text, raw)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("ExportLog returns an empty string when the Log does not exist", async () => {
  const dir = mkdtempSync(join(tmpdir(), "taflog-export-"))
  try {
    const text = await new ExportLog(new JsonlEventLog(join(dir, "events.ndjson"))).execute()
    assert.equal(text, "")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
