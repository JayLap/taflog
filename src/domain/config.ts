import { isWeekday, type WeekStart, type Weekday } from "./datetime.ts"
import { formatDurationInput } from "./duration.ts"

/**
 * The configuration schema (SPEC §7): value unions, the resolved wrapper, and
 * the canonical key order. Pure types and constants, shared by the config
 * adapter that resolves values and the CLI that presents them, so the two
 * cannot drift apart across the ADR-0005 seam.
 */

/** Colour policy applies to `auto` TTY detection (SPEC §7, §9.4). */
export type ColorPolicy = "auto" | "always" | "never"

/** Glyph profile (SPEC §7, §9.4). */
export type IconsProfile = "auto" | "nerd" | "ascii"

/** Target seconds per weekday; `null` leaves that weekday unscaled (SPEC §7). */
export type DayTargets = Record<Weekday, number | null>

/** The fully-populated, validated configuration (SPEC §7). */
export interface Config {
  version: 1
  dir: string
  weekStart: WeekStart
  maxTimerHours: number
  color: ColorPolicy
  icons: IconsProfile
  /** `report --normalize` rounding unit, in seconds (SPEC §7). */
  reportStep: number
  /** Per-weekday `report --normalize` targets in seconds; `null` = off. */
  dayTargets: DayTargets
}

/** A config file is a partial `Config`; every key is optional (SPEC §7). */
export type PartialConfig = Partial<Omit<Config, "dayTargets">> & {
  dayTargets?: Partial<DayTargets>
}

/** Scalar keys plus one `dayTargets.<weekday>` key per weekday (SPEC §7). */
export type DayTargetKey = `dayTargets.${Weekday}`
export type ConfigKey = Exclude<keyof Config, "dayTargets"> | DayTargetKey

const DAY_TARGET_PREFIX = "dayTargets."

/** The `dayTargets.<weekday>` key for a weekday. */
export function dayTargetKey(weekday: Weekday): DayTargetKey {
  return `${DAY_TARGET_PREFIX}${weekday}`
}

/** The weekday of a `dayTargets.<weekday>` key, or `null` for any other key. */
export function weekdayOfKey(key: string): Weekday | null {
  if (!key.startsWith(DAY_TARGET_PREFIX)) return null
  const name = key.slice(DAY_TARGET_PREFIX.length)
  return isWeekday(name) ? name : null
}

/** Built-in targets: 7h30m Monday–Thursday, 5h30m Friday, off at the weekend. */
export const DEFAULT_DAY_TARGETS: DayTargets = {
  sunday: null,
  monday: 7.5 * 3600,
  tuesday: 7.5 * 3600,
  wednesday: 7.5 * 3600,
  thursday: 7.5 * 3600,
  friday: 5.5 * 3600,
  saturday: null,
}

/** Default `reportStep`: five minutes. */
export const DEFAULT_REPORT_STEP = 5 * 60

/** Canonical key order: the SPEC §7 table, used for output and file writes. */
export const CONFIG_KEYS: readonly ConfigKey[] = [
  "version",
  "dir",
  "weekStart",
  "maxTimerHours",
  "color",
  "icons",
  "reportStep",
  ...(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const).map(
    dayTargetKey,
  ),
]

/** Where an effective value came from, highest precedence first (SPEC §7). */
export type ConfigSource = "flag" | "env" | "file" | "default"

export interface Resolved<T> {
  value: T
  source: ConfigSource
}

/** Every effective value plus its source, for `taflog config` (SPEC §7). */
export interface ResolvedConfig {
  version: Resolved<1>
  dir: Resolved<string>
  weekStart: Resolved<WeekStart>
  maxTimerHours: Resolved<number>
  color: Resolved<ColorPolicy>
  icons: Resolved<IconsProfile>
  reportStep: Resolved<number>
  dayTargets: Record<Weekday, Resolved<number | null>>
}

/** The effective value and source for any config key, `dayTargets.*` included. */
export function resolvedFor(view: ResolvedConfig, key: ConfigKey): Resolved<unknown> {
  const weekday = weekdayOfKey(key)
  if (weekday !== null) return view.dayTargets[weekday]
  return view[key as Exclude<ConfigKey, DayTargetKey>]
}

/**
 * A value in the text form a person types: durations as `7h30m`, `off` for no
 * day target. Other values pass through. Shared by `config`, `set`, and the
 * config file so the three agree.
 */
export function displayConfigValue(key: ConfigKey, value: string | number | null): string | number {
  if (weekdayOfKey(key) !== null) return value === null ? "off" : formatDurationInput(value as number)
  if (key === "reportStep") return formatDurationInput(value as number)
  return value as string | number
}
