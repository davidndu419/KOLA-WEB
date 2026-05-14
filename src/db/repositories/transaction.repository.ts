import { db } from '../dexie';
import { Transaction, LedgerEntry } from '../schema';
import { BaseRepository } from './base.repository';

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor() {
    super(db.transactions, 'transactions');
  }

  async getTransactionHistory(business_id: string, limit = 100) {
    return await this.table
      .where('business_id')
      .equals(business_id)
      .reverse()
      .limit(limit)
      .toArray();
  }

  async getLedgerEntries(transaction_id: string) {
    return await db.ledger_entries
      .where('transaction_id')
      .equals(transaction_id)
      .toArray();
  }

  async search(business_id: string, query: string) {
    const q = query.toLowerCase();
    return await this.table
      .where('business_id')
      .equals(business_id)
      .filter(t => {
        const isNotDeleted = !!(!t.deleted_at);
        const matchesQuery = !!(
          t.type.toLowerCase().includes(q) || 
          t.note?.toLowerCase().includes(q) || 
          t.customer?.toLowerCase().includes(q)
        );
        return !!(isNotDeleted && matchesQuery);
      })


      .toArray();
  }
}

export const transactionRepository = new TransactionRepository();
