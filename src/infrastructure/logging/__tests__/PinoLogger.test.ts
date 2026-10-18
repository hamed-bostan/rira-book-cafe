import { Writable } from "node:stream";

import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { PinoLogger, type ErrorReport } from "../PinoLogger";

/** A PinoLogger writing JSON lines into an array, plus the reporter it calls. */
function capture(): { logger: PinoLogger; lines: Record<string, unknown>[]; reports: ErrorReport[] } {
  const lines: Record<string, unknown>[] = [];
  const reports: ErrorReport[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done): void {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  const instance = pino(
    {
      base: null,
      serializers: { error: pino.stdSerializers.err },
      redact: { paths: ["cookie", "*.authorization"], censor: "[redacted]" },
    },
    stream,
  );
  return { logger: new PinoLogger(instance, (report) => reports.push(report)), lines, reports };
}

describe("PinoLogger", () => {
  it("writes the message and context as one structured line", () => {
    const { logger, lines } = capture();
    logger.info("Order placed", { orderId: "o1" });
    expect(lines[0]).toMatchObject({ msg: "Order placed", orderId: "o1", level: 30 });
  });

  it("carries child bindings onto every line and into error reports", () => {
    const { logger, lines, reports } = capture();
    const error = new Error("boom");
    logger.child({ requestId: "req-1" }).error("Upload failed", { error, folder: "products" });

    expect(lines[0]).toMatchObject({ requestId: "req-1", folder: "products", error: { message: "boom" } });
    expect(reports).toEqual([{ message: "Upload failed", error, fields: { requestId: "req-1", folder: "products" } }]);
  });

  it("redacts configured fields", () => {
    const { logger, lines } = capture();
    logger.warn("Odd request", { cookie: "session=abc", headers: { authorization: "Bearer x" } });
    expect(lines[0]).toMatchObject({ cookie: "[redacted]", headers: { authorization: "[redacted]" } });
  });

  it("only reports error-level lines, and never throws when the reporter does", () => {
    const reporter = vi.fn(() => {
      throw new Error("tracker down");
    });
    const logger = new PinoLogger(pino({ level: "silent" }), reporter);

    logger.warn("Just a warning");
    expect(reporter).not.toHaveBeenCalled();
    expect(() => logger.error("Real failure")).not.toThrow();
    expect(reporter).toHaveBeenCalledOnce();
  });
});
