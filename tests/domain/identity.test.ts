import { test } from "node:test"
import assert from "node:assert/strict"
import { encodeId, newId, resolvePrefix } from "../../src/domain/identity.ts"

test("encodeId maps five bytes to eight Crockford base32 chars", () => {
  assert.equal(encodeId(new Uint8Array([0, 0, 0, 0, 0])), "00000000")
  assert.equal(encodeId(new Uint8Array([255, 255, 255, 255, 255])), "zzzzzzzz")
})

test("encodeId excludes ambiguous letters (i, l, o, u)", () => {
  const decoded = encodeId(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]))
  assert.doesNotMatch(decoded, /[ilou]/)
})

test("newId returns eight lowercase Crockford base32 chars", () => {
  for (let i = 0; i < 200; i += 1) {
    assert.match(newId(), /^[0-9abcdefghjkmnpqrstvwxyz]{8}$/)
  }
})

test("newId is collision-resistant across a batch", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newId()))
  assert.equal(ids.size, 1000)
})

test("resolvePrefix resolves a full id or unambiguous prefix", () => {
  const ids = ["7f3a2c19", "7f3a2c1a", "aaaaaaa1"]
  assert.deepEqual(resolvePrefix("7f3a2c19", ids), { status: "unique", id: "7f3a2c19" })
  assert.deepEqual(resolvePrefix("7f3a2c1", ids), {
    status: "ambiguous",
    matches: ["7f3a2c19", "7f3a2c1a"],
  })
  assert.deepEqual(resolvePrefix("aaaa", ids), { status: "unique", id: "aaaaaaa1" })
  assert.deepEqual(resolvePrefix("AAAA", ids), { status: "unique", id: "aaaaaaa1" })
})

test("resolvePrefix reports none for missing or empty prefixes", () => {
  const ids = ["7f3a2c19"]
  assert.deepEqual(resolvePrefix("zzz", ids), { status: "none" })
  assert.deepEqual(resolvePrefix("", ids), { status: "none" })
  assert.deepEqual(resolvePrefix("7f3a2c19extra", ids), { status: "none" })
  assert.deepEqual(resolvePrefix("x", []), { status: "none" })
})
