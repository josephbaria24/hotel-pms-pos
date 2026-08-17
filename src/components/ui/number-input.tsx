"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

type NumberInputProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "onChange"
> & {
  value: number | "";
  onValueChange: (value: number | "") => void;
};

/** Number field that can be cleared (empty) instead of snapping back to 0. */
export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput({ value, onValueChange, ...props }, ref) {
    return (
      <Input
        {...props}
        ref={ref}
        type="number"
        value={value === "" || value == null ? "" : value}
        onChange={(e) => {
          const raw = e.target.value;
          onValueChange(raw === "" ? "" : Number(raw));
        }}
      />
    );
  },
);

export function numberOrZero(value: number | ""): number {
  return value === "" || Number.isNaN(Number(value)) ? 0 : Number(value);
}
