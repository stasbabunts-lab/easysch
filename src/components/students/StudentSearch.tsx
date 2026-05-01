"use client";

import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useRef } from "react";

export function StudentSearch({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    clearTimeout(timer.current);
    const q = e.target.value.trim();
    timer.current = setTimeout(() => {
      router.replace(q ? `?q=${encodeURIComponent(q)}` : "?");
    }, 200);
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        defaultValue={defaultValue}
        onChange={handleChange}
        placeholder="Пошук клієнта..."
        className="pl-9"
      />
    </div>
  );
}
