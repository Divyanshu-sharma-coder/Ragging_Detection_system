import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "danger";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = "default", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60";
  const styles: Record<ButtonVariant, string> = {
    default: "bg-blue-600 text-white hover:bg-blue-500",
    outline: "border border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-500",
  };

  return <button className={cn(base, styles[variant], className)} {...props} />;
}
