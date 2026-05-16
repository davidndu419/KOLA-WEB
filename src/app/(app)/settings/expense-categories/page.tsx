'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Archive,
  ArrowLeft,
  CheckCircle2,
  Edit2,
  Plus,
  Receipt,
  Search,
} from 'lucide-react';
import { db, createBaseEntity } from '@/db/dexie';
import { useAuthStore } from '@/stores/authStore';
import { Touchable } from '@/components/touchable';
import { BottomSheet } from '@/components/bottom-sheet';
import { cn } from '@/lib/utils';
import { ExpenseCategory } from '@/db/schema';
import { syncQueueService } from '@/services/syncQueueService';
import { useStableLiveQuery } from '@/hooks/use-stable-live-query';

export default function ExpenseCategoriesPage() {
  const router = useRouter();
  const business = useAuthStore((state) => state.business);
  const businessId = business?.id || business?.business_id;

  const [searchQuery, setSearchQuery] = useState('');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_amount: '',
    status: 'active' as 'active' | 'inactive',
  });

  const categories = useStableLiveQuery<ExpenseCategory[]>(
    () => businessId
      ? db.expense_categories
          .where('business_id')
          .equals(businessId)
          .reverse()
          .toArray()
      : undefined,
    [businessId],
    []
  ) || [];

  const filteredCategories = categories.filter((category) => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return true;
    return [category.name, category.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });

  const resetForm = () => {
    setFormData({ name: '', description: '', default_amount: '', status: 'active' });
    setEditingCategory(null);
    setIsSheetOpen(false);
  };

  const openEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      default_amount: category.default_amount?.toString() || '',
      status: category.status,
    });
    setIsSheetOpen(true);
  };

  const handleSave = async () => {
    if (!businessId || !formData.name.trim()) return;

    try {
      if (editingCategory) {
        const updateData: ExpenseCategory = {
          ...editingCategory,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          default_amount: formData.default_amount ? Number(formData.default_amount) : undefined,
          status: formData.status,
          updated_at: new Date(),
          sync_status: 'pending',
        };

        await db.expense_categories.update(editingCategory.id!, updateData);
        await syncQueueService.enqueue('expense_categories', 'update', updateData, businessId);
      } else {
        const newCategory: ExpenseCategory = {
          ...createBaseEntity(businessId),
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          default_amount: formData.default_amount ? Number(formData.default_amount) : undefined,
          status: 'active',
        };

        await db.expense_categories.add(newCategory);
        await syncQueueService.enqueue('expense_categories', 'create', newCategory, businessId);
      }

      resetForm();
    } catch (error) {
      console.error('Failed to save expense category:', error);
      alert('Failed to save expense category');
    }
  };

  const toggleStatus = async () => {
    if (!editingCategory || !businessId) return;

    const updateData: ExpenseCategory = {
      ...editingCategory,
      status: editingCategory.status === 'active' ? 'inactive' : 'active',
      updated_at: new Date(),
      sync_status: 'pending',
    };

    try {
      await db.expense_categories.update(editingCategory.id!, updateData);
      await syncQueueService.enqueue('expense_categories', 'update', updateData, businessId);
      resetForm();
    } catch (error) {
      console.error('Failed to update expense category status:', error);
      alert('Failed to update category status');
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-7xl mx-auto w-full">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/40 px-6 py-6 md:px-10">
        <div className="flex items-center gap-6">
          <Touchable
            onPress={() => router.back()}
            className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center transition-transform active:scale-95"
          >
            <ArrowLeft size={22} />
          </Touchable>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Expense Categories</h1>
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Manage Spending Buckets
            </p>
          </div>
        </div>

        <div className="mt-8 relative max-w-2xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full bg-secondary/50 border border-border/40 rounded-2xl py-4 pl-14 pr-6 text-sm md:text-base font-bold placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
      </header>

      <div className="px-6 py-4 md:px-10 w-full">
        {filteredCategories.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-10 glass-card rounded-[40px] border-dashed max-w-4xl mx-auto">
            <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground/40">
              <Receipt size={40} />
            </div>
            <h3 className="font-black text-lg">No Categories Found</h3>
            <p className="text-sm text-muted-foreground font-medium mt-2">
              Create expense categories to speed up spending records.
            </p>
            <Touchable
              onPress={() => setIsSheetOpen(true)}
              className="mt-6 px-8 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20"
            >
              Create First Category
            </Touchable>
          </div>
        ) : (
          <div className="divide-y divide-border/30 w-full">
            {filteredCategories.map((category) => (
              <Touchable
                key={category.local_id}
                onPress={() => openEdit(category)}
                className={cn(
                  'w-full py-4 flex items-center justify-between group transition-colors active:bg-secondary/40 text-left',
                  category.status === 'inactive' && 'opacity-60'
                )}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-active:scale-95',
                      category.status === 'active' ? 'bg-red-500/10 text-red-600' : 'bg-slate-500/10 text-slate-400'
                    )}
                  >
                    <Receipt size={20} strokeWidth={2.5} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4
                        className={cn(
                          'font-black text-[15px] tracking-tight truncate',
                          category.status === 'inactive' && 'text-muted-foreground'
                        )}
                      >
                        {category.name}
                      </h4>
                      {category.status === 'inactive' && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 flex-shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 font-bold uppercase tracking-wider truncate">
                      {category.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-4">
                  <div className="text-right space-y-0.5">
                    <p className="font-black text-[16px] tabular-nums tracking-tighter">
                      {category.default_amount ? `NGN ${category.default_amount.toLocaleString()}` : '-'}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                      Default Amount
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-muted-foreground/40 group-hover:bg-primary group-hover:text-white transition-colors flex-shrink-0">
                    <Edit2 size={14} />
                  </div>
                </div>
              </Touchable>
            ))}
          </div>
        )}
      </div>

      <div className="fixed bottom-24 right-6 z-30">
        <Touchable
          onPress={() => setIsSheetOpen(true)}
          className="w-16 h-16 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center transition-transform active:scale-95"
        >
          <Plus size={32} strokeWidth={2.5} />
        </Touchable>
      </div>

      <BottomSheet
        isOpen={isSheetOpen}
        onClose={resetForm}
        title={editingCategory ? 'Edit Category' : 'New Expense Category'}
      >
        <div className="space-y-6 py-6 pb-4">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Category Name</label>
              <input
                type="text"
                placeholder="e.g. Transport, Utilities"
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                className="w-full bg-secondary p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Description (Optional)</label>
              <textarea
                placeholder="Briefly describe this expense category..."
                value={formData.description}
                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                className="w-full bg-secondary p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Default Amount (Optional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">NGN</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={formData.default_amount}
                  onChange={(event) => setFormData({ ...formData, default_amount: event.target.value })}
                  className="w-full bg-secondary py-4 pl-14 pr-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {editingCategory && (
              <div className="flex items-center justify-between p-4 glass-card rounded-2xl">
                <div>
                  <p className="font-bold text-sm">Category Status</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    {editingCategory.status === 'active' ? 'Visible in expense recording' : 'Hidden from expense recording'}
                  </p>
                </div>
                <Touchable
                  onPress={toggleStatus}
                  className={cn(
                    'px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2',
                    editingCategory.status === 'active' ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'
                  )}
                >
                  {editingCategory.status === 'active' ? <Archive size={14} /> : <CheckCircle2 size={14} />}
                  {editingCategory.status === 'active' ? 'Inactivate' : 'Activate'}
                </Touchable>
              </div>
            )}
          </div>

          <Touchable
            onPress={handleSave}
            disabled={!formData.name.trim()}
            className={cn(
              'w-full p-5 rounded-2xl font-black text-center shadow-lg transition-all',
              formData.name.trim()
                ? 'bg-primary text-white shadow-primary/20 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground shadow-none'
            )}
          >
            {editingCategory ? 'Update Category' : 'Create Category'}
          </Touchable>
        </div>
      </BottomSheet>
    </div>
  );
}
