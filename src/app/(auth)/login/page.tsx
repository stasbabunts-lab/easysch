"use client";

import { useState } from "react";
import { APP_NAME } from "@/lib/labels";
import { Logo } from "@/components/ui/Logo";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  const [error, setError] = useState("");

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-[380px] shrink-0 bg-sidebar p-10">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-[16px] font-semibold text-white tracking-tight">{APP_NAME}</span>
        </div>
        <p className="text-xs text-white/30">© 2025 {APP_NAME}</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <Logo size={28} />
            <span className="text-[15px] font-semibold tracking-tight">{APP_NAME}</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight">Увійти в кабінет</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Для входу використовуйте ваш Google акаунт
            </p>
          </div>

          <GoogleSignInButton onError={setError} />

          {error && (
            <p className="text-sm text-destructive bg-destructive/8 px-3 py-2 rounded-lg text-center">
              {error}
            </p>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Ще немає акаунту? Просто натисніть кнопку вище — акаунт створюється автоматично.
          </p>
        </div>
      </div>
    </div>
  );
}
