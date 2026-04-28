import { OpenBankingBase } from "./openbanking-base";

/**
 * Raiffeisen Bank Aval Ukraine
 * Docs:     https://raiffeisen.ua/en/aem/korporatyvnym-klientam/open-api.html
 * Creds:    Email cm.sales@raiffeisen.ua — request API access (Client ID + Secret)
 * Auth:     OAuth2 client_credentials
 * Format:   Berlin Group Open Banking (ISO 20022)
 */
export class RaiffeisenAdapter extends OpenBankingBase {
  readonly name = "raiffeisen";
  protected tokenUrl = "https://openapi.aval.ua/auth/realms/openbanking/protocol/openid-connect/token";
  protected statementsBaseUrl = "https://openapi.aval.ua/v1/accounts";
}
