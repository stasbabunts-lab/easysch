import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pollPayments } from "@/lib/poller";
import { injectMockPayment } from "@/lib/bank/mock-adapter";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Dev-only: inject a mock payment for testing
  const { mockAmount } = await req.json().catch(() => ({ mockAmount: undefined }));
  if (mockAmount && process.env.NODE_ENV !== "production") {
    injectMockPayment(Math.round(Number(mockAmount) * 100));
  }

  const matched = await pollPayments(session.user.id);
  return NextResponse.json({ matched });
}
