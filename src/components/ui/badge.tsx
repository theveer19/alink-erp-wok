import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  variant = "solid",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "solid" | "outline" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variant === "outline" ? "border border-slate-200 text-slate-600" : "bg-slate-100 text-slate-700",
        className
      )}
      {...props}
    />
  );
}
