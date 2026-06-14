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
  // When set, scrolling the mouse wheel over the field steps the time by this
  // many minutes (e.g. 60 = one hour), wrapping at midnight. Opt-in so other
  // usages keep the plain typing-only behaviour.
  wheelStepMinutes?: number;
}

export const TimeInput = forwardRef<HTMLInputElement, TimeInputProps>(function TimeInput(
  { value, defaultValue, onChange, name, id, required, disabled, className, wheelStepMinutes },
  ref
) {
  const controlled = value !== undefined;
  const [text, setText] = useState(() => value ?? defaultValue ?? "");
  // See DateInput: echoes of our own change are ignored; external changes
  // (mouse-wheel stepping) are reflected even while the field is focused.
  const lastEmitted = useRef(value);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  // Keep the latest committed time in a ref so the native wheel listener
  // (attached once) always steps from the current value.
  const canonicalRef = useRef(canonical);
  canonicalRef.current = canonical;

  // Native non-passive wheel listener — React's synthetic onWheel is passive at
  // the root, so preventDefault (to stop the page scrolling) wouldn't work there.
  useEffect(() => {
    if (!wheelStepMinutes || disabled) return;
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const base = /^\d{2}:\d{2}$/.test(canonicalRef.current) ? canonicalRef.current : "00:00";
      const [h, m] = base.split(":").map(Number);
      let total = h * 60 + m + (e.deltaY < 0 ? 1 : -1) * wheelStepMinutes;
      total = ((total % 1440) + 1440) % 1440;
      const v = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
      setText(v);
      emit(v);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // emit/setText identities are stable for the lifetime of these deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wheelStepMinutes, disabled]);

  return (
    <div ref={wrapRef}>
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
        title={wheelStepMinutes ? "Прокрутіть колесом миші, щоб змінити час" : undefined}
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
    </div>
  );
});
