"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Controller, useForm } from "react-hook-form";

import { grantAdminSchema, type GrantAdminInput } from "@/src/contracts/team-schema";
import { GRANTABLE_ROLES } from "@/src/domain/entities/User";
import { useRouter } from "@/src/i18n/navigation";
import { ApiError } from "@/src/lib/api/ApiError";
import { localizeApiError } from "@/src/lib/api/localizeApiError";
import { formErrorMessage } from "@/src/lib/formErrorMessage";
import { cn } from "@/src/lib/utils";
import {
  Button,
  FormMessage,
  Icon,
  Input,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  TextField,
  focusRing,
  type FieldControlProps,
  useToast,
} from "@/src/presentation/design-system";

import { teamApi } from "./team-api";

/**
 * Grant admin access to a phone number. React Hook Form + Zod (shared
 * `grantAdminSchema`), submitting over the REST API via `teamApi`.
 *
 * There's no separate "invite sent / pending" state to render: the grant lands on
 * the account behind that phone immediately, and it can only be used by someone
 * who passes OTP on the number. So a successful submit just re-runs the server
 * render (`router.refresh()`) and the new member appears in the table.
 */
export function GrantAdminForm() {
  const t = useTranslations("dashTeam");
  const tApiErrors = useTranslations("apiErrors");
  const tFormErrors = useTranslations("formErrors");
  const router = useRouter();
  const { toast } = useToast();
  const {
    register,
    control: formControl,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<GrantAdminInput>({
    resolver: zodResolver(grantAdminSchema, undefined, { raw: true }),
    // Least privilege by default — the person adding someone has to choose to give
    // them more than read access.
    defaultValues: { phone: "", email: "", role: "support" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await teamApi.grant(values);
      reset();
      toast({ tone: "success", title: t("granted", { phone: values.phone.trim() }) });
      // The server stays the source of truth — re-render rather than splicing a
      // row into a local copy of the list.
      router.refresh();
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setError("root", { message: t("grantError") });
        return;
      }
      // Prefer field-level messages so they read in context; fall back to a single
      // root message when the API didn't scope the error.
      let appliedField = false;
      for (const field of ["phone", "email"] as const) {
        const message = error.fieldErrors?.[field];
        if (message) {
          setError(field, { message });
          appliedField = true;
        }
      }
      if (!appliedField) {
        setError("root", { message: localizeApiError(error, tApiErrors, t("grantError")) });
      }
    }
  });

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-card-lg border border-border bg-background p-4 sm:p-6"
    >
      <div>
        <h2 className="text-body-strong text-foreground">{t("grantHeading")}</h2>
        <p className="mt-1 max-w-2xl text-body-small text-muted-foreground">{t("grantDescription")}</p>
      </div>

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem_auto]">
        {/* TextField drops extra props when a render-prop control is used, so the
            row's sizing lives on a wrapper rather than on the field itself. */}
        <div className="min-w-0">
          <TextField
            label={t("phoneLabel")}
            required
            error={formErrorMessage(tFormErrors, errors.phone?.message)}
          >
            {(control) => (
              <Input
                {...control}
                {...register("phone")}
                type="tel"
                dir="ltr"
                autoComplete="off"
                placeholder={t("phonePlaceholder")}
                inputClassName="h-11 sm:h-10"
              />
            )}
          </TextField>
        </div>

        <div className="min-w-0">
          <TextField
            label={t("emailLabel")}
            description={t("emailHint")}
            error={formErrorMessage(tFormErrors, errors.email?.message)}
          >
            {(control) => (
              <Input
                {...control}
                {...register("email")}
                type="email"
                dir="ltr"
                autoComplete="off"
                placeholder={t("emailPlaceholder")}
                inputClassName="h-11 sm:h-10"
              />
            )}
          </TextField>
        </div>

        <div className="min-w-0">
          {/* The role goes beside the phone rather than behind an "advanced"
              disclosure: choosing what someone may do is part of adding them, and
              defaulting quietly to the most powerful option is how everyone ends
              up an admin. */}
          <TextField label={t("roleLabel")} description={t("roleHint")}>
            {(fieldControl) => (
              <Controller
                control={formControl}
                name="role"
                render={({ field }) => (
                  <RolePicker
                    {...fieldControl}
                    ref={field.ref}
                    value={field.value}
                    onChange={field.onChange}
                    labels={Object.fromEntries(GRANTABLE_ROLES.map((role) => [role, t(`role.${role}`)])) as Record<GrantAdminInput["role"], string>}
                  />
                )}
              />
            )}
          </TextField>
        </div>

        <Button type="submit" loading={isSubmitting} className="h-11 w-full self-start text-body-small-emphasis sm:mt-7 sm:h-10 xl:w-auto">
          {isSubmitting ? t("granting") : t("grantSubmit")}
        </Button>
      </div>

      {errors.root?.message && (
        <FormMessage size="md">{errors.root.message}</FormMessage>
      )}
    </form>
  );
}

type RolePickerProps = FieldControlProps & {
  value: GrantAdminInput["role"];
  onChange: (value: GrantAdminInput["role"]) => void;
  labels: Record<GrantAdminInput["role"], string>;
};

const RolePicker = React.forwardRef<HTMLButtonElement, RolePickerProps>(
  ({ value, onChange, labels, required: _required, ...fieldControl }, ref) => (
    <Popover>
      <PopoverTrigger asChild>
        <button
          {...fieldControl}
          ref={ref}
          type="button"
          className={cn(
            focusRing,
            "group flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-input border border-border bg-input px-3 text-body-small text-foreground transition-colors hover:bg-muted sm:h-10",
          )}
        >
          <span className="truncate">{labels[value]}</span>
          <Icon icon={ChevronDown} size="xs" className="shrink-0 transition-transform group-data-[state=open]:rotate-180" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-40">
        <div role="radiogroup" className="flex flex-col gap-1 p-1">
          {GRANTABLE_ROLES.map((role) => {
            const isSelected = role === value;
            return (
              <PopoverClose asChild key={role}>
                <label
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 rounded-button px-2 py-2 text-body-bold transition-colors",
                    isSelected ? "bg-accent font-medium text-primary" : "text-foreground hover:bg-muted",
                  )}
                >
                  <input
                    type="radio"
                    name="grant-role"
                    value={role}
                    checked={isSelected}
                    onChange={() => onChange(role)}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                      "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                      isSelected ? "border-primary" : "border-border",
                    )}
                  >
                    {isSelected ? <span className="size-2 rounded-full bg-primary" /> : null}
                  </span>
                  {labels[role]}
                </label>
              </PopoverClose>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  ),
);

RolePicker.displayName = "RolePicker";
