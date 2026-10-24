/**
 * The current instant (SPEC §3). The only clock the core may consult.
 */
export interface Clock {
  now(): Date
}
