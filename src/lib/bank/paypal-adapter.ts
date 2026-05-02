import type { BankAdapter, BankTransaction } from "./adapter";

/**
 * PayPal Transaction Search API
 * Docs:  https://developer.paypal.com/api/transaction-search/v1/
 * Creds: Client ID + Secret from developer.paypal.com (Live app)
 * Auth:  OAuth2 client_credentials
 * Note:  PayPal does not support UAH — amounts are in USD/EUR cents.
 */

interface PayPalTokenResponse {
  access_token: string;
  expires_in: number;
}

interface PayPalTxInfo {
  transaction_id: string;
  transaction_amount: { currency_code: string; value: string };
  transaction_initiation_date: string; // ISO 8601
  transaction_event_code: string;      // T0006 = web payment received
  transaction_status: string;          // S = success
}

interface PayPalTxDetail {
  transaction_info: PayPalTxInfo;
}

interface PayPalTxResponse {
  transaction_details?: PayPalTxDetail[];
  links?: { rel: string; href: string }[];
}

const API_BASE = "https://api-m.paypal.com";
const TOKEN_URL = `${API_BASE}/v1/oauth2/token`;
const TX_URL = `${API_BASE}/v1/reporting/transactions`;

// Event codes that represent incoming payments to the account owner
const INCOMING_CODES = new Set([
  "T0006", // Express Checkout / web payment received
  "T0011", // PayPal account-to-account transfer (received)
  "T0051", // PayPal debit card payment (received)
  "T1201", // Dispute reversal — refund received
]);

export class PayPalAdapter implements BankAdapter {
  readonly name = "paypal";

  private accessToken: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  private async getToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry - 30_000) {
      return this.accessToken;
    }
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`[paypal] Auth error ${res.status}: ${text}`);
    }
    const data: PayPalTokenResponse = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1000;
    return this.accessToken;
  }

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    const token = await this.getToken();

    const startDate = since.toISOString().replace(/\.\d{3}Z$/, "-0700");
    const endDate = new Date().toISOString().replace(/\.\d{3}Z$/, "-0700");

    const params = new URLSearchParams({
      start_date: since.toISOString().slice(0, 19) + "+0000",
      end_date: new Date().toISOString().slice(0, 19) + "+0000",
      transaction_status: "S",
      fields: "transaction_info",
      page_size: "500",
      page: "1",
    });

    const res = await fetch(`${TX_URL}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`[paypal] API error ${res.status}: ${text}`);
    }

    const data: PayPalTxResponse = await res.json();
    const details = data.transaction_details ?? [];

    return details
      .map((d) => d.transaction_info)
      .filter(
        (tx) =>
          INCOMING_CODES.has(tx.transaction_event_code) &&
          tx.transaction_status === "S" &&
          parseFloat(tx.transaction_amount.value) > 0
      )
      .map((tx) => ({
        id: tx.transaction_id,
        amount: Math.round(parseFloat(tx.transaction_amount.value) * 100),
        receivedAt: new Date(tx.transaction_initiation_date),
      }));
  }
}
