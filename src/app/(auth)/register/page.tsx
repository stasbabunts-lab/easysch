"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/labels";
import { Layers } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        email: fd.get("email"),
        password: fd.get("password"),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Помилка реєстрації");
      return;
    }
    router.push("/login?registered=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 sm:p-8 bg-background">
      <div className="w-full max-w-sm space-y-7">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
            <Layers className="h-3.5 w-3.5 text-white" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Створити акаунт</h1>
          <p className="text-muted-foreground text-sm mt-1">Займе менше хвилини</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Ваше ім&apos;я</Label>
            <Input id="name" name="name" placeholder="Іван Іванов" className="h-10" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" className="h-10" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Пароль</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" className="h-10" minLength={8} required />
          </div>
          {error && (
            <p className="text-sm text-destructive bg-destructive/8 px-3 py-2 rounded-lg">{error}</p>
          )}
          <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
            {loading ? "Створюємо акаунт..." : "Створити акаунт"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Вже є акаунт?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Увійти
          </Link>
        </p>
      </div>
    </div>
  );
}
