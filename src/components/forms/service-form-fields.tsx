import type { FieldErrors, FieldValues, Path, UseFormRegisterReturn } from "react-hook-form";
import type { Dictionary } from "@/lib/i18n";
import { Button, FormError, Input, Label, Radio, Textarea } from "@/components/ui";

type FieldVariant = "name" | "phone";

type FieldProps = {
  dictionary: Dictionary;
  error?: string;
  helper?: string;
  label: string;
  name: string;
  registration: UseFormRegisterReturn;
  required?: boolean;
  variant?: FieldVariant;
  wrapperClassName?: string;
};

function translateError(dictionary: Dictionary, message?: string) {
  if (!message) {
    return undefined;
  }

  const key = message.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"];
  return dictionary.forms.errors[key] ?? message;
}

const NAME_CHAR_REGEX = /^[\p{L}\p{M}' -]$/u;
const PHONE_CHAR_REGEX = /^[+0-9]$/;

export function isAllowedNameInsertion(data: string) {
  return data.length > 0 && Array.from(data).every((character) => NAME_CHAR_REGEX.test(character));
}

function isAllowedInsertion(data: string, characterRegex: RegExp) {
  return data.length > 0 && Array.from(data).every((character) => characterRegex.test(character));
}

function handleNameBeforeInput(event: React.FormEvent<HTMLInputElement>) {
  const e = event as React.FormEvent<HTMLInputElement> & { data: string | null };
  if (e.data && !isAllowedNameInsertion(e.data)) {
    event.preventDefault();
  }
}

function handlePhoneBeforeInput(event: React.FormEvent<HTMLInputElement>) {
  const e = event as React.FormEvent<HTMLInputElement> & { data: string | null };
  if (!e.data) return;
  if (!isAllowedInsertion(e.data, PHONE_CHAR_REGEX)) {
    event.preventDefault();
    return;
  }
  // Allow "+" only at the start (when the current value is empty)
  if (
    e.data.includes("+")
    && (e.data[0] !== "+" || e.data.indexOf("+", 1) !== -1 || event.currentTarget.value.length > 0)
  ) {
    event.preventDefault();
  }
}

export function TextField({
  dictionary,
  error,
  helper,
  label,
  name,
  registration,
  required = false,
  variant,
  wrapperClassName,
  ...props
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${name}-error`;
  const helperId = `${name}-helper`;
  const translatedError = translateError(dictionary, error);

  const variantProps =
    variant === "name"
      ? { autoComplete: "name" as const, inputMode: "text" as const, onBeforeInput: handleNameBeforeInput }
      : variant === "phone"
        ? { autoComplete: "tel" as const, inputMode: "tel" as const, onBeforeInput: handlePhoneBeforeInput }
        : {};

  return (
    <div className={["space-y-2", wrapperClassName].filter(Boolean).join(" ")}>
      <Label htmlFor={name} required={required}>{label}</Label>
      <Input
        aria-describedby={translatedError ? errorId : helper ? helperId : undefined}
        aria-invalid={Boolean(translatedError)}
        id={name}
        {...variantProps}
        {...registration}
        {...props}
      />
      {translatedError ? (
        <FormError id={errorId}>{translatedError}</FormError>
      ) : helper ? (
        <p className="text-base text-muted-foreground md:text-sm" id={helperId}>{helper}</p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  dictionary,
  error,
  helper,
  label,
  name,
  registration,
  required = false,
  wrapperClassName,
  ...props
}: FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const errorId = `${name}-error`;
  const helperId = `${name}-helper`;
  const translatedError = translateError(dictionary, error);

  return (
    <div className={["space-y-2", wrapperClassName].filter(Boolean).join(" ")}>
      <Label htmlFor={name} required={required}>{label}</Label>
      <Textarea
        aria-describedby={translatedError ? errorId : helper ? helperId : undefined}
        aria-invalid={Boolean(translatedError)}
        id={name}
        {...registration}
        {...props}
      />
      {translatedError ? (
        <FormError id={errorId}>{translatedError}</FormError>
      ) : helper ? (
        <p className="text-base text-muted-foreground md:text-sm" id={helperId}>{helper}</p>
      ) : null}
    </div>
  );
}

type RadioGroupProps = {
  dictionary: Dictionary;
  error?: string;
  helper?: string;
  legend: string;
  name: string;
  options: Array<{ label: string; value: string }>;
  registration: UseFormRegisterReturn;
  required?: boolean;
  wrapperClassName?: string;
};

export function RadioGroup({
  dictionary,
  error,
  helper,
  legend,
  name,
  options,
  registration,
  required = false,
  wrapperClassName,
}: RadioGroupProps) {
  const errorId = `${name}-error`;
  const helperId = `${name}-helper`;
  const translatedError = translateError(dictionary, error);

  return (
    <fieldset
      aria-describedby={translatedError ? errorId : helper ? helperId : undefined}
      aria-invalid={Boolean(translatedError)}
      className={[
        "space-y-2 rounded-2xl",
        translatedError ? "border border-danger bg-danger-surface p-3" : "",
        wrapperClassName,
      ].filter(Boolean).join(" ")}
      id={name}
      tabIndex={-1}
    >
      <legend className="text-base font-medium text-foreground md:text-sm">
        {legend}
        {required ? <span className="ml-1 text-muted-foreground" aria-hidden="true">*</span> : null}
      </legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <Radio key={option.value} label={option.label} value={option.value} {...registration} />
        ))}
      </div>
      {translatedError ? (
        <FormError id={errorId}>{translatedError}</FormError>
      ) : helper ? (
        <p className="text-base text-muted-foreground md:text-sm" id={helperId}>{helper}</p>
      ) : null}
    </fieldset>
  );
}

export function RequestFormShell({
  children,
  dictionary,
  formId,
  hasErrors,
  isSubmitting,
  onSubmit,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
  formId?: string;
  hasErrors: boolean;
  isSubmitting: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
    <form id={formId} className="space-y-5" noValidate onSubmit={onSubmit}>
      {hasErrors ? (
        <div className="status-danger flex items-start gap-2 rounded-2xl px-4 py-3 text-base md:text-sm" role="alert">
          <span aria-hidden="true" className="mt-1 size-1.5 shrink-0 rounded-full bg-danger" />
          <span>{dictionary.forms.common.requiredFieldsMessage}</span>
        </div>
      ) : null}
      {children}
      {!formId ? (
        <div className="flex justify-center sm:justify-start">
          <Button disabled={isSubmitting} type="submit">
            {dictionary.forms.common.submit}
          </Button>
        </div>
      ) : null}
    </form>
  );
}

export function scrollToFirstError<TValues extends FieldValues>(errors: FieldErrors<TValues>) {
  const firstKey = Object.keys(errors)[0] as Path<TValues> | undefined;

  if (!firstKey) {
    return;
  }

  const target = document.getElementById(firstKey)
    ?? document.querySelector<HTMLElement>(`[data-field-id~="${firstKey}"]`);

  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  target?.focus();
}
