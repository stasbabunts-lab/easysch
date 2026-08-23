import { redirect } from "next/navigation";
import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth";

export const metadata = { title: "Напоминания" };

// Personal reminder page — same auth as /board, linked from nowhere. Runs inside an
// isolated <iframe srcdoc> like the board prototype (same-origin, so the session
// cookie reaches /api/reminders); reminders are delivered by the existing 5-min cron.
export const dynamic = "force-dynamic";

export default async function RemindersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const html = fs.readFileSync(
    path.join(process.cwd(), "src/app/board/rem/rem.html"),
    "utf8"
  );

  return (
    <iframe
      srcDoc={html}
      title="Напоминания"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
