import { createHmac } from "crypto";
import { cookies } from "next/headers";

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
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return false;
  return verifyAdminToken(token);
}

export { COOKIE as ADMIN_COOKIE };
