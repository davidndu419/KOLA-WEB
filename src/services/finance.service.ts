import { db, createBaseEntity } from '@/db/dexie';
import { Transaction, Receivable, Expense, Service } from '@/db/schema';
import { processAccounting } from '@/accounting/engine';
import { syncQueueService } from '@/services/syncQueueService';

export const financeService = {
  async recordExpense(
    data: {
      amount: number;
      category_id: string;
      category_name?: string;
      payment_method: 'cash' | 'transfer';
      recipient?: string;
      note?: string;
      source_type?: string;
      source_id?: string;
    },
    business_id: string
  ) {
    const base = createBaseEntity(business_id);
    
    // 1. Create Transaction (Journal)
    const transaction: Transaction = {
      ...base,
      type: 'expense',
      amount: data.amount,
      payment_method: data.payment_method,
      status: 'completed',
      reference_id: '', // Will be set to expense local_id
      note: data.note,
      category_id: data.category_id,
      category_name: data.category_name,
      source_type: data.source_type,
      source_id: data.source_id,
    };

    return await db.transaction('rw', [
      db.transactions, 
      db.expenses, 
      db.ledger_entries, 
      db.sync_queue
    ], async () => {
      const transactionDbId = await db.transactions.add(transaction);
      transaction.id = transactionDbId as number;
      
      // 2. Create Expense
      const expense: Expense = {
        ...createBaseEntity(business_id),
        transaction_id: transaction.local_id,
        category_id: data.category_id,
        category_name: data.category_name,
        amount: data.amount,
        payment_method: data.payment_method,
        recipient: data.recipient,
        note: data.note,
        status: 'completed',
        // We can add source fields to expense if needed by schema, 
        // but Transaction is the primary source of truth for accounting
      };
      const expenseDbId = await db.expenses.add(expense);
      expense.id = expenseDbId as number;
      
      // Update transaction reference
      transaction.reference_id = expense.local_id;
      await db.transactions.update(transaction.id!, { reference_id: expense.local_id });

      // 3. Process Accounting
      await processAccounting(transaction);

      // 4. Enqueue Sync
      await syncQueueService.enqueue('transactions', 'create', transaction, business_id);
      await syncQueueService.enqueue('expenses', 'create', expense, business_id);
      
      return { transaction, expense };
    });
  },

  async recordService(
    data: {
      name: string;
      category_id?: string;
      category_name?: string;
      customer_name?: string;
      amount: number;
      payment_method: 'cash' | 'transfer' | 'credit';
      customer_id?: string;
      note?: string;
    },
    business_id: string
  ) {
    const base = createBaseEntity(business_id);
    
    // 1. Create Transaction (Journal)
    const transaction: Transaction = {
      ...base,
      type: 'service',
      amount: data.amount,
      payment_method: data.payment_method,
      status: 'completed',
      reference_id: '', // Will be set to service local_id
      category_id: data.category_id,
      category_name: data.category_name,
      service_name: data.name,
      display_title: data.category_name || data.name,
      customer_name: data.customer_name,
      note: data.note,
    };

    return await db.transaction('rw', [
      db.transactions, 
      db.services, 
      db.ledger_entries, 
      db.sync_queue, 
      db.receivables, 
      db.customers
    ], async () => {
      const transactionDbId = await db.transactions.add(transaction);
      transaction.id = transactionDbId as number;
      
      // 2. Create Service
      const service: Service = {
        ...createBaseEntity(business_id),
        transaction_id: transaction.local_id,
        name: data.name,
        category_id: data.category_id,
        customer_id: data.customer_id,
        amount: data.amount,
        payment_method: data.payment_method,
        status: 'completed',
        note: data.note,
      };
      const serviceDbId = await db.services.add(service);
      service.id = serviceDbId as number;
      
      // Update transaction reference
      transaction.reference_id = service.local_id;
      await db.transactions.update(transaction.id!, { reference_id: service.local_id });

      // Handle Credit
      if (data.payment_method === 'credit' && data.customer_id) {
        const receivable: Receivable = {
          ...createBaseEntity(business_id),
          transaction_id: transaction.local_id,
          customer_id: data.customer_id,
          amount: data.amount,
          paid_amount: 0,
          status: 'pending',
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // Default 14 days for services
        };
        await db.receivables.add(receivable);
        await syncQueueService.enqueue('receivables', 'create', receivable, business_id);
        
        // Update customer debt
        const customer = await db.customers.where('local_id').equals(data.customer_id).first();
        if (customer) {
          const updatedCustomer = {
            ...customer,
            total_debt: (customer.total_debt || 0) + data.amount,
            updated_at: new Date(),
            sync_status: 'pending' as const
          };
          await db.customers.update(customer.id!, updatedCustomer);
          await syncQueueService.enqueue('customers', 'update', updatedCustomer, business_id);
        }
      }

      // 3. Process Accounting
      await processAccounting(transaction);

      // 4. Enqueue Sync
      await syncQueueService.enqueue('transactions', 'create', transaction, business_id);
      await syncQueueService.enqueue('services', 'create', service, business_id);
      
      return { transaction, service };
    });
  },

  async confirmCreditPayment(receivableId: string, amount: number, payment_method: 'cash' | 'transfer') {
    const receivable = await db.receivables.where('local_id').equals(receivableId).first();
    if (!receivable) throw new Error('Receivable not found');

    const business_id = receivable.business_id;
    const base = createBaseEntity(business_id);

    return await db.transaction('rw', [
      db.receivables, 
      db.transactions, 
      db.ledger_entries, 
      db.customers, 
      db.sync_queue
    ], async () => {
      const newPaidAmount = receivable.paid_amount + amount;
    // Force the ternary result to the specific union type
const status = (newPaidAmount >= receivable.amount ? 'paid' : 'partially-paid') as 'paid' | 'partially-paid';

const updatedReceivable = {
  ...receivable,
  paid_amount: newPaidAmount,
  status, // This will now match the Receivable interface perfectly
  updated_at: new Date(),
  sync_status: 'pending' as const
};
      await db.receivables.update(receivable.id!, updatedReceivable as any);
      await syncQueueService.enqueue('receivables', 'update', updatedReceivable, business_id);

      // Update customer debt
      const customer = await db.customers.where('local_id').equals(receivable.customer_id).first();
      if (customer) {
        const updatedCustomer = {
          ...customer,
          total_debt: Math.max(0, (customer.total_debt || 0) - amount),
          updated_at: new Date(),
          sync_status: 'pending' as const
        };
        await db.customers.update(customer.id!, updatedCustomer);
        await syncQueueService.enqueue('customers', 'update', updatedCustomer, business_id);
      }

      // 3. Create a payment transaction for ledger tracking
      const paymentTx: Transaction = {
        ...base,
        type: 'credit_payment',
        amount: amount,
        payment_method: payment_method,
        status: 'completed',
        reference_id: receivable.local_id,
        note: `Credit payment for transaction ${receivable.transaction_id}`,
      };
      await db.transactions.add(paymentTx);

      // 4. Process Accounting (Credit payment logic handled in processAccounting)
      await processAccounting(paymentTx);
      
      // 5. Enqueue Sync
      await syncQueueService.enqueue('transactions', 'create', paymentTx, business_id);

      return paymentTx;
    });
  }
};
