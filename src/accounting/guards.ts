import { db } from '@/db/dexie';
import type { LedgerEntry } from '@/db/schema';

type LedgerDraft = Pick<LedgerEntry, 'debit_account' | 'credit_account' | 'amount'>;

export class AccountingGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountingGuardError';
  }
}

export class SolvencyGuardError extends Error {
  constructor(message = 'Insufficient cash balance for this transaction.') {
    super(message);
    this.name = 'SolvencyGuardError';
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

export async function getAccountBalance(business_id: string, account: 'Cash' | 'Bank') {
  const entries = await db.ledger_entries
    .where('business_id')
    .equals(business_id)
    .filter((entry) => !entry.deleted_at && (entry.debit_account === account || entry.credit_account === account))
    .toArray();

  return roundMoney(entries.reduce((balance, entry) => {
    if (entry.debit_account === account) balance += entry.amount;
    if (entry.credit_account === account) balance -= entry.amount;
    return balance;
  }, 0));
}

export async function assertCashSolvency(amount: number, account: 'Cash' | 'Bank', business_id: string) {
  const required = roundMoney(amount);
  if (required <= 0) return;

  const available = await getAccountBalance(business_id, account);
  if (available < required) {
    throw new SolvencyGuardError();
  }
}

export async function assertCashSolvencyForEntries(entries: LedgerDraft[], business_id: string) {
  const accountFlows = new Map<'Cash' | 'Bank', number>();

  for (const entry of entries) {
    for (const account of ['Cash', 'Bank'] as const) {
      let netOutflow = accountFlows.get(account) || 0;
      if (entry.credit_account === account) netOutflow += roundMoney(entry.amount);
      if (entry.debit_account === account) netOutflow -= roundMoney(entry.amount);
      accountFlows.set(account, roundMoney(netOutflow));
    }
  }

  for (const [account, netOutflow] of accountFlows) {
    if (netOutflow > 0) {
      await assertCashSolvency(netOutflow, account, business_id);
    }
  }
}
