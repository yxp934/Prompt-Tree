"use client";

import type { ButtonHTMLAttributes } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-[10px] px-4 py-2 font-body text-[0.85rem] font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60";

  const variants: Record<"primary" | "secondary" | "ghost", string> = {
    primary: "bg-ink text-cream hover:bg-charcoal",
    secondary:
      "border border-parchment bg-paper text-ink hover:border-copper hover:bg-copper-glow",
    ghost: "bg-transparent text-clay hover:bg-paper hover:text-ink",
  };

  return (
    <button
      type="button"
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
