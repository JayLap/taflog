import { test } from "node:test"
import assert from "node:assert/strict"
import { encodeId, newId } from "../../src/domain/identity.ts"

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
