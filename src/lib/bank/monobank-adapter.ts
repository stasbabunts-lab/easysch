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

  // Resolved card → Monobank account id, cached so we don't call client-info on
  // every poll (key: `${token}:${last4}`).
  private static accountCache = new Map<string, string>();

  // cardNumber (optional): when set, only this card's account is polled — so a
  // single token covering several cards doesn't cross-match other cards' payments.
  constructor(private token: string, private cardNumber?: string) {}

  /**
   * Returns the Monobank account id to poll.
   * - no card configured → "0" (default account, legacy behaviour)
   * - card configured & resolved → that card's account id
   * - card configured but NOT resolvable → null (caller must match nothing, never
   *   fall back to the default card — that could be a different card on the token)
   */
  private async resolveAccountId(): Promise<string | null> {
    if (!this.cardNumber) return "0";
    const last4 = this.cardNumber.replace(/\D/g, "").slice(-4);
    if (last4.length < 4) return null;

    const key = `${this.token}:${last4}`;
    const cached = MonobankAdapter.accountCache.get(key);
    if (cached) return cached;

    let res: Response;
    try {
      res = await fetch("https://api.monobank.ua/personal/client-info", {
        headers: { "X-Token": this.token },
        cache: "no-store",
      });
    } catch {
      return null;
    }
    if (!res.ok) return null; // e.g. 429 rate limit — try again next poll, match nothing now

    const data: { accounts?: { id: string; maskedPan?: string[] }[] } = await res.json();
    const account = (data.accounts ?? []).find((a) =>
      (a.maskedPan ?? []).some((pan) => pan.replace(/\D/g, "").slice(-4) === last4)
    );
    if (!account) return null; // card not found on this token — don't risk a wrong match

    MonobankAdapter.accountCache.set(key, account.id);
    return account.id;
  }

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    const from = Math.floor(since.getTime() / 1000);
    const to = Math.floor(Date.now() / 1000);

    const account = await this.resolveAccountId();
    if (account === null) return []; // configured card not resolvable yet — match nothing

    const url = `https://api.monobank.ua/personal/statement/${account}/${from}/${to}`;
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
