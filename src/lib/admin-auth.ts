import { createHmac } from "crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

const COOKIE = "easysch_admin";
const SECRET = process.env.ADMIN_SECRET ?? "fallback-secret-change-in-prod";

export function signAdminToken(): string {
  const payload = Date.now().toString();
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string): boolean {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const expected = createHmac("sha256", SECRET).update(payload).digest("hex");
  return expected === sig;
}

export async function isAdminAuthenticated(): Promise<boolean> {
  // 1. Check admin cookie (password-based login)
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token && verifyAdminToken(token)) return true;

  // 2. Check NextAuth session — if logged in as ADMIN_EMAIL, grant access
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const session = await auth();
    if (session?.user?.email === adminEmail) return true;
  }

  return false;
}

export { COOKIE as ADMIN_COOKIE };
