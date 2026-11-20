import {
  CONFIG_KEYS,
  type ConfigKey,
  displayConfigValue,
  resolvedFor,
  type Resolved,
  type ResolvedConfig,
} from "../../../domain/config.ts"
import { createStyle, sanitizeForTerminal, type Style } from "./style.ts"

export interface RenderConfigOptions {
  style?: Style
  /** Print only this key's value, for `config <key>`. */
  key?: ConfigKey
}

/**
 * Terminal presenter for `taflog config` (SPEC §7). Without a key it prints
 * one row per key: name, effective value, and source. With a key it prints
 * only the value, so `taflog config dir` is scriptable.
 */
export function renderConfig(view: ResolvedConfig, options: RenderConfigOptions = {}): string {
  const style = options.style ?? createStyle()
  if (options.key !== undefined) {
    return `${sanitizeForTerminal(displayValue(view, options.key))}\n`
  }

  const rows = CONFIG_KEYS.map((key) => ({
    key,
    value: sanitizeForTerminal(displayValue(view, key)),
    source: resolvedFor(view, key).source,
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

function displayValue(view: ResolvedConfig, key: ConfigKey): string {
  return String(displayConfigValue(key, resolvedFor(view, key).value as string | number | null))
}

export interface ConfigJsonOptions {
  pretty?: boolean
  /** Emit a single key instead of the whole effective configuration. */
  key?: ConfigKey
}

/** JSON presenter for `config`; frozen `version: 1` (SPEC §9.5). */
export function configJson(view: ResolvedConfig, options: ConfigJsonOptions = {}): string {
  if (options.key !== undefined) {
    const { value, source } = resolvedFor(view, options.key)
    return `${JSON.stringify(
      { version: 1, key: options.key, value, source },
      null,
      options.pretty === true ? 2 : undefined,
    )}\n`
  }

  const config: Record<string, Resolved<unknown>> = {}
  for (const key of CONFIG_KEYS) {
    const { value, source } = resolvedFor(view, key)
    config[key] = { value, source }
  }
  return `${JSON.stringify(
    { version: 1, config },
    null,
    options.pretty === true ? 2 : undefined,
  )}\n`
}

/** Confirmation for `set`: the canonical key and the value written. */
export function renderSet(result: { key: string; value: string | number }): string {
  return `${result.key} = ${sanitizeForTerminal(String(result.value))}\n`
}
