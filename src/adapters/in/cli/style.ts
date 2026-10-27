import type { ColorPolicy, IconsProfile } from "../../../domain/config.ts"
import { formatDuration } from "../../../domain/duration.ts"

/** One glyph per meaning (SPEC §9.4). */
export interface Glyphs {
  running: string
  idle: string
  project: string
  add: string
  sub: string
  date: string
}

const AUTO: Glyphs = {
  running: "●",
  idle: "○",
  project: "·",
  add: "+",
  sub: "−",
  date: "·",
}

const NERD: Glyphs = {
  running: "󰔛",
  idle: "󰅶",
  project: "󰉋",
  add: "󰐕",
  sub: "󰍴",
  date: "󰃭",
}

const ASCII: Glyphs = {
  running: "*",
  idle: "o",
  project: "-",
  add: "+",
  sub: "-",
  date: "-",
}

const PROFILES: Record<IconsProfile, Glyphs> = {
  auto: AUTO,
  nerd: NERD,
  ascii: ASCII,
}

export interface StyleOptions {
  icons?: IconsProfile
  color?: boolean
  /** Terminal width; `undefined` or `Infinity` disables truncation. */
  width?: number
}

/** Presentation policy plus the glyphs and colour helpers presenters share. */
export interface Style {
  icons: IconsProfile
  glyphs: Glyphs
  color: boolean
  width: number
  paint(code: string, text: string): string
  project(text: string): string
  meta(text: string): string
  running(text: string): string
  add(text: string): string
  sub(text: string): string
  /** `+50m` / `−30m`, following the glyph profile. */
  signed(deltaSeconds: number): string
  /** A duration whose negative sign follows the glyph profile (`-30m` in ascii). */
  duration(seconds: number): string
  truncate(text: string, max: number): string
}

const CODES = {
  reset: "\u001b[0m",
  project: "\u001b[36m",
  meta: "\u001b[2m",
  running: "\u001b[32m",
  add: "\u001b[33m",
  sub: "\u001b[31m",
} as const

export function createStyle(options: StyleOptions = {}): Style {
  const icons = options.icons ?? "auto"
  const glyphs = PROFILES[icons]
  const color = options.color ?? false
  const width = options.width ?? Number.POSITIVE_INFINITY

  const paint = (code: string, text: string): string =>
    color && text !== "" ? `${code}${text}${CODES.reset}` : text

  return {
    icons,
    glyphs,
    color,
    width,
    paint,
    project: (text) => paint(CODES.project, text),
    meta: (text) => paint(CODES.meta, text),
    running: (text) => paint(CODES.running, text),
    add: (text) => paint(CODES.add, text),
    sub: (text) => paint(CODES.sub, text),
    signed: (deltaSeconds) => {
      const sign = deltaSeconds < 0 ? glyphs.sub : glyphs.add
      return `${sign}${formatDuration(Math.abs(deltaSeconds))}`
    },
    duration: (seconds) =>
      seconds < 0 ? `${glyphs.sub}${formatDuration(Math.abs(seconds))}` : formatDuration(seconds),
    truncate: (text, max) => truncate(text, max),
  }
}

/** Truncate plain text to `max` cells with a single `…`; never wraps. */
export function truncate(text: string, max: number): string {
  if (!Number.isFinite(max) || max <= 0) return text
  if (text.length <= max) return text
  if (max === 1) return "…"
  return `${text.slice(0, max - 1)}…`
}

/**
 * Effective glyph profile: `--icons` > `TAFLOG_ICONS` > config > `auto`
 * (SPEC §7, §9.4). An unset or invalid env var falls through to `configured`.
 */
export function resolveIcons(
  flag: IconsProfile | null,
  env: NodeJS.ProcessEnv = process.env,
  configured: IconsProfile = "auto",
): IconsProfile {
  if (flag !== null) return flag
  const value = env.TAFLOG_ICONS
  if (value === "auto" || value === "nerd" || value === "ascii") return value
  return configured
}

/**
 * Colour is off for `--no-color`, `NO_COLOR`, `color: "never"`, or a non-TTY;
 * `color: "always"` forces it on (SPEC §9.4). `--json` is never coloured by its
 * presenter.
 */
export function resolveColor(
  noColor: boolean,
  env: NodeJS.ProcessEnv = process.env,
  isTTY = false,
  policy: ColorPolicy = "auto",
): boolean {
  if (noColor) return false
  if (env.NO_COLOR !== undefined) return false
  if (policy === "always") return true
  if (policy === "never") return false
  return isTTY
}
