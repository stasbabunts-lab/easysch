"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/labels";
import { Layers } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      setError("Невірний email або пароль");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] shrink-0 bg-sidebar p-10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Layers className="h-4 w-4 text-white" />
          </div>
          <span className="text-[16px] font-semibold text-white tracking-tight">{APP_NAME}</span>
        </div>
        <p className="text-xs text-white/30">© 2025 {APP_NAME}</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-sm space-y-7">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Layers className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Увійти в кабінет</h1>
            <p className="text-muted-foreground text-sm mt-1">Введіть свої дані для входу</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                className="h-10"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Пароль</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                className="h-10"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/8 px-3 py-2 rounded-lg">{error}</p>
            )}
            <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
              {loading ? "Входимо..." : "Увійти"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Немає акаунту?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Зареєструватися
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
