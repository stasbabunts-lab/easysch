"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const SEEN_KEY = "esch_guide_seen";

// On a teacher's very first visit (per browser) send them to the onboarding guide
// once. The flag is set immediately so subsequent navigations are never disturbed.
export function FirstVisitGuide() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
      localStorage.setItem(SEEN_KEY, "1");
      if (pathname !== "/dashboard/guide") {
        router.replace("/dashboard/guide");
      }
    } catch {
      // localStorage unavailable (private mode etc.) — ignore, no redirect.
    }
  }, [pathname, router]);

  return null;
}
