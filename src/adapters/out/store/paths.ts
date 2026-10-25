import { homedir } from "node:os"
import { join } from "node:path"

/**
 * Per-OS default data directory (ADR-0002, SPEC §5). Precedence is `--dir` >
 * `TAFLOG_DIR` > config-file `dir` > this default.
 */
export function defaultDataDir(
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
  const base = nonEmpty(env.XDG_DATA_HOME) ?? join(homedir(), ".local", "share")
  return join(base, "taflog")
}

function nonEmpty(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  return value.trim() === "" ? undefined : value
}
