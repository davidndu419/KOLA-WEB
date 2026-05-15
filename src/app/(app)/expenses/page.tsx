'use client';

import { useState } from 'react';
import { Plus, Search, Receipt, TrendingDown } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { TransactionRow } from '@/components/transactions/transaction-row';
import { RecordExpenseSheet } from '@/components/finance/record-expense-sheet';
import { Touchable } from '@/components/touchable';
import { CompactMetricCard } from '@/components/reports/report-cards';
import { TransactionDetailSheet } from '@/components/transactions/transaction-detail-sheet';
import { Transaction } from '@/db/schema';
import { reportService } from '@/services/reportService';
import { motion } from 'framer-motion';

export default function ExpensesPage() {
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const expenses = useLiveQuery(async () => {
    let collection = db.transactions
      .where('type')
      .equals('expense')
      .reverse();
    
    const results = await collection.toArray();
    
    if (searchQuery) {
      return results.filter(tx => 
        tx.note?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.amount.toString().includes(searchQuery)
      );
    }
    
    return results;
  }, [searchQuery]);

  const stats = useLiveQuery(async () => {
    const today = await reportService.getProfitLoss('today');
    const thisMonth = await reportService.getProfitLoss('thisMonth');
    return {
      today: today.expenses,
      thisMonth: thisMonth.expenses
    };
  }, []);

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Stats */}
      <section className="px-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Expenses</h1>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Manage your spending</p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          <CompactMetricCard 
            label="Today" 
            value={stats?.today || 0} 
            icon={TrendingDown}
            tone="red"
          />
          <CompactMetricCard 
            label="This Month" 
            value={stats?.thisMonth || 0} 
            icon={Receipt}
            tone="red"
          />
        </motion.div>
      </section>

      {/* Search */}
      <section className="px-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-red-500 transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Search expenses, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/50 rounded-[22px] p-4 pl-12 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500/20 transition-all border border-transparent focus:border-red-500/30"
          />
        </div>
      </section>

      {/* List */}
      <section className="px-4">
        <div className="flex items-center justify-between px-2 mb-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">History</h3>
          <span className="text-[10px] font-black text-muted-foreground/50 bg-secondary px-2 py-1 rounded-md">
            {expenses?.length || 0} TOTAL
          </span>
        </div>

        <div className="space-y-3">
          {expenses?.map((expense, index) => (
            <motion.div
              key={expense.local_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <TransactionRow 
                transaction={expense} 
                onPress={() => setSelectedTransaction(expense)}
              />
            </motion.div>
          ))}
          {expenses && expenses.length === 0 && (
            <div className="text-center py-16 bg-secondary/20 rounded-[32px] border border-dashed border-border/50">
              <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Receipt size={24} className="text-muted-foreground/40" />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">No expenses found</p>
              <p className="text-[10px] font-medium text-muted-foreground/60 mt-1">Tap the + button to add one</p>
            </div>
          )}
        </div>
      </section>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-4 z-40">
        <Touchable 
          onPress={() => setIsExpenseSheetOpen(true)}
          className="h-14 px-6 bg-red-500 text-white rounded-[24px] flex items-center gap-3 shadow-2xl shadow-red-500/40 active:scale-95 transition-transform"
        >
          <Plus size={24} strokeWidth={3} />
          <span className="text-xs font-black uppercase tracking-widest">Record</span>
        </Touchable>
      </div>

      <RecordExpenseSheet 
        isOpen={isExpenseSheetOpen} 
        onClose={() => setIsExpenseSheetOpen(false)} 
      />

      <TransactionDetailSheet 
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
      />
    </div>
  );
}
