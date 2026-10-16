import * as React from "react";

import { Field } from "../Field";
import { Input, type InputProps } from "../Input";
import { RequiredMark } from "../shared/RequiredMark";

/** The a11y wiring a field injects into its control (spread onto the control). */
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
};

export interface TextFieldProps extends Omit<InputProps, "children"> {
  /** Static label rendered above the control. */
  label: string;
  description?: React.ReactNode;
  error?: React.ReactNode;
  /**
   * Render a custom control (e.g. `<PasswordInput/>`, `<Textarea/>`). Receives
   * the field's a11y wiring to spread onto it. Omit to use the default `<Input/>`,
   * which also receives any extra props passed here. (When provided, those extra
   * props are ignored — pass them to your control inside the render-prop. This is
   * by design: only the minimal wiring is safe to spread onto any control.)
   */
  children?: (control: FieldControlProps) => React.ReactNode;
}

/**
 * Static-label field: a visible label above the control, with an optional
 * placeholder hint, description, and error. Polymorphic over the control via the
 * `children` render-prop (defaults to `<Input/>`), so it works with any control —
 * `Input`, `PasswordInput`, `Textarea`, … — through one accessibility path.
 */
export function TextField({ label, description, error, id, required, children, ...inputProps }: TextFieldProps) {
  return (
    <Field id={id} description={description} error={error} className="gap-1.5">
      {({ id: fieldId, ariaDescribedBy, ariaInvalid }) => {
        const control: FieldControlProps = {
          id: fieldId,
          "aria-describedby": ariaDescribedBy,
          "aria-invalid": ariaInvalid,
          required,
        };

        return (
          <>
            <label htmlFor={fieldId} className="text-label-default text-input-foreground">
              {label}
              {required && <RequiredMark />}
            </label>
            {children ? children(control) : <Input {...inputProps} {...control} />}
          </>
        );
      }}
    </Field>
  );
}
