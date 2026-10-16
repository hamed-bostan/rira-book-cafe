"use client";

import { Dialog, VisuallyHidden } from "radix-ui";
import * as React from "react";

import { cn } from "@/src/lib/utils";

/**
 * Centered modal dialog built on Radix Dialog. Mirrors <Sheet> but anchors to
 * the middle of the viewport with a fade + zoom. Composable parts:
 *   <Modal> (root, controllable via `open`/`onOpenChange`)
 *     <ModalTrigger>…</ModalTrigger>
 *     <ModalContent title="…">…</ModalContent>
 *   </Modal>
 *
 * Constrained to the app's mobile column (`max-w-sm`, centered).
 */
export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

export interface ModalContentProps extends React.ComponentPropsWithoutRef<typeof Dialog.Content> {
  /** Accessible, required dialog title (Radix mandates one). */
  title: string;
  /** Visually hide the title while keeping it for screen readers. */
  hideTitle?: boolean;
  /** Optional screen-reader description of the modal's purpose. */
  description?: string;
  /** Override the visible title's classes. */
  titleClassName?: string;
}

export const ModalContent = React.forwardRef<HTMLDivElement, ModalContentProps>(
  ({ className, children, title, hideTitle, description, titleClassName, ...props }, ref) => (
    <Dialog.Portal>
      <Dialog.Overlay
        className={cn(
          "fixed inset-0 z-50 bg-foreground/40",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        )}
      />

      <Dialog.Content
        ref={ref}
        className={cn(
          "fixed start-1/2 top-1/2 z-50 w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 -translate-y-1/2",
          "rounded-modal bg-popover p-6 shadow-lg focus:outline-none",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          // The fade above carries the transition on its own, so only the scale
          // is dropped under reduced motion.
          "motion-safe:data-[state=open]:zoom-in-95",
          "motion-safe:data-[state=closed]:zoom-out-95",
          "duration-200",
          className,
        )}
        {...props}
      >
        {hideTitle ? (
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{title}</Dialog.Title>
          </VisuallyHidden.Root>
        ) : (
          <Dialog.Title className={cn("text-center text-heading-subsection-medium text-foreground", titleClassName)}>
            {title}
          </Dialog.Title>
        )}

        {description && <Dialog.Description className="sr-only">{description}</Dialog.Description>}

        {children}
      </Dialog.Content>
    </Dialog.Portal>
  ),
);

ModalContent.displayName = "ModalContent";
