import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import {
  CONFIG_KEYS,
  type ColorPolicy,
  type Config,
  type ConfigKey,
  type ConfigSource,
  type IconsProfile,
  type PartialConfig,
  type Resolved,
  type ResolvedConfig,
} from "../../../domain/config.ts"
import type { WeekStart } from "../../../domain/datetime.ts"
import { DEFAULT_MAX_TIMER_HOURS } from "../../../domain/timer.ts"
import { defaultDataDir } from "../store/paths.ts"
import { ConfigError } from "./errors.ts"

/** Values supplied by command-line flags; unset flags are `null`. */
export interface ConfigFlags {
  dir: string | null
  weekStart: WeekStart | null
  maxTimerHours: number | null
  color: ColorPolicy | null
  icons: IconsProfile | null
}

export interface ResolveConfigOptions {
  /** Values read from the config file (already validated). */
  file?: PartialConfig
  /** Values supplied by CLI flags. */
  flags?: Partial<ConfigFlags>
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  /** Override the built-in defaults (mainly for tests). */
  defaults?: Partial<Config>
}

export function isConfigKey(key: string): key is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(key)
}

/** Validate a parsed JSON value into a partial config; unknown keys fail. */
export function parseConfigFile(raw: unknown): PartialConfig {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ConfigError("config must be a JSON object")
  }
  const source = raw as Record<string, unknown>
  for (const key of Object.keys(source)) {
    if (!isConfigKey(key)) throw new ConfigError(`unknown config key: ${key}`)
  }

  const config: PartialConfig = {}
  if ("version" in source) config.version = parseVersion(source.version)
  if ("dir" in source) config.dir = parseDir(source.dir)
  if ("weekStart" in source) config.weekStart = parseWeekStart(source.weekStart)
  if ("maxTimerHours" in source) config.maxTimerHours = parseMaxTimerHours(source.maxTimerHours)
  if ("color" in source) config.color = parseColor(source.color)
  if ("icons" in source) config.icons = parseIcons(source.icons)
  return config
}

/** Validate one `set <key> <value>` argument into a typed value. */
export function parseCliValue(key: ConfigKey, raw: string): string | number {
  switch (key) {
    case "version":
      return parseVersion(Number(raw))
    case "dir":
      return parseDir(raw)
    case "weekStart":
      return parseWeekStart(raw)
    case "maxTimerHours":
      return parseMaxTimerHours(Number(raw))
    case "color":
      return parseColor(raw)
    case "icons":
      return parseIcons(raw)
  }
}

/**
 * Resolve every key with strict precedence `--flag` > env > file > default
 * (SPEC §7). Pure: no filesystem access, so the precedence table is testable.
 */
export function resolveConfig(options: ResolveConfigOptions = {}): ResolvedConfig {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const file = options.file ?? {}
  const flags = options.flags ?? {}
  const defaults: Config = {
    version: 1,
    dir: defaultDataDir(env, platform),
    weekStart: "monday",
    maxTimerHours: DEFAULT_MAX_TIMER_HOURS,
    color: "auto",
    icons: "auto",
    ...options.defaults,
  }

  const envDir = nonEmpty(env.TAFLOG_DIR) ?? null
  const envIcons = parseEnvIcons(env.TAFLOG_ICONS)
  const envColor: ColorPolicy | null = env.NO_COLOR !== undefined ? "never" : null

  return {
    version: first([[file.version ?? null, "file"]], defaults.version),
    dir: first(
      [
        [flags.dir ?? null, "flag"],
        [envDir, "env"],
        [file.dir ?? null, "file"],
      ],
      defaults.dir,
    ),
    weekStart: first(
      [
        [flags.weekStart ?? null, "flag"],
        [file.weekStart ?? null, "file"],
      ],
      defaults.weekStart,
    ),
    maxTimerHours: first(
      [
        [flags.maxTimerHours ?? null, "flag"],
        [file.maxTimerHours ?? null, "file"],
      ],
      defaults.maxTimerHours,
    ),
    color: first(
      [
        [flags.color ?? null, "flag"],
        [envColor, "env"],
        [file.color ?? null, "file"],
      ],
      defaults.color,
    ),
    icons: first(
      [
        [flags.icons ?? null, "flag"],
        [envIcons, "env"],
        [file.icons ?? null, "file"],
      ],
      defaults.icons,
    ),
  }
}

/** Result of a successful `set`: the canonical key and its typed value. */
export interface SetConfigValueResult {
  key: ConfigKey
  value: string | number
}

/**
 * Validate one key, merge it over the stored file, and write the result back
 * (SPEC §7). Leaves the file untouched if validation fails.
 */
export async function setConfigValue(
  store: JsonConfigStore,
  key: string,
  raw: string,
): Promise<SetConfigValueResult> {
  if (!isConfigKey(key)) throw new ConfigError(`unknown config key: ${key}`)
  const value = parseCliValue(key, raw)
  const merged = { ...(await store.read()), [key]: value } as PartialConfig
  await store.write(merged)
  return { key, value }
}

/** Reads and writes the versioned JSON config file (ADR-0002, SPEC §7). */
export class JsonConfigStore {
  private readonly file: string

  constructor(file: string) {
    this.file = file
  }

  /** Parse and validate the file; a missing or empty file is `{}`. */
  async read(): Promise<PartialConfig> {
    const raw = await this.readRaw()
    return raw === null ? {} : parseConfigFile(raw)
  }

  /** Read and JSON-parse the raw file, or `null` when it is missing/empty. */
  async readRaw(): Promise<unknown> {
    let text: string
    try {
      text = await readFile(this.file, "utf8")
    } catch (error) {
      if (isNotFound(error)) return null
      throw error
    }
    if (text.trim() === "") return null
    try {
      return JSON.parse(text)
    } catch {
      throw new ConfigError(`invalid config JSON: ${this.file}`)
    }
  }

  /** Write only the keys that are present, in canonical order, owner-only. */
  async write(config: PartialConfig): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    const ordered: Record<string, unknown> = {}
    for (const key of CONFIG_KEYS) {
      const value = config[key]
      if (value !== undefined) ordered[key] = value
    }
    await writeFile(this.file, `${JSON.stringify(ordered, null, 2)}\n`, { mode: 0o600 })
  }
}

function first<T>(candidates: Array<[T | null, ConfigSource]>, fallback: T): Resolved<T> {
  for (const [value, source] of candidates) {
    if (value !== null) return { value, source }
  }
  return { value: fallback, source: "default" }
}

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value.trim() === "" ? undefined : value
}

function parseVersion(value: unknown): 1 {
  if (value !== 1) throw new ConfigError(`invalid version: ${String(value)} (expected 1)`)
  return 1
}

function parseDir(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ConfigError("invalid dir: expected a non-empty path")
  }
  return value
}

function parseWeekStart(value: unknown): WeekStart {
  if (value === "monday" || value === "sunday") return value
  throw new ConfigError(`invalid weekStart: ${String(value)}`)
}

function parseMaxTimerHours(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value
  throw new ConfigError(`invalid maxTimerHours: ${String(value)}`)
}

function parseColor(value: unknown): ColorPolicy {
  if (value === "auto" || value === "always" || value === "never") return value
  throw new ConfigError(`invalid color: ${String(value)}`)
}

function parseIcons(value: unknown): IconsProfile {
  if (value === "auto" || value === "nerd" || value === "ascii") return value
  throw new ConfigError(`invalid icons: ${String(value)}`)
}

function parseEnvIcons(value: string | undefined): IconsProfile | null {
  if (value === "auto" || value === "nerd" || value === "ascii") return value
  return null
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ENOENT"
  )
}
