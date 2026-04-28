import type { BankAdapter, BankTransaction } from "./adapter";

/**
 * PUMB — Перший Український Міжнародний Банк
 * Docs:  https://www.pumb.ua/en/open_api
 * Creds: Register at pumb.ua/open_api → get Merchant ID + API Key
 * Auth:  API Key in header (X-Api-Key) + Merchant ID
 * Note:  PUMB uses their own JSON format (not Berlin Group)
 */

interface PUMBTx {
  id: string;
  date: string;          // "YYYY-MM-DDTHH:MM:SS"
  amount: number;        // positive = credit, negative = debit (in kopecks or UAH — verify)
  currency: string;
  description: string;
  counterparty?: string;
  direction: "CREDIT" | "DEBIT";
}

interface PUMBResponse {
  data: PUMBTx[];
  total: number;
}

export class PumbAdapter implements BankAdapter {
  readonly name = "pumb";

  constructor(
    private merchantId: string,
    private apiKey: string,
    private iban: string
  ) {}

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    const dateFrom = since.toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);

    const url = `https://api.pumb.ua/v1/accounts/${encodeURIComponent(this.iban)}/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}`;

    const res = await fetch(url, {
      headers: {
        "X-Api-Key": this.apiKey,
        "X-Merchant-Id": this.merchantId,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`PUMB API error ${res.status}: ${text}`);
    }

    const data: PUMBResponse = await res.json();

    return (data.data ?? [])
      .filter((tx) => tx.direction === "CREDIT")
      .filter((tx) => new Date(tx.date) > since)
      .map((tx) => ({
        id: tx.id,
        // Amount might be in UAH — multiply by 100 for kopecks
        amount: tx.amount < 1000 ? Math.round(tx.amount * 100) : tx.amount,
        senderName: tx.counterparty,
        description: tx.description,
        receivedAt: new Date(tx.date),
      }));
  }
}
