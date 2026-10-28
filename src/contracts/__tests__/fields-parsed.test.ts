import { describe, expect, it } from "vitest";
import { z } from "zod";

import { fieldsParsed } from "../fields-parsed";

import { messagesAt } from "./zod-issues";

const amount = z
  .string()
  .regex(/^\d+$/, "amountInvalid")
  .transform(Number)
  .refine((n) => n > 0, "amountPositive");
const note = z
  .string()
  .max(3, "noteTooLong")
  .transform((value) => value || undefined);
const whenParsed = fieldsParsed("amount", "vat", "note");

const schema = z
  .object({ amount, vat: amount, note, name: z.string().min(1, "nameRequired") })
  .refine((value) => value.note !== "ab", { path: ["note"], error: "noteTaken", when: whenParsed })
  .refine((value) => value.vat < value.amount, { path: ["vat"], error: "vatTooHigh", when: whenParsed });

const VALID = { amount: "10", vat: "5", note: "", name: "n" };

describe("fieldsParsed", () => {
  it("holds a rule back while a named field failed before its transform", () => {
    expect(messagesAt(schema.safeParse({ ...VALID, amount: "abc" }), "vat")).toEqual([]);
    expect(messagesAt(schema.safeParse({ ...VALID, vat: "50", note: "long" }), "vat")).toEqual([]);
  });

  it("still runs a rule after a check following the transform failed", () => {
    const result = schema.safeParse({ ...VALID, amount: "0" });
    expect(messagesAt(result, "amount")).toEqual(["amountPositive"]);
    expect(messagesAt(result, "vat")).toEqual(["vatTooHigh"]);
  });

  it("runs a rule when only a field it doesn't name failed a check", () => {
    expect(messagesAt(schema.safeParse({ ...VALID, vat: "50", name: "" }), "vat")).toEqual(["vatTooHigh"]);
  });

  it("skips a rule after an aborting issue anywhere", () => {
    expect(messagesAt(schema.safeParse({ ...VALID, vat: "50", name: 5 }), "vat")).toEqual([]);
  });

  it("doesn't let one rule's issue hold back the next", () => {
    const result = schema.safeParse({ ...VALID, vat: "50", note: "ab" });
    expect(messagesAt(result, "note")).toEqual(["noteTaken"]);
    expect(messagesAt(result, "vat")).toEqual(["vatTooHigh"]);
  });

  it("matches every array index with *", () => {
    const lines = z
      .array(z.object({ cost: amount }))
      .refine((rows) => rows.some((row) => row.cost > 100), { error: "totalTooLow", when: fieldsParsed("*.cost") });
    expect(messagesAt(lines.safeParse([{ cost: "5" }, { cost: "x" }]), "")).toEqual([]);
    expect(messagesAt(lines.safeParse([{ cost: "5" }, { cost: "0" }]), "")).toEqual(["totalTooLow"]);
  });
});
