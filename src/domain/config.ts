import type { WeekStart } from "./datetime.ts"

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

/** The fully-populated, validated configuration (SPEC §7). */
export interface Config {
  version: 1
  dir: string
  weekStart: WeekStart
  maxTimerHours: number
  color: ColorPolicy
  icons: IconsProfile
}

/** A config file is a partial `Config`; every key is optional (SPEC §7). */
export type PartialConfig = Partial<Config>
export type ConfigKey = keyof Config

/** Canonical key order: the SPEC §7 table, used for output and file writes. */
export const CONFIG_KEYS: readonly ConfigKey[] = [
  "version",
  "dir",
  "weekStart",
  "maxTimerHours",
  "color",
  "icons",
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
}
