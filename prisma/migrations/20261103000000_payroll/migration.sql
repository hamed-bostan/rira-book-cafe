-- Who the cafe pays. Not a login: not everyone on the payroll has one.
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "monthly_salary" BIGINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "employees_monthly_salary_chk" CHECK ("monthly_salary" >= 0)
);

-- A month's pay, with the figures as the accountant gave them.
CREATE TABLE "pay_runs" (
    "id" TEXT NOT NULL,
    -- The Persian month, "1405-08".
    "period" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" TEXT NOT NULL,
    "paid_amount" BIGINT NOT NULL DEFAULT 0,
    "paid_from" TEXT,
    "paid_on" DATE,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pay_runs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pay_runs_paid_amount_chk" CHECK ("paid_amount" >= 0)
);

-- One standing run a month: what stops a month's salaries being booked twice. A
-- voided run frees its month, so a wrong one can be recorded again.
CREATE UNIQUE INDEX "pay_runs_one_per_period" ON "pay_runs"("period") WHERE "status" <> 'void';

CREATE TABLE "pay_run_lines" (
    "id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employee_name" TEXT NOT NULL,
    "gross" BIGINT NOT NULL,
    "employee_insurance" BIGINT NOT NULL DEFAULT 0,
    "income_tax" BIGINT NOT NULL DEFAULT 0,
    "employer_insurance" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "pay_run_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pay_run_lines_figures_chk" CHECK (
      "gross" > 0 AND "employee_insurance" >= 0 AND "income_tax" >= 0 AND "employer_insurance" >= 0
      AND "employee_insurance" + "income_tax" <= "gross"
    )
);

CREATE UNIQUE INDEX "pay_run_lines_run_id_employee_id_key" ON "pay_run_lines"("run_id", "employee_id");
CREATE INDEX "pay_run_lines_employee_id_idx" ON "pay_run_lines"("employee_id");

ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "pay_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pay_run_lines" ADD CONSTRAINT "pay_run_lines_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- What a pay run posts to. Salaries payable and Salaries and wages came with the
-- chart; automatic postings rely on them now, so they can't be switched off.
INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('2300', 'Salaries payable',     'حقوق پرداختنی',              'liability', true),
  ('2310', 'Insurance payable',    'بیمهٔ پرداختنی',              'liability', true),
  ('2320', 'Payroll tax payable',  'مالیات حقوق پرداختنی',       'liability', true),
  ('6200', 'Salaries and wages',   'حقوق و دستمزد',              'expense',   true),
  ('6210', 'Employer''s insurance', 'بیمهٔ سهم کارفرما',          'expense',   true)
ON CONFLICT ("code") DO UPDATE SET "is_system" = true;
