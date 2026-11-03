import { unstable_rethrow } from "next/navigation";

/**
 * One of the overview's reads, made survivable: its data, or `null` when it
 * failed. The page reads five things at once, and one of them failing should
 * blank only the parts drawn from it — each shows its own error with a retry —
 * not the whole page through the route's error boundary. Next's own control-flow
 * throws (a redirect, a not-found) still pass through.
 */
export async function readOrNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read;
  } catch (error) {
    unstable_rethrow(error);
    // The API logs its own failures; this catches the ones on the way back too
    // (a timeout, a response that doesn't match its schema).
    console.error("A dashboard overview read failed:", error);
    return null;
  }
}
