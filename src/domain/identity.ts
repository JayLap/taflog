import { randomBytes } from "node:crypto"

/**
 * Event and Entry identity (SPEC §4.4). Eight lowercase Crockford base32
 * characters derived from 40 bits of entropy.
 */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz"

/** Encode bytes as Crockford base32, most-significant bit first. Pure. */
export function encodeId(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let encoded = ""
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      encoded += ALPHABET[(value >> bits) & 31]!
    }
  }
  if (bits > 0) {
    encoded += ALPHABET[(value << (5 - bits)) & 31]!
  }
  return encoded
}

/** A fresh 8-character id from 40 bits of `crypto.randomBytes`. */
export function newId(): string {
  return encodeId(randomBytes(5))
}
