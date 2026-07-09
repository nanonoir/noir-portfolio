import type { FieldErrors, FieldValues, Path, UseFormRegisterReturn } from "react-hook-form";
import type { Dictionary } from "@/lib/i18n";
import { Button, FormError, Input, Label, Radio, Textarea } from "@/components/ui";

type FieldProps = {
  dictionary: Dictionary;
  error?: string;
  helper?: string;
  label: string;
  name: string;
  registration: UseFormRegisterReturn;
  required?: boolean;
  wrapperClassName?: string;
};

function translateError(dictionary: Dictionary, message?: string) {
  if (!message) {
    return undefined;
  }

  const key = message.replace("forms.errors.", "") as keyof Dictionary["forms"]["errors"];
  return dictionary.forms.errors[key] ?? message;
}

export function TextField({
  dictionary,
  error,
  helper,
  label,
  name,
  registration,
  required = false,
  wrapperClassName,
  ...props
}: FieldProps & React.InputHTMLAttributes<HTMLInputElement>) {
  const errorId = `${name}-error`;
  const helperId = `${name}-helper`;
  const translatedError = translateError(dictionary, error);

  return (
    <div className={["space-y-2", wrapperClassName].filter(Boolean).join(" ")}>
      <Label htmlFor={name} required={required}>{label}</Label>
      <Input
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
    <fieldset aria-describedby={translatedError ? errorId : helper ? helperId : undefined} className={["space-y-2", wrapperClassName].filter(Boolean).join(" ")}>
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
  hasErrors,
  isSubmitting,
  onSubmit,
}: {
  children: React.ReactNode;
  dictionary: Dictionary;
  hasErrors: boolean;
  isSubmitting: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
}) {
  return (
    <form className="space-y-5" noValidate onSubmit={onSubmit}>
      {hasErrors ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-base text-red-500 md:text-sm" role="alert">
          {dictionary.forms.common.requiredFieldsMessage}
        </div>
      ) : null}
      {children}
      <div className="flex justify-center sm:justify-start">
        <Button disabled={isSubmitting} type="submit">
          {dictionary.forms.common.submit}
        </Button>
      </div>
    </form>
  );
}

export function scrollToFirstError<TValues extends FieldValues>(errors: FieldErrors<TValues>) {
  const firstKey = Object.keys(errors)[0] as Path<TValues> | undefined;

  if (!firstKey) {
    return;
  }

  document.getElementById(firstKey)?.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById(firstKey)?.focus();
}
