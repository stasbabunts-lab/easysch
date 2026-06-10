import type { BankAdapter } from "./adapter";
import { MockBankAdapter } from "./mock-adapter";
import { MonobankAdapter } from "./monobank-adapter";
import { PrivatbankAdapter } from "./privatbank-adapter";
import { CreditAgricoleAdapter } from "./creditagricole-adapter";
import { RaiffeisenAdapter } from "./raiffeisen-adapter";
import { UkrsibbankAdapter } from "./ukrsibbank-adapter";
import { PumbAdapter } from "./pumb-adapter";
import { PayPalAdapter } from "./paypal-adapter";
import { decrypt } from "@/lib/encryption";

function parseCreds(raw: string): Record<string, string> {
  try { return JSON.parse(decrypt(raw)); } catch { return {}; }
}

/** Build a BankAdapter from a BankAccount record */
export function getBankAdapter(bankType: string, credsJson: string): BankAdapter {
  const c = parseCreds(credsJson);

  switch (bankType) {
    case "monobank":
      if (!c.token) throw new Error("Monobank: токен не вказано");
      return new MonobankAdapter(c.token);

    case "privatbank":
      if (!c.clientId || !c.token) throw new Error("PrivatBank: clientId і token обов'язкові");
      return new PrivatbankAdapter(c.clientId, c.token);

    case "creditagricole":
      if (!c.clientId || !c.clientSecret || !c.iban)
        throw new Error("Credit Agricole: clientId, clientSecret і IBAN обов'язкові");
      return new CreditAgricoleAdapter(c.clientId, c.clientSecret, c.iban);

    case "raiffeisen":
      if (!c.clientId || !c.clientSecret || !c.iban)
        throw new Error("Raiffeisen: clientId, clientSecret і IBAN обов'язкові");
      return new RaiffeisenAdapter(c.clientId, c.clientSecret, c.iban);

    case "ukrsibbank":
      if (!c.clientId || !c.clientSecret || !c.iban)
        throw new Error("Ukrsibbank: clientId, clientSecret і IBAN обов'язкові");
      return new UkrsibbankAdapter(c.clientId, c.clientSecret, c.iban);

    case "pumb":
      if (!c.merchantId || !c.apiKey || !c.iban)
        throw new Error("PUMB: merchantId, apiKey і IBAN обов'язкові");
      return new PumbAdapter(c.merchantId, c.apiKey, c.iban);

    case "paypal":
      if (!c.clientId || !c.clientSecret)
        throw new Error("PayPal: clientId і clientSecret обов'язкові");
      return new PayPalAdapter(c.clientId, c.clientSecret);

    case "mock":
    default:
      return new MockBankAdapter();
  }
}

// ── Field definitions ──────────────────────────────────────────────────────────

type FieldDef = {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder: string;
  howToGet: { url: string; steps: string[] } | null;
};

type BankOption = {
  value: string;
  label: string;
  fields: FieldDef[];
};

