export interface BankTransaction {
  id: string;
  amount: number; // in kopecks
  senderName?: string;
  description?: string;
  receivedAt: Date;
}

export interface BankAdapter {
  readonly name: string;
  getIncomingTransactions(since: Date): Promise<BankTransaction[]>;
}
