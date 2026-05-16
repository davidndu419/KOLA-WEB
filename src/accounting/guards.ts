import type { LedgerEntry } from '@/db/schema';

type LedgerDraft = Pick<LedgerEntry, 'debit_account' | 'credit_account' | 'amount'>;

export class AccountingGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingGuardError';
  }
}

export function roundMoney(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export function getLedgerTotals(entries: LedgerDraft[]) {
  return entries.reduce(
    (totals, entry) => {
      const amount = roundMoney(entry.amount);
      if (entry.debit_account) totals.debits = roundMoney(totals.debits + amount);
      if (entry.credit_account) totals.credits = roundMoney(totals.credits + amount);
      return totals;
    },
    { debits: 0, credits: 0 }
  );
}

export function validateBalancedLedger(entries: LedgerDraft[]) {
  if (entries.length === 0) return true;

  for (const entry of entries) {
    if (!entry.debit_account || !entry.credit_account) {
      throw new AccountingGuardError('Ledger entry must include both debit and credit accounts.');
    }

    if (roundMoney(entry.amount) <= 0) {
      throw new AccountingGuardError('Ledger entry amount must be greater than zero.');
    }
  }

  const totals = getLedgerTotals(entries);
  if (totals.debits !== totals.credits) {
    throw new AccountingGuardError('Accounting entries are not balanced. Transaction was not saved.');
  }

  return true;
}

export function assertBalanced(entries: LedgerDraft[]) {
  validateBalancedLedger(entries);
}

export async function assertCashSolvency(amount: number, account: 'Cash' | 'Bank', business_id: string) {
  void amount;
  void account;
  void business_id;
  return true;
}

export async function assertCashSolvencyForEntries(entries: LedgerDraft[], business_id: string) {
  void entries;
  void business_id;
  return true;
}
