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
  // See DateInput: echoes of our own change are ignored; external changes
  // (mouse-wheel stepping) are reflected even while the field is focused.
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (!controlled) return;
    if (value === lastEmitted.current) return;
    lastEmitted.current = value;
    setText(value ?? "");
  }, [value, controlled]);

  const emit = (v: string) => {
    lastEmitted.current = v;
    onChange?.({ target: { value: v } });
  };

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
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setText(toDisplay(digits));
          if (digits.length === 4) emit(normalize(digits));
        }}
        onBlur={() => {
          const v = normalize(text.replace(/\D/g, ""));
          setText(v);
          emit(v);
        }}
      />
      {name && <input type="hidden" name={name} value={canonical} />}
    </>
  );
});
