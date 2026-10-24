import { UsageError } from "../../../application/errors.ts"

export type IconsProfile = "auto" | "nerd" | "ascii"
export type ReportBy = "project" | "day"

export interface GlobalOptions {
  dir: string | null
  json: boolean
  noColor: boolean
  icons: IconsProfile | null
  strict: boolean
  force: boolean
  date: string | null
  note: string | null
  today: boolean
  week: boolean
  month: boolean
  project: string | null
  from: string | null
  to: string | null
  limit: number | null
  ids: boolean
  by: ReportBy | null
  details: boolean
  pretty: boolean
  seconds: boolean
  help: boolean
  version: boolean
}

export interface ParsedArgs {
  command: string | null
  operands: string[]
  options: GlobalOptions
}

/**
 * Parse `argv` into a command, its operands, and global options. Global flags
 * are accepted in either position (SPEC §8.2). Pure; throws `UsageError`.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  let command: string | null = null
  const operands: string[] = []
  const options: GlobalOptions = {
    dir: null,
    json: false,
    noColor: false,
    icons: null,
    strict: false,
    force: false,
    date: null,
    note: null,
    today: false,
    week: false,
    month: false,
    project: null,
    from: null,
    to: null,
    limit: null,
    ids: false,
    by: null,
    details: false,
    pretty: false,
    seconds: false,
    help: false,
    version: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!
    if (arg === "--") {
      operands.push(...argv.slice(index + 1))
      break
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true
      continue
    }
    if (arg === "-V" || arg === "--version") {
      options.version = true
      continue
    }
    if (arg === "--json") {
      options.json = true
      continue
    }
    if (arg === "--no-color") {
      options.noColor = true
      continue
    }
    if (arg === "--strict") {
      options.strict = true
      continue
    }
    if (arg === "--force") {
      options.force = true
      continue
    }
    if (arg === "--today") {
      options.today = true
      continue
    }
    if (arg === "--week") {
      options.week = true
      continue
    }
    if (arg === "--month") {
      options.month = true
      continue
    }
    if (arg === "--ids") {
      options.ids = true
      continue
    }
    if (arg === "--details") {
      options.details = true
      continue
    }
    if (arg === "--pretty") {
      options.pretty = true
      continue
    }
    if (arg === "--seconds") {
      options.seconds = true
      continue
    }
    if (arg === "--project") {
      options.project = requireValue(argv, index, "--project")
      index += 1
      continue
    }
    if (arg.startsWith("--project=")) {
      options.project = arg.slice("--project=".length)
      continue
    }
    if (arg === "--from") {
      options.from = requireValue(argv, index, "--from")
      index += 1
      continue
    }
    if (arg.startsWith("--from=")) {
      options.from = arg.slice("--from=".length)
      continue
    }
    if (arg === "--to") {
      options.to = requireValue(argv, index, "--to")
      index += 1
      continue
    }
    if (arg.startsWith("--to=")) {
      options.to = arg.slice("--to=".length)
      continue
    }
    if (arg === "--limit") {
      options.limit = parseLimit(requireValue(argv, index, "--limit"))
      index += 1
      continue
    }
    if (arg.startsWith("--limit=")) {
      options.limit = parseLimit(arg.slice("--limit=".length))
      continue
    }
    if (arg === "--by") {
      options.by = parseBy(requireValue(argv, index, "--by"))
      index += 1
      continue
    }
    if (arg.startsWith("--by=")) {
      options.by = parseBy(arg.slice("--by=".length))
      continue
    }
    if (arg === "--dir") {
      options.dir = requireValue(argv, index, "--dir")
      index += 1
      continue
    }
    if (arg.startsWith("--dir=")) {
      options.dir = arg.slice("--dir=".length)
      continue
    }
    if (arg === "--date") {
      options.date = requireValue(argv, index, "--date")
      index += 1
      continue
    }
    if (arg.startsWith("--date=")) {
      options.date = arg.slice("--date=".length)
      continue
    }
    if (arg === "--note") {
      options.note = requireValue(argv, index, "--note")
      index += 1
      continue
    }
    if (arg.startsWith("--note=")) {
      options.note = arg.slice("--note=".length)
      continue
    }
    if (arg === "--icons") {
      options.icons = parseIcons(requireValue(argv, index, "--icons"))
      index += 1
      continue
    }
    if (arg.startsWith("--icons=")) {
      options.icons = parseIcons(arg.slice("--icons=".length))
      continue
    }
    if (arg.startsWith("-")) {
      throw new UsageError(`unknown option: ${arg}`)
    }
    if (command === null) {
      command = arg
    } else {
      operands.push(arg)
    }
  }

  return { command, operands, options }
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1]
  if (value === undefined) throw new UsageError(`${flag} requires a value`)
  return value
}

function parseIcons(value: string): IconsProfile {
  if (value === "auto" || value === "nerd" || value === "ascii") return value
  throw new UsageError(`invalid --icons value: ${value}`)
}

function parseLimit(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) <= 0) {
    throw new UsageError(`invalid --limit value: ${value}`)
  }
  return Number(value)
}

function parseBy(value: string): ReportBy {
  if (value === "project" || value === "day") return value
  throw new UsageError(`invalid --by value: ${value}`)
}
