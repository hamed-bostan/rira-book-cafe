import { parseJalaliPeriod } from "@/src/domain/entities/JalaliCalendar";
import * as z from "@/src/lib/zod";

import { fieldsParsed } from "./fields-parsed";
import { dayField, moneyField, optionalMoneyField, optionalTextField } from "./money-fields";

/** Someone on the payroll. `monthlySalary` is their usual gross; blank means none set yet. */
export const employeeSchema = z.object({
  name: z.string().check(z.trim(), z.minLength(1, "nameRequired"), z.maxLength(120, "textTooLong")),
  position: optionalTextField(80),
  phone: optionalTextField(30),
  monthlySalary: optionalMoneyField,
  isActive: z.boolean(),
});

export type EmployeeFormInput = z.input<typeof employeeSchema>;

/** One person's month, in the figures the accountant gave. */
export const payRunLineSchema = z
  .object({
    employeeId: z.string().check(z.minLength(1, "payRunEmpty")),
    gross: moneyField,
    employeeInsurance: optionalMoneyField,
    incomeTax: optionalMoneyField,
    employerInsurance: optionalMoneyField,
  })
  .check(
    z.refine((line) => line.employeeInsurance + line.incomeTax <= line.gross, {
      path: ["employeeInsurance"],
      error: "payRunDeductionsTooHigh",
      when: fieldsParsed("gross", "employeeInsurance", "incomeTax"),
    }),
  );

/** Recording a month's pay. */
export const payRunSchema = z.object({
  period: z
    .string({ error: "payRunMonthInvalid" })
    .check(z.refine((value) => parseJalaliPeriod(value) !== null, "payRunMonthInvalid")),
  date: dayField,
  lines: z.array(payRunLineSchema).check(z.minLength(1, "payRunEmpty")),
});

export type PayRunFormInput = z.input<typeof payRunSchema>;
