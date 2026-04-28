import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

interface Slot {
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  isRecurring: boolean;
}

async function fetchSlots(code: string) {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/public/${code}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json() as Promise<{ teacherName: string; telegramUsername: string | null; phone: string | null; slots: Slot[] }>;
}

function groupByDate(slots: Slot[]) {
  const map = new Map<string, Slot[]>();
  for (const slot of slots) {
    const existing = map.get(slot.date) ?? [];
    existing.push(slot);
    map.set(slot.date, existing);
  }
  return map;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("uk-UA", { weekday: "long", day: "numeric", month: "long" });
}

export default async function PublicSchedulePage({
  params,
}: {
  params: Promise<{ teacherCode: string }>;
}) {
  const { teacherCode } = await params;
  const data = await fetchSlots(teacherCode.toUpperCase());
  if (!data) notFound();

  const grouped = groupByDate(data.slots);
  const dates = Array.from(grouped.keys()).sort();

  return (
    <div className="min-h-screen p-4 md:p-8 pb-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3 py-6">
          <h1 className="text-3xl font-bold">{data.teacherName}</h1>
          <p className="text-muted-foreground">Вільний час на найближчі 4 тижні</p>
          {(data.telegramUsername || data.phone) && (
            <div className="flex items-center justify-center gap-3 pt-1">
              {data.telegramUsername && (
                <a
                  href={`https://t.me/${data.telegramUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#2AABEE]/10 text-[#2AABEE] border border-[#2AABEE]/30 text-sm font-medium hover:bg-[#2AABEE]/20 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.117 14.39 4.168 13.5c-.654-.204-.666-.654.136-.968l10.876-4.192c.546-.194 1.023.133.382.908z"/>
                  </svg>
                  Написати
                </a>
              )}
              {data.phone && (
                <a
                  href={`tel:${data.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-medium hover:bg-emerald-100 transition-colors"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                  </svg>
                  Подзвонити
                </a>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground justify-center">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            Щотижнево
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500"></span>
            Разове
          </div>
        </div>

        {dates.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Вільного часу поки немає.</p>
              <p className="text-sm mt-1">Зв&apos;яжіться з {data.teacherName} особисто.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {dates.map((date) => (
              <Card key={date} className="border-border/50">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-muted-foreground mb-3 capitalize">
                    {formatDate(date)}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grouped.get(date)!.map((slot, i) => (
                      <div
                        key={i}
                        className={`px-3 py-2 rounded-lg text-sm font-mono font-medium flex items-center gap-1.5 ${
                          slot.isRecurring
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        <span>{slot.startTime} – {slot.endTime}</span>
                        {slot.isRecurring ? (
                          <span
                            className="text-[10px] font-sans font-semibold bg-emerald-100 text-emerald-700 px-1 py-0.5 rounded-sm"
                            title="Щотижнево"
                          >
                            🔁
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-sans font-semibold bg-blue-100 text-blue-700 px-1 py-0.5 rounded-sm"
                            title="Разове"
                          >
                            1×
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center pt-4 space-y-2">
          <p className="text-sm text-muted-foreground">
            Щоб записатися — зв&apos;яжіться з {data.teacherName} особисто.
          </p>
          <p className="text-xs text-muted-foreground">
            Для сповіщень у Telegram введіть{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono">
              /start ВАШ_КОД
            </code>{" "}
            боту.
          </p>
        </div>
      </div>
    </div>
  );
}
