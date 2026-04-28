import type { BankAdapter, BankTransaction } from "./adapter";

// In-memory queue shared across requests in dev
const queue: BankTransaction[] = [];

export class MockBankAdapter implements BankAdapter {
  readonly name = "mock";

  async getIncomingTransactions(since: Date): Promise<BankTransaction[]> {
    return queue.filter((t) => t.receivedAt > since);
  }
}

export function injectMockPayment(amount: number): BankTransaction {
  const tx: BankTransaction = {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    amount,
    senderName: "Test Sender",
    description: "Test payment",
    receivedAt: new Date(),
  };
  queue.push(tx);
  return tx;
}
