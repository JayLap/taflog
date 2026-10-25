import type { WeekStart } from "../../../domain/datetime.ts"
import type { IconsProfile } from "./args.ts"
import { createStyle, type ColorPolicy, type Style } from "./style.ts"

/** Where an effective config value came from (SPEC §7). */
export type ConfigSource = "flag" | "env" | "file" | "default"

export interface ResolvedValue<T> {
  value: T
  source: ConfigSource
}

/** The CLI's view of effective configuration; mirrors the config adapter. */
export interface ConfigView {
  version: ResolvedValue<number>
  dir: ResolvedValue<string>
  weekStart: ResolvedValue<WeekStart>
  maxTimerHours: ResolvedValue<number>
  color: ResolvedValue<ColorPolicy>
  icons: ResolvedValue<IconsProfile>
}

/** Print order: the SPEC §7 table, so output is stable and reviewable. */
export const CONFIG_ORDER: readonly (keyof ConfigView)[] = [
  "version",
  "dir",
  "weekStart",
  "maxTimerHours",
  "color",
  "icons",
]

export interface RenderConfigOptions {
  style?: Style
  /** Print only this key's value, for `config <key>`. */
  key?: keyof ConfigView
}

/**
 * Terminal presenter for `taflog config` (SPEC §7). Without a key it prints
 * one row per key: name, effective value, and source. With a key it prints
 * only the value, so `taflog config dir` is scriptable.
 */
export function renderConfig(view: ConfigView, options: RenderConfigOptions = {}): string {
  const style = options.style ?? createStyle()
  if (options.key !== undefined) {
    return `${String(view[options.key].value)}\n`
  }

  const rows = CONFIG_ORDER.map((key) => ({
    key,
    value: String(view[key].value),
    source: view[key].source,
  }))
  const keyWidth = Math.max(...rows.map((row) => row.key.length))
  const valueWidth = Math.max(...rows.map((row) => row.value.length))
  return (
    rows
      .map(
        (row) =>
          `${row.key.padEnd(keyWidth)}  ${row.value.padEnd(valueWidth)}  ${style.meta(row.source)}`,
      )
      .join("\n") + "\n"
  )
}

export interface ConfigJsonOptions {
  pretty?: boolean
  /** Emit a single key instead of the whole effective configuration. */
  key?: keyof ConfigView
}

/** JSON presenter for `config`; frozen `version: 1` (SPEC §9.5). */
export function configJson(view: ConfigView, options: ConfigJsonOptions = {}): string {
  if (options.key !== undefined) {
    const { value, source } = view[options.key]
    return `${JSON.stringify(
      { version: 1, key: options.key, value, source },
      null,
      options.pretty === true ? 2 : undefined,
    )}\n`
  }

  const config: Record<string, ResolvedValue<unknown>> = {}
  for (const key of CONFIG_ORDER) {
    config[key] = { value: view[key].value, source: view[key].source }
  }
  return `${JSON.stringify(
    { version: 1, config },
    null,
    options.pretty === true ? 2 : undefined,
  )}\n`
}

/** Confirmation for `set`: the canonical key and the value written. */
export function renderSet(result: { key: string; value: string | number }): string {
  return `${result.key} = ${String(result.value)}\n`
}
