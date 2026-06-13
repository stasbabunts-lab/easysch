"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Calendar } from "lucide-react";

// Always-DD.MM.YYYY date field. Replaces native <input type="date">, whose
// display follows the browser locale (MM/DD/YYYY on en-US). The value emitted to
// callers and submitted in forms is always canonical ISO "YYYY-MM-DD".

function digitsToDisplay(digits: string) {
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  let s = d;
  if (digits.length > 2) s += "." + m;
  if (digits.length > 4) s += "." + y;
  return s;
}

function digitsToIso(digits: string) {
  if (digits.length < 8) return "";
  const d = Math.min(31, Math.max(1, parseInt(digits.slice(0, 2), 10)));
  const m = Math.min(12, Math.max(1, parseInt(digits.slice(2, 4), 10)));
  const y = parseInt(digits.slice(4, 8), 10);
  if (!d || !m || !y) return "";
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function isoToDigits(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return match ? match[3] + match[2] + match[1] : "";
}

function isoToDisplay(iso: string) {
  return digitsToDisplay(isoToDigits(iso));
}

interface DateInputProps {
  value?: string;
  defaultValue?: string;
  onChange?: (e: { target: { value: string } }) => void;
  name?: string;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, defaultValue, onChange, name, id, required, disabled, className },
  ref
) {
  const controlled = value !== undefined;
  const [text, setText] = useState(() => isoToDisplay(value ?? defaultValue ?? ""));
  const editing = useRef(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (controlled && !editing.current) setText(isoToDisplay(value ?? ""));
  }, [value, controlled]);

  const canonical = digitsToIso(text.replace(/\D/g, ""));

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="ДД.ММ.РРРР"
          maxLength={10}
          required={required}
          disabled={disabled}
          className={className ? `${className} pr-9` : "pr-9"}
          value={text}
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
            setText(digitsToDisplay(digits));
            if (digits.length === 8) onChange?.({ target: { value: digitsToIso(digits) } });
          }}
          onBlur={() => {
            editing.current = false;
            const iso = digitsToIso(text.replace(/\D/g, ""));
            if (iso) setText(isoToDisplay(iso));
            onChange?.({ target: { value: iso } });
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={openPicker}
          aria-label="Відкрити календар"
          className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" />
        </button>
        {/* Hidden native date input — only used to render the browser's calendar popup. */}
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={canonical}
          disabled={disabled}
          onChange={(e) => {
            const iso = e.target.value;
            setText(isoToDisplay(iso));
            onChange?.({ target: { value: iso } });
          }}
          className="pointer-events-none absolute right-2 bottom-0 h-0 w-0 opacity-0"
        />
      </div>
      {name && <input type="hidden" name={name} value={canonical} />}
    </>
  );
});
