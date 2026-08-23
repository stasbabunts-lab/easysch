import { redirect } from "next/navigation";
import fs from "fs";
import path from "path";
import { auth } from "@/lib/auth";

export const metadata = { title: "Пирог" };

// Internal, unlinked CBT tool — same auth as /board. Rendered as an isolated
// <iframe srcdoc> like the other board prototypes; state lives in localStorage
// (same-origin srcdoc), so there is no API or DB involvement here.
export const dynamic = "force-dynamic";

export default async function PsyPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const html = fs.readFileSync(
    path.join(process.cwd(), "src/app/board/psy/psy.html"),
    "utf8"
  );

  return (
    <iframe
      srcDoc={html}
      title="Пирог"
      allow="fullscreen"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0 }}
    />
  );
}
