import type { BankAdapter, BankTransaction } from "./adapter";

interface MonoTx {
  id: string;
  time: number;           // Unix timestamp
  amount: number;         // kopecks; positive = income
  counterName?: string;
  comment?: string;
}

export class MonobankAdapter implements BankAdapter {
  readonly name = "monobank";

  constructor(private token: string) {}

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    const from = Math.floor(since.getTime() / 1000);
    const to = Math.floor(Date.now() / 1000);

    // account "0" = default card; adjust if needed
    const url = `https://api.monobank.ua/personal/statement/0/${from}/${to}`;
    const res = await fetch(url, {
      headers: { "X-Token": this.token },
      // Monobank allows 1 request per 60 s; Next.js server-side fetch by default caches — disable it
      cache: "no-store",
    });

    if (!res.ok) {
      // 429 = rate limit exceeded, silently skip
      if (res.status === 429) return [];
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Monobank API error ${res.status}: ${text}`);
    }

    const data: MonoTx[] = await res.json();

    return data
      .filter((tx) => tx.amount > 0) // incoming only
      .map((tx) => ({
        id: tx.id,
        amount: tx.amount,
        senderName: tx.counterName,
        description: tx.comment,
        receivedAt: new Date(tx.time * 1000),
      }));
  }
}
