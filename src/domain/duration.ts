/**
 * Duration rendering (SPEC §6). Durations are stored as seconds and render to
 * the minute; hours zero-pad the minutes so columns line up (`1h06m`).
 */
export function formatDuration(seconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(seconds / 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h${String(minutes).padStart(2, "0")}m`
  return `${minutes}m`
}
