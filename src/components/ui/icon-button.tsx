import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ACTION_SIZES, ACTION_VARIANTS, Button } from "./button";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
};

export function IconButton({
  children,
  className,
  label,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <Button
      aria-label={label}
      className={className}
      icon={children}
      size={ACTION_SIZES.ICON}
      type={type}
      variant={ACTION_VARIANTS.ICON}
      {...props}
    />
  );
}
