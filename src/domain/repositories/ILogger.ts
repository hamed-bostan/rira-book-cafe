/**
 * Structured fields attached to one log line. Put a caught error under `error`
 * so implementations can serialize its message, type and stack.
 */
export type LogContext = {
  error?: unknown;
  [field: string]: unknown;
};

/**
 * Structured, leveled logging. A port (not an implementation) so use-cases and
 * adapters log without knowing the sink: the container binds a JSON logger in
 * production, a pretty one in dev, and tests can pass a silent fake.
 *
 * Messages are constant, greppable sentences ("Image upload failed"); the
 * variable parts go in `context`, where they stay queryable and redactable.
 * Logging never throws.
 */
export type ILogger = {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  /** An unexpected failure. Implementations may also report it to the error tracker. */
  error(message: string, context?: LogContext): void;
  /** A logger that adds `bindings` (e.g. `{ requestId }`, `{ module }`) to every line. */
  child(bindings: Record<string, unknown>): ILogger;
};
