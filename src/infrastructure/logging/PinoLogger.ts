import pino, { type Logger, type LoggerOptions } from "pino";
import pretty from "pino-pretty";

import type { ILogger, LogContext } from "@/src/domain/repositories/ILogger";

/** One error-level line, handed to the error tracker alongside the log write. */
export type ErrorReport = {
  message: string;
  /** The caught error when the line carried one (`context.error`). */
  error: unknown;
  /** Every other field on the line, child bindings (e.g. `requestId`) included. */
  fields: Record<string, unknown>;
};

export type ErrorReporter = (report: ErrorReport) => void;

export type PinoLoggerConfig = {
  /** pino level name: `trace` … `fatal`, or `silent`. */
  level: string;
  /** Human-readable colored lines (dev) instead of one JSON object per line (production). */
  pretty: boolean;
  /** Static fields on every line (service name, version). */
  base?: Record<string, unknown>;
  /** Also send error-level lines to the error tracker. */
  reportError?: ErrorReporter;
};

// Credentials never reach a log line, wherever they sit one level deep. Phones are
// masked in named fields too; user ids (also phones) are kept — support needs them.
const REDACT_KEYS = ["password", "token", "secret", "otp", "cookie", "authorization", "phone", "mobile"];
const REDACT_PATHS = [
  ...REDACT_KEYS,
  ...REDACT_KEYS.map((key) => `*.${key}`),
  "headers.cookie",
  "headers.authorization",
  "*.headers.cookie",
  "*.headers.authorization",
];

// Line breaks in a message could forge extra lines in the pretty (dev) output; JSON
// output escapes them anyway. Fields stay as they are — pino serializes them safely.
function singleLine(message: string): string {
  return message.replace(/[\r\n]+/g, " ");
}

/** Build the pino instance: JSON to stdout in production, pretty-printed in dev. */
export function createPinoLogger(config: PinoLoggerConfig): PinoLogger {
  const options: LoggerOptions = {
    level: config.level,
    base: config.base,
    timestamp: pino.stdTimeFunctions.isoTime,
    // `"level":"error"` rather than `"level":50` — what log shippers and humans expect.
    formatters: { level: (label) => ({ level: label }) },
    serializers: { error: pino.stdSerializers.err, err: pino.stdSerializers.err },
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  };

  // pino-pretty as an in-process stream, not a worker-thread transport: transports
  // don't survive Next's server bundling, and dev throughput doesn't need them.
  const instance = config.pretty
    ? pino(options, pretty({ colorize: true, sync: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" }))
    : pino(options);

  return new PinoLogger(instance, config.reportError);
}

/** {@link ILogger} over pino. */
export class PinoLogger implements ILogger {
  constructor(
    private readonly pino: Logger,
    private readonly reportError?: ErrorReporter,
  ) {}

  debug(message: string, context?: LogContext): void {
    this.pino.debug(context ?? {}, singleLine(message));
  }

  info(message: string, context?: LogContext): void {
    this.pino.info(context ?? {}, singleLine(message));
  }

  warn(message: string, context?: LogContext): void {
    this.pino.warn(context ?? {}, singleLine(message));
  }

  error(message: string, context?: LogContext): void {
    this.pino.error(context ?? {}, singleLine(message));
    if (!this.reportError) return;

    const { error, ...fields } = context ?? {};
    try {
      this.reportError({ message, error, fields: { ...this.pino.bindings(), ...fields } });
    } catch {
      // Logging never throws — a broken reporter must not break the request.
    }
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new PinoLogger(this.pino.child(bindings), this.reportError);
  }
}
