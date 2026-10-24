import { UsageError } from "../../../application/errors.ts"

export type IconsProfile = "auto" | "nerd" | "ascii"

export interface GlobalOptions {
  dir: string | null
  json: boolean
  noColor: boolean
  icons: IconsProfile | null
  strict: boolean
  force: boolean
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
    if (arg === "--dir") {
      options.dir = requireValue(argv, index, "--dir")
      index += 1
      continue
    }
    if (arg.startsWith("--dir=")) {
      options.dir = arg.slice("--dir=".length)
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
