import { redirect } from "next/navigation";
import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth";

export const metadata = { title: "Доска" };

// Internal, unlinked, auth-only goal board. The prototype runs inside an isolated
// <iframe srcdoc> so its global CSS/JS can never collide with the main app; it is
// same-origin, so its fetches to /api/board and /api/reminders carry the session.
export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const html = fs.readFileSync(
    path.join(process.cwd(), "src/app/board/board.html"),
    "utf8"
  );

  return (
    <iframe
      srcDoc={html}
      title="Доска целей"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
