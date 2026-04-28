import type { BankAdapter, BankTransaction } from "./adapter";

// Credit Agricole Ukraine Open Banking API
// Docs: https://developer.credit-agricole.ua/
// Requires: Client ID + Client Secret obtained from the developer portal.
// After registration at developer.credit-agricole.ua, the bank generates credentials
// that allow read-only access to transaction history.

interface CATx {
  transactionId: string;
  bookingDate: string;       // "YYYY-MM-DD"
  valueDate: string;
  transactionAmount: {
    amount: string;          // "150.50"
    currency: string;        // "UAH"
  };
  creditorName?: string;
  debtorName?: string;
  remittanceInformationUnstructured?: string;
  creditDebitIndicator: "CRDT" | "DBIT";
}

interface CATokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface CATransactionResponse {
  transactions: {
    booked: CATx[];
    pending?: CATx[];
  };
}

export class CreditAgricoleAdapter implements BankAdapter {
  readonly name = "creditagricole";

  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
    private iban: string
  ) {}

  private async ensureToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 30_000) {
      return this.accessToken;
    }

    const res = await fetch(
      "https://openbanking.credit-agricole.ua/auth/realms/psd2/protocol/openid-connect/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Credit Agricole auth error ${res.status}: ${text}`);
    }

    const data: CATokenResponse = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    const token = await this.ensureToken();

    const dateFrom = since.toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);

    // IBAN encoded in URL path
    const encodedIban = encodeURIComponent(this.iban);
    const url = `https://openbanking.credit-agricole.ua/v1/accounts/${encodedIban}/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}&bookingStatus=booked`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Credit Agricole API error ${res.status}: ${text}`);
    }

    const data: CATransactionResponse = await res.json();
    const booked = data.transactions?.booked ?? [];

    return booked
      .filter((tx) => {
        if (tx.creditDebitIndicator !== "CRDT") return false; // only incoming
        const date = new Date(tx.bookingDate);
        return date > since;
      })
      .map((tx) => {
        const amountUah = parseFloat(tx.transactionAmount.amount);
        return {
          id: tx.transactionId,
          amount: Math.round(amountUah * 100), // to kopecks
          senderName: tx.debtorName || undefined,
          description: tx.remittanceInformationUnstructured || undefined,
          receivedAt: new Date(tx.bookingDate),
        };
      });
  }
}
