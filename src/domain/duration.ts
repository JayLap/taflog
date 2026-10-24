/**
 * Duration rendering and parsing (SPEC §6, §8.5). Durations are stored as
 * seconds and render to the minute; hours zero-pad the minutes so columns line
 * up (`1h06m`).
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`
  return `${minutes}m`
}

/**
 * Parse a Duration string into whole seconds, or `null` when malformed
 * (SPEC §8.5). Accepted forms: `90m`, `1h`, `1h30m`, `1.5h`, and a bare number
 * meaning minutes (`50` → `50m`). Fractional components are rounded to the
 * nearest second. Negative durations are rejected; `sub` supplies the sign.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim()
  const hoursMinutes = /^(\d+(?:\.\d+)?)h(?:(\d+(?:\.\d+)?)m)?$/.exec(text)
  if (hoursMinutes !== null) {
    const hours = Number(hoursMinutes[1])
    const minutes = hoursMinutes[2] === undefined ? 0 : Number(hoursMinutes[2])
    return Math.round(hours * 3600 + minutes * 60)
  }
  const minutesOnly = /^(\d+(?:\.\d+)?)m$/.exec(text)
  if (minutesOnly !== null) return Math.round(Number(minutesOnly[1]) * 60)
  const bare = /^(\d+(?:\.\d+)?)$/.exec(text)
  if (bare !== null) return Math.round(Number(bare[1]) * 60)
  return null
}