const ALL_BANK_OPTIONS: BankOption[] = [
  {
    value: "monobank",
    label: "Monobank",
    fields: [
      {
        key: "token",
        label: "Токен API",
        type: "password",
        placeholder: "uXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        howToGet: {
          url: "https://api.monobank.ua/",
          steps: [
            "Перейдіть на api.monobank.ua",
            "Натисніть «Отримати токен»",
            "Підтвердьте у застосунку Monobank",
            "Скопіюйте токен та вставте сюди",
          ],
        },
      },
    ],
  },
  {
    value: "privatbank",
    label: "ПриватБанк",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "Ваш Client ID",
        howToGet: {
          url: "https://acp.privatbank.ua/",
          steps: [
            "Увійдіть в acp.privatbank.ua",
            "Відкрийте розділ «API-доступ»",
            "Створіть новий доступ — отримаєте Client ID і Token",
          ],
        },
      },
      {
        key: "token",
        label: "Token",
        type: "password",
        placeholder: "Ваш токен з особистого кабінету",
        howToGet: null,
      },
    ],
  },
  {
    value: "raiffeisen",
    label: "Raiffeisen Bank Aval",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "Client ID від банку",
        howToGet: {
          url: "https://raiffeisen.ua/en/aem/korporatyvnym-klientam/open-api.html",
          steps: [
            "Надішліть запит на cm.sales@raiffeisen.ua",
            "Вкажіть мету: «отримання виписки через Open Banking API»",
            "Банк надасть Client ID та Client Secret (онбординг ~1 день)",
          ],
        },
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Client Secret від банку",
        howToGet: null,
      },
      {
        key: "iban",
        label: "IBAN рахунку",
        type: "text",
        placeholder: "UA123456789012345678901234567",
        howToGet: null,
      },
    ],
  },
  {
    value: "pumb",
    label: "ПУМБ",
    fields: [
      {
        key: "merchantId",
        label: "Merchant ID",
        type: "text",
        placeholder: "Ваш Merchant ID",
        howToGet: {
          url: "https://www.pumb.ua/en/open_api",
          steps: [
            "Перейдіть на pumb.ua → Open API",
            "Зареєструйтесь як розробник",
            "Отримайте Merchant ID та API Key",
          ],
        },
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Ваш API Key",
        howToGet: null,
      },
      {
        key: "iban",
        label: "IBAN рахунку",
        type: "text",
        placeholder: "UA123456789012345678901234567",
        howToGet: null,
      },
    ],
  },
  {
    value: "creditagricole",
    label: "Credit Agricole",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "Client ID з порталу розробника",
        howToGet: {
          url: "https://developer.credit-agricole.ua/",
          steps: [
            "Зареєструйтесь на developer.credit-agricole.ua",
            "Створіть застосунок → отримайте Client ID і Client Secret",
            "Вкажіть IBAN картки/рахунку",
          ],
        },
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Client Secret з порталу розробника",
        howToGet: null,
      },
      {
        key: "iban",
        label: "IBAN рахунку",
        type: "text",
        placeholder: "UA123456789012345678901234567",
        howToGet: null,
      },
    ],
  },
  {
    value: "ukrsibbank",
    label: "Ukrsibbank",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "Client ID",
        howToGet: {
          url: "https://ukrsibbank.com/open-banking/account-information-service/",
          steps: [
            "Перейдіть на ukrsibbank.com → Open Banking",
            "Або надішліть запит на open.banking@ukrsibbank.com",
            "Отримайте Client ID і Client Secret після верифікації",
          ],
        },
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Client Secret",
        howToGet: null,
      },
      {
        key: "iban",
        label: "IBAN рахунку",
        type: "text",
        placeholder: "UA123456789012345678901234567",
        howToGet: null,
      },
    ],
  },
  {
    value: "paypal",
    label: "PayPal",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "Client ID з PayPal Developer Dashboard",
        howToGet: {
          url: "https://developer.paypal.com/dashboard/applications/live",
          steps: [
            "Перейдіть на developer.paypal.com → Apps & Credentials",
            "Оберіть режим «Live» (не Sandbox)",
            "Створіть або відкрийте застосунок",
            "Скопіюйте Client ID та Client Secret",
          ],
        },
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "Client Secret з PayPal Developer Dashboard",
        howToGet: null,
      },
    ],
  },
];

// ── Enabled integrations ────────────────────────────────────────────────────────
// Only read-only integrations are exposed for now. Money-capable APIs (PayPal,
// PUMB, PrivatBank ACP and corporate Open Banking secrets) stay in code but are
// disabled until our security posture is hardened: a leaked Monobank *personal*
// token can only read a statement, whereas a leaked credential for the others
// could potentially move funds. To re-enable one later, add its value here.
export const ENABLED_BANK_TYPES: string[] = ["monobank"];

export function isBankTypeEnabled(bankType: string): boolean {
  return ENABLED_BANK_TYPES.includes(bankType);
}

// Full catalogue — used to resolve a human label for any (incl. legacy/disabled)
// account type that may still exist on a record.
export { ALL_BANK_OPTIONS };

// Options offered in the "add bank account" selector — enabled types only.
export const BANK_OPTIONS: BankOption[] = ALL_BANK_OPTIONS.filter((o) =>
  isBankTypeEnabled(o.value)
);
