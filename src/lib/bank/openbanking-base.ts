/**
 * Shared base for banks that follow the Berlin Group / ISO 20022 Open Banking
 * standard: OAuth2 client_credentials → Bearer token → /accounts/{iban}/transactions
 *
 * Most Ukrainian banks that support Open Banking use this pattern.
 */
import type { BankAdapter, BankTransaction } from "./adapter";

interface OBTx {
  transactionId?: string;
  entryReference?: string;
  bookingDate: string;          // "YYYY-MM-DD"
  valueDate?: string;
  transactionAmount: {
    amount: string;             // "150.50"
    currency: string;
  };
  debtorName?: string;
  creditorName?: string;
  remittanceInformationUnstructured?: string;
  creditDebitIndicator: "CRDT" | "DBIT";
}

interface OBResponse {
  transactions?: {
    booked?: OBTx[];
    pending?: OBTx[];
  };
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export abstract class OpenBankingBase implements BankAdapter {
  abstract readonly name: string;
  protected abstract tokenUrl: string;
  protected abstract statementsBaseUrl: string;

  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    protected clientId: string,
    protected clientSecret: string,
    protected iban: string
  ) {}

  protected async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 30_000) {
      return this.accessToken;
    }
    const res = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`[${this.name}] Auth error ${res.status}: ${text}`);
    }
    const data: TokenResponse = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    const token = await this.getToken();
    const dateFrom = since.toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);
    const encodedIban = encodeURIComponent(this.iban);

    const url = `${this.statementsBaseUrl}/${encodedIban}/transactions?dateFrom=${dateFrom}&dateTo=${dateTo}&bookingStatus=booked`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`[${this.name}] API error ${res.status}: ${text}`);
    }

    const data: OBResponse = await res.json();
    const booked = data.transactions?.booked ?? [];

    return booked
      .filter((tx) => tx.creditDebitIndicator === "CRDT")
      .map((tx) => ({
        id: tx.transactionId ?? tx.entryReference ?? `${this.name}-${tx.bookingDate}-${tx.transactionAmount.amount}`,
        amount: Math.round(parseFloat(tx.transactionAmount.amount) * 100),
        senderName: tx.debtorName,
        description: tx.remittanceInformationUnstructured,
        receivedAt: new Date(tx.bookingDate),
      }));
  }
}
