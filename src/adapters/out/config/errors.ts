import { TaflogError } from "../../../domain/errors.ts"

/**
 * Invalid configuration: an unknown key, a malformed file, or a value that
 * fails validation. It is a usage error, so the CLI exits 2 (SPEC §7, §8.4).
 */
export class ConfigError extends TaflogError {
  constructor(message: string) {
    super(message, 2)
    this.name = "ConfigError"
  }
}
