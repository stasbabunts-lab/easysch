"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Registration is handled automatically via Google sign-in on the login page
export default function RegisterPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/login"); }, [router]);
  return null;
}
