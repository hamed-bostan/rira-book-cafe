"use client";

import * as React from "react";

import { Input, type InputProps } from "../Input";

import { PasswordToggle } from "./PasswordToggle";

export type PasswordInputProps = Omit<InputProps, "type" | "rightElement">;

/**
 * Password field that composes <Input /> with the show/hide toggle. The toggle
 * controls the input's `type` and is wired to it via `aria-controls`.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    const [visible, setVisible] = React.useState(false);

    return (
      <Input
        ref={ref}
        id={inputId}
        type={visible ? "text" : "password"}
        rightElement={<PasswordToggle show={visible} setShow={setVisible} controls={inputId} />}
        {...props}
      />
    );
  },
);

PasswordInput.displayName = "PasswordInput";
