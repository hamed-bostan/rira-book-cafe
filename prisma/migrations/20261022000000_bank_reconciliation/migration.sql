-- Bank statement reconciliation: statements entered from the bank and matched line
-- by line to the Bank account. (The till is counted per shift — see cash_shifts.)
-- CreateTable
CREATE TABLE "bank_statements" (
    "id" TEXT NOT NULL,
    "account_code" TEXT NOT NULL DEFAULT '1120',
    "from_day" DATE NOT NULL,
    "to_day" DATE NOT NULL,
    "opening_balance" BIGINT NOT NULL,
    "closing_balance" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciled_by_id" TEXT,
    "reconciled_by_name" TEXT,
    "reconciled_at" TIMESTAMP(3),

    CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "amount" BIGINT NOT NULL,
    "position" INTEGER NOT NULL,
    "match_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_matches" (
    "id" TEXT NOT NULL,
    "statement_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_match_ledger_lines" (
    "match_id" TEXT NOT NULL,
    "journal_line_id" TEXT NOT NULL,

    CONSTRAINT "bank_match_ledger_lines_pkey" PRIMARY KEY ("match_id","journal_line_id")
);

-- CreateIndex
CREATE INDEX "bank_statements_account_code_to_day_idx" ON "bank_statements"("account_code", "to_day");

-- CreateIndex
CREATE UNIQUE INDEX "bank_statements_account_code_from_day_key" ON "bank_statements"("account_code", "from_day");

-- CreateIndex
CREATE INDEX "bank_statement_lines_statement_id_position_idx" ON "bank_statement_lines"("statement_id", "position");

-- CreateIndex
CREATE INDEX "bank_statement_lines_match_id_idx" ON "bank_statement_lines"("match_id");

-- CreateIndex
CREATE INDEX "bank_matches_statement_id_idx" ON "bank_matches"("statement_id");

-- CreateIndex
CREATE UNIQUE INDEX "bank_match_ledger_lines_journal_line_id_key" ON "bank_match_ledger_lines"("journal_line_id");

-- AddForeignKey
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_account_code_fkey" FOREIGN KEY ("account_code") REFERENCES "ledger_accounts"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "bank_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_match_ledger_lines" ADD CONSTRAINT "bank_match_ledger_lines_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "bank_matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_match_ledger_lines" ADD CONSTRAINT "bank_match_ledger_lines_journal_line_id_fkey" FOREIGN KEY ("journal_line_id") REFERENCES "journal_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Database-level guarantees ─────────────────────────────────────────────────
-- The app checks all of this too; these keep any code path (or hand-written SQL)
-- from leaving a reconciliation that doesn't add up.

ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_values_chk"
  CHECK (
    "from_day" <= "to_day"
    AND "status" IN ('open', 'reconciled')
    AND (("status" = 'reconciled') = ("reconciled_at" IS NOT NULL AND "reconciled_by_id" IS NOT NULL))
  );

ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_amount_chk" CHECK ("amount" <> 0);

-- A statement's figures never change; the only change is signing it off, once.
CREATE FUNCTION "bank_statements_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Bank statements are permanent';
  END IF;
  IF OLD."status" = 'reconciled'
     OR NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."account_code" IS DISTINCT FROM OLD."account_code"
     OR NEW."from_day" IS DISTINCT FROM OLD."from_day"
     OR NEW."to_day" IS DISTINCT FROM OLD."to_day"
     OR NEW."opening_balance" IS DISTINCT FROM OLD."opening_balance"
     OR NEW."closing_balance" IS DISTINCT FROM OLD."closing_balance"
     OR NEW."created_by_id" IS DISTINCT FROM OLD."created_by_id"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Bank statement % can no longer change', OLD."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "bank_statements_guard"
  BEFORE UPDATE OR DELETE ON "bank_statements"
  FOR EACH ROW EXECUTE FUNCTION "bank_statements_guard"();

-- Nothing on a reconciled statement changes: not its lines, not its matches.
CREATE FUNCTION "bank_statement_reconciled"(statement TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM "bank_statements" WHERE "id" = statement AND "status" = 'reconciled');
$$;

CREATE FUNCTION "bank_statement_lines_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF "bank_statement_reconciled"(CASE WHEN TG_OP = 'INSERT' THEN NEW."statement_id" ELSE OLD."statement_id" END) THEN
    RAISE EXCEPTION 'The statement is reconciled; its lines can no longer change';
  END IF;
  IF TG_OP = 'UPDATE' AND (
       NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."statement_id" IS DISTINCT FROM OLD."statement_id"
       OR NEW."date" IS DISTINCT FROM OLD."date"
       OR NEW."description" IS DISTINCT FROM OLD."description"
       OR NEW."reference" IS DISTINCT FROM OLD."reference"
       OR NEW."amount" IS DISTINCT FROM OLD."amount") THEN
    RAISE EXCEPTION 'A statement line can only be matched or unmatched';
  END IF;
  IF TG_OP = 'DELETE' AND OLD."match_id" IS NOT NULL THEN
    RAISE EXCEPTION 'Unmatch the statement line before removing it';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "bank_statement_lines_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "bank_statement_lines"
  FOR EACH ROW EXECUTE FUNCTION "bank_statement_lines_guard"();

CREATE FUNCTION "bank_matches_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Bank matches are made or removed, never edited';
  END IF;
  IF "bank_statement_reconciled"(CASE WHEN TG_OP = 'INSERT' THEN NEW."statement_id" ELSE OLD."statement_id" END) THEN
    RAISE EXCEPTION 'The statement is reconciled; its matches can no longer change';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "bank_matches_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "bank_matches"
  FOR EACH ROW EXECUTE FUNCTION "bank_matches_guard"();

CREATE FUNCTION "bank_match_ledger_lines_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  match_row TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Bank matches are made or removed, never edited';
  END IF;
  match_row := CASE WHEN TG_OP = 'INSERT' THEN NEW."match_id" ELSE OLD."match_id" END;
  IF "bank_statement_reconciled"((SELECT "statement_id" FROM "bank_matches" WHERE "id" = match_row)) THEN
    RAISE EXCEPTION 'The statement is reconciled; its matches can no longer change';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER "bank_match_ledger_lines_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "bank_match_ledger_lines"
  FOR EACH ROW EXECUTE FUNCTION "bank_match_ledger_lines_guard"();

-- Every match that exists at COMMIT joins at least one line on each side, the
-- statement lines are its statement's, the ledger lines are on that statement's
-- account, and both sides total the same. Checked deferred, once all rows exist.
CREATE FUNCTION "bank_match_balanced"(match_row TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  statement_id_ TEXT;
  account_code_ TEXT;
  bank_total    BIGINT;
  bank_count    INTEGER;
  foreign_lines INTEGER;
  book_total    BIGINT;
  book_count    INTEGER;
  wrong_account INTEGER;
BEGIN
  SELECT s."id", s."account_code" INTO statement_id_, account_code_
    FROM "bank_statements" s JOIN "bank_matches" m ON m."statement_id" = s."id"
    WHERE m."id" = match_row;
  IF NOT FOUND THEN
    RETURN; -- the match was removed
  END IF;
  SELECT COALESCE(SUM("amount"), 0), COUNT(*), COUNT(*) FILTER (WHERE "statement_id" <> statement_id_)
    INTO bank_total, bank_count, foreign_lines
    FROM "bank_statement_lines" WHERE "match_id" = match_row;
  SELECT COALESCE(SUM(l."debit" - l."credit"), 0), COUNT(*), COUNT(*) FILTER (WHERE l."account_code" <> account_code_)
    INTO book_total, book_count, wrong_account
    FROM "bank_match_ledger_lines" ml JOIN "journal_lines" l ON l."id" = ml."journal_line_id"
    WHERE ml."match_id" = match_row;
  IF bank_count = 0 OR book_count = 0 OR foreign_lines > 0 OR wrong_account > 0 OR bank_total <> book_total THEN
    RAISE EXCEPTION 'Bank match % is invalid (statement % in % lines, ledger % in % lines)',
      match_row, bank_total, bank_count, book_total, book_count;
  END IF;
END;
$$;

CREATE FUNCTION "bank_statement_lines_match_check"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."match_id" IS NOT NULL THEN
    PERFORM "bank_match_balanced"(NEW."match_id");
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."match_id" IS NOT NULL AND OLD."match_id" IS DISTINCT FROM NEW."match_id" THEN
    PERFORM "bank_match_balanced"(OLD."match_id");
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "bank_statement_lines_match_balanced"
  AFTER INSERT OR UPDATE ON "bank_statement_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "bank_statement_lines_match_check"();

CREATE FUNCTION "bank_match_ledger_lines_match_check"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM "bank_match_balanced"(NEW."match_id");
  ELSE
    PERFORM "bank_match_balanced"(OLD."match_id");
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER "bank_match_ledger_lines_match_balanced"
  AFTER INSERT OR DELETE ON "bank_match_ledger_lines"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "bank_match_ledger_lines_match_check"();

-- ── Accounts the new postings use ─────────────────────────────────────────────
-- System accounts, so they can't be deactivated from under the automatic postings.
INSERT INTO "ledger_accounts" ("code", "name", "name_fa", "type", "is_system") VALUES
  ('4800', 'Bank interest income', 'درآمد سود سپرده بانکی', 'revenue', true)
ON CONFLICT ("code") DO UPDATE SET "is_system" = true, "is_active" = true;

