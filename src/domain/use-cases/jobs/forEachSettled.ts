/**
 * Run `work` for every item, one after another, even when some fail: one bad row
 * mustn't hold up the rest of a job's run. The failures are thrown together at the
 * end, for the runner to log; the next run tries them again — every job is safe to
 * repeat.
 */
export async function forEachSettled<T>(items: readonly T[], work: (item: T) => Promise<void>): Promise<void> {
  const errors: unknown[] = [];
  for (const item of items) {
    try {
      await work(item);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw new AggregateError(errors, `${errors.length} of ${items.length} failed`);
}
