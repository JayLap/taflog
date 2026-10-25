import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Per-OS default config directory (ADR-0002, SPEC §7). It is deliberately
 * separate from the data directory so `dir` can point elsewhere.
 */
export function defaultConfigDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  if (platform === "win32") {
    const base = nonEmpty(env.APPDATA) ?? join(homedir(), "AppData", "Roaming")
    return join(base, "taflog")
  }
  if (platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "taflog")
  }
  const base = nonEmpty(env.XDG_CONFIG_HOME) ?? join(homedir(), ".config")
  return join(base, "taflog")
}

/** The fixed per-OS `config.json` path (ADR-0002). */
export function defaultConfigFile(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return join(defaultConfigDir(env, platform), "config.json")
}

/** `TAFLOG_CONFIG` override else the fixed per-OS path (SPEC §7, ADR-0002). */
export function resolveConfigPath(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return nonEmpty(env.TAFLOG_CONFIG) ?? defaultConfigFile(env, platform)
}

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value.trim() === "" ? undefined : value
}
