import { GUEST_MESSAGE_TOPICS, MAX_GUEST_MESSAGE_LENGTH } from "@/src/domain/entities/GuestMessage";
import { isPlausiblePhone } from "@/src/domain/entities/Phone";
import * as z from "@/src/lib/zod";

/**
 * Staff writing to a guest, shared by the "Message guest" dialog and the admin
 * route (which re-validates — never trust the client). Plain text: it's shown as
 * typed, never as markup. `phone` is the number staff saw beside the guest, and
 * `about` the booking, loan, hold or order the message is about; the use-case
 * checks the two still belong together. Messages are `formErrors` keys.
 */
export const guestMessageSchema = z.object({
  phone: z.string().check(z.trim(), z.refine(isPlausiblePhone, "phoneInvalid")),
  text: z
    .string()
    .check(z.trim(), z.minLength(1, "messageRequired"), z.maxLength(MAX_GUEST_MESSAGE_LENGTH, "textTooLong")),
  about: z.object({
    kind: z.enum(GUEST_MESSAGE_TOPICS, { error: "messageAboutInvalid" }),
    id: z.string().check(z.trim(), z.minLength(1, "messageAboutInvalid")),
  }),
});

export type GuestMessageFormInput = z.input<typeof guestMessageSchema>;
