"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

// Always-24h time field (HH:MM). Replaces native <input type="time">, whose
// display follows the browser locale (12h AM/PM on en-US). The value emitted to
// callers and submitted in forms is always canonical "HH:MM".

function toDisplay(digits: string) {
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

function normalize(digits: string) {
  if (!digits) return "";
  const h = Math.min(23, parseInt(digits.slice(0, 2) || "0", 10) || 0);
  const m = Math.min(59, parseInt(digits.slice(2, 4) || "0", 10) || 0);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface TimeInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
  { value, defaultValue, onChange, name, id, required, disabled, className },
  ref
) {
  const controlled = value !== undefined;
  const [text, setText] = useState(() => value ?? defaultValue ?? "");
  const editing = useRef(false);

  useEffect(() => {
    if (controlled && !editing.current) setText(value ?? "");
  }, [value, controlled]);

  const canonical = /^\d{2}:\d{2}$/.test(text) ? text : normalize(text.replace(/\D/g, ""));

  return (
    <>
      <Input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="00:00"
        maxLength={5}
        required={required}
        disabled={disabled}
        className={className}
        value={text}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setText(toDisplay(digits));
          if (digits.length === 4) onChange?.({ target: { value: normalize(digits) } });
        }}
        onBlur={() => {
          editing.current = false;
          const v = normalize(text.replace(/\D/g, ""));
          setText(v);
          onChange?.({ target: { value: v } });
        }}
      />
      {name && <input type="hidden" name={name} value={canonical} />}
    </>
  );
});
