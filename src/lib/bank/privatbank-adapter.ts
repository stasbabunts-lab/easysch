import type { BankAdapter, BankTransaction } from "./adapter";

interface PrivatTx {
  id: string;
  trandate: string;   // "DD.MM.YYYY"
  trantime: string;   // "HH:MM:SS"
  credit: string;     // incoming amount as string, e.g. "150.50"
  debet: string;      // outgoing amount
  currency: string;
  osnd: string;       // payment description
  ante: string;       // sender name (sometimes)
}

interface PrivatResponse {
  transactions: PrivatTx[] | { transaction: PrivatTx | PrivatTx[] };
  exist_more_data: boolean;
}

function parsePrivatDate(date: string, time: string): Date {
  // date: "DD.MM.YYYY", time: "HH:MM:SS"
  const [d, m, y] = date.split(".");
  return new Date(`${y}-${m}-${d}T${time}`);
}

export class PrivatbankAdapter implements BankAdapter {
  readonly name = "privatbank";

  constructor(
    private clientId: string,
    private token: string
  ) {}

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    // PrivatBank ACP API — returns interim (current day) + recent statement
    // Docs: https://api.privatbank.ua/#p24/orders
    const res = await fetch(
      "https://acp.privatbank.ua/api/statements/transactions/interim",
      {
        headers: {
          id: this.clientId,
          token: this.token,
          "Content-Type": "application/json;charset=utf8",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`PrivatBank API error ${res.status}: ${text}`);
    }

    const data: PrivatResponse = await res.json();

    // Normalise: API can return transactions as array or as object with nested array
    let rawList: PrivatTx[] = [];
    if (Array.isArray(data.transactions)) {
      rawList = data.transactions;
    } else if (data.transactions?.transaction) {
      const t = data.transactions.transaction;
      rawList = Array.isArray(t) ? t : [t];
    }

    return rawList
      .filter((tx) => {
        const creditAmt = parseFloat(tx.credit);
        if (!creditAmt || creditAmt <= 0) return false; // only incoming
        const date = parsePrivatDate(tx.trandate, tx.trantime);
        return date > since;
      })
      .map((tx) => {
        const amountUah = parseFloat(tx.credit);
        return {
          id: tx.id,
          // Convert UAH to kopecks (hundredths)
          amount: Math.round(amountUah * 100),
          senderName: tx.ante || undefined,
          description: tx.osnd || undefined,
          receivedAt: parsePrivatDate(tx.trandate, tx.trantime),
        };
      });
  }
}
