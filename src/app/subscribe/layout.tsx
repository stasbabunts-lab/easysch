import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SubscribeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-muted/20">
      {children}
    </div>
  );
}
