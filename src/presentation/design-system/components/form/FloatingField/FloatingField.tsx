import * as React from "react";

import { Field } from "../Field";
import { Input, type InputProps } from "../Input";

import { FloatingLabel } from "./FloatingLabel";

/**
 * The wiring a floating field injects into its (single-line) control. Spreading
 * this onto the control supplies the a11y attributes, the invisible placeholder
 * that drives `:placeholder-shown`, and the floating label in the overlay slot.
 */
export type FloatingControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  placeholder: string;
  inputClassName: string;
  required?: boolean;
  leftElement?: React.ReactNode;
  children: React.ReactNode;
};

export interface FloatingFieldProps extends Omit<InputProps, "placeholder" | "inputClassName" | "children"> {
  /** Label that rests in the control and floats to the border on focus/value. */
  label: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  /**
   * Render a custom single-line control (e.g. `<PasswordInput/>`). Receives the
   * floating wiring to spread onto it. Omit to use the default `<Input/>`. Not for
   * `<Textarea/>` — a floating label over multi-line content doesn't apply.
   */
  children?: (control: FloatingControlProps) => React.ReactNode;
}

/**
 * Floating-label field. The label is the field's accessible name, so there is no
 * placeholder and no static label — those props don't exist here, making the
 * illegal combinations unrepresentable. Polymorphic over single-line controls via
 * the `children` render-prop (defaults to `<Input/>`).
 */
export function FloatingField({
  label,
  required,
  description,
  error,
  id,
  leftElement,
  children,
  ...inputProps
}: FloatingFieldProps) {
  // Align the label's resting position with the input's text inset.
  const offset = leftElement ? "start-10" : "start-7";

  return (
    <Field id={id} description={description} error={error}>
      {({ id: fieldId, ariaDescribedBy, ariaInvalid }) => {
        const control: FloatingControlProps = {
          id: fieldId,
          "aria-describedby": ariaDescribedBy,
          "aria-invalid": ariaInvalid,
          // A non-empty placeholder keeps `:placeholder-shown` tracking emptiness;
          // it is kept invisible so only the floating label is seen.
          placeholder: " ",
          inputClassName: "placeholder:text-transparent",
          required,
          leftElement,
          children: <FloatingLabel htmlFor={fieldId} label={label} required={required} offset={offset} />,
        };

        return children ? children(control) : <Input {...inputProps} {...control} />;
      }}
    </Field>
  );
}
