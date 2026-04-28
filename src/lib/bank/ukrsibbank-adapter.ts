import { OpenBankingBase } from "./openbanking-base";

/**
 * Ukrsibbank (BNP Paribas Group Ukraine)
 * Docs:     https://ukrsibbank.com/open-banking/account-information-service/
 * Creds:    Email open.banking@ukrsibbank.com — request TPP access
 * Auth:     OAuth2 client_credentials
 * Format:   Berlin Group Open Banking
 */
export class UkrsibbankAdapter extends OpenBankingBase {
  readonly name = "ukrsibbank";
  protected tokenUrl = "https://openbanking.ukrsibbank.com/auth/token";
  protected statementsBaseUrl = "https://openbanking.ukrsibbank.com/v2/accounts";
}
