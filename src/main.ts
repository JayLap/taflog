#!/usr/bin/env node
import { version } from "./version.ts"

/**
 * taflog entry point (composition root, SPEC §3).
 *
 * Phase 0: usage and version only. Later phases wire
 * adapters -> use cases -> cli here, by hand (no DI framework).
 */
const USAGE = `taflog — minimalist CLI time tracker

Usage:
  taflog start <project> [description]
  taflog stop [description]
  taflog switch <project> [description]
  taflog status
  taflog log [filters]
  taflog report [filters]
  taflog add <project> <duration> [--date D] [--note N]
  taflog sub <project> <duration> [--date D] [--note N]
  taflog rm [<id>]
  taflog config [<key>]
  taflog set <key> <value>
  taflog export

Global flags:
  --dir <path>              data directory
  --json                    machine-readable output
  --no-color                disable colour
  --icons <auto|nerd|ascii> glyph profile
  --strict                  fail on unreadable log lines
  -h, --help                show this help
  -V, --version             show version

Docs: README.md · SPEC.md · PLAN.md · GLOSSARY.md
`

const args = process.argv.slice(2)

if (args.includes("-h") || args.includes("--help") || args[0] === "help") {
  process.stdout.write(USAGE)
  process.exit(0)
}

if (args.includes("-V") || args.includes("--version")) {
  process.stdout.write(`${version()}\n`)
  process.exit(0)
}

// Phase 0 stub: command dispatch lands in Phase 1.
if (args.length === 0) {
  process.stdout.write(USAGE)
  process.exit(0)
}

process.stderr.write(`taflog: not implemented yet: ${args.join(" ")}\n`)
process.stderr.write("Run `taflog --help` for usage.\n")
process.exit(2)
