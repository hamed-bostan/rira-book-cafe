/** `success` confirms a mutation landed; `error` reports one that didn't; `info` is neutral. */
export type ToastTone = "success" | "error" | "info";

export type ToastOptions = {
  /** The one-line outcome — "Category saved", "Couldn't delete the event". */
  title: string;
  /** Optional detail under the title, e.g. the server's reason for a refusal. */
  description?: string;
  tone?: ToastTone;
  /** Milliseconds before auto-dismiss. Defaults per tone (errors linger longer). */
  duration?: number;
  /**
   * Puts an "Undo" button in the toast that runs this and closes it. Only for a
   * one-click change that can simply be made the other way again (a switch, a
   * move) — never a delete or anything that went through a confirm step.
   */
  onUndo?: () => void;
};

export type ToastRecord = ToastOptions & {
  id: number;
  /** Kept mounted while closing so Radix can play the exit animation. */
  open: boolean;
};

export type ToastApi = {
  /** Show a toast. Returns its id. */
  toast: (options: ToastOptions) => number;
  /** Close a toast early (e.g. once a retry succeeds). */
  dismiss: (id: number) => void;
};
