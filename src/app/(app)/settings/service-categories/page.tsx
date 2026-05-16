'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Zap, 
  MoreVertical, 
  Edit2, 
  Archive, 
  Trash2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, createBaseEntity } from '@/db/dexie';
import { useAuthStore } from '@/stores/authStore';
import { Touchable } from '@/components/touchable';
import { BottomSheet } from '@/components/bottom-sheet';
import { cn } from '@/lib/utils';
import { ServiceCategory } from '@/db/schema';
import { syncQueueService } from '@/services/syncQueueService';

export default function ServiceCategoriesPage() {
  const router = useRouter();
  const business = useAuthStore((state) => state.business);
  const businessId = business?.id || business?.business_id;

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ServiceCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_price: '',
    status: 'active' as 'active' | 'inactive'
  });

  const categories = useLiveQuery(
    () => businessId 
      ? db.service_categories
          .where('business_id')
          .equals(businessId)
          .reverse()
          .toArray()
      : Promise.resolve([] as ServiceCategory[]),
    [businessId]
  ) || [];

  const filteredCategories = categories.filter(cat => 
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async () => {
    if (!businessId || !formData.name) return;

    try {
      if (editingCategory) {
        const updateData = {
          ...editingCategory,
          name: formData.name,
          description: formData.description,
          default_price: formData.default_price ? parseFloat(formData.default_price) : undefined,
          status: formData.status,
          updated_at: new Date(),
          sync_status: 'pending' as const
        };
        await db.service_categories.update(editingCategory.id!, updateData);
        await syncQueueService.enqueue('service_categories', 'update', updateData, businessId);
      } else {
        const newCategory: ServiceCategory = {
          ...createBaseEntity(businessId),
          name: formData.name,
          description: formData.description,
          default_price: formData.default_price ? parseFloat(formData.default_price) : undefined,
          status: 'active',
        };
        await db.service_categories.add(newCategory);
        await syncQueueService.enqueue('service_categories', 'create', newCategory, businessId);
      }
      
      resetForm();
    } catch (error) {
      console.error('Failed to save category:', error);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', default_price: '', status: 'active' });
    setEditingCategory(null);
    setIsAddSheetOpen(false);
  };

  const openEdit = (category: ServiceCategory) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      default_price: category.default_price?.toString() || '',
      status: category.status
    });
    setIsAddSheetOpen(true);
  };

  const toggleStatus = async (category: ServiceCategory) => {
    const nextStatus = (category.status === 'active' ? 'inactive' : 'active') as 'active' | 'inactive';
    const updateData = {
      ...category,
      status: nextStatus,
      updated_at: new Date(),
      sync_status: 'pending' as const
    };
    await db.service_categories.update(category.id!, updateData);
    await syncQueueService.enqueue('service_categories', 'update', updateData, businessId!);
  };

  return (
    <div className="min-h-screen bg-background pb-32 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/40 px-6 py-6 md:px-10">
        <div className="flex items-center gap-6">
          <Touchable 
            onPress={() => router.back()}
            className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center transition-transform active:scale-95"
          >
            <ArrowLeft size={22} />
          </Touchable>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black tracking-tight md:text-3xl">Service Categories</h1>
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Manage Professional Services
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-8 relative max-w-2xl">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input 
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/50 border border-border/40 rounded-2xl py-4 pl-14 pr-6 text-sm md:text-base font-bold placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
      </header>

      {/* Categories List */}
      <div className="px-6 py-4 md:px-10 w-full">
        {filteredCategories.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-10 glass-card rounded-[40px] border-dashed max-w-4xl mx-auto">
            <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground/40">
              <Zap size={40} />
            </div>
            <h3 className="font-black text-lg">No Categories Found</h3>
            <p className="text-sm text-muted-foreground font-medium mt-2">
              Create service categories to speed up your billing.
            </p>
            <Touchable 
              onPress={() => setIsAddSheetOpen(true)}
              className="mt-6 px-8 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20"
            >
              Create First Category
            </Touchable>
          </div>
        ) : (
          <div className="divide-y divide-border/30 w-full">
            {filteredCategories.map((cat) => (
              <Touchable 
                key={cat.local_id} 
                onPress={() => openEdit(cat)}
                className={cn(
                  "w-full py-4 flex items-center justify-between group transition-colors active:bg-secondary/40 text-left",
                  cat.status === 'inactive' && "opacity-60"
                )}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0 pr-4">
                  {/* Service Icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-transform group-active:scale-95",
                    cat.status === 'active' ? "bg-indigo-500/10 text-indigo-600" : "bg-slate-500/10 text-slate-400"
                  )}>
                    <Zap size={20} strokeWidth={2.5} />
                  </div>

                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        "font-black text-[15px] tracking-tight truncate",
                        cat.status === 'inactive' && "text-muted-foreground"
                      )}>
                        {cat.name}
                      </h4>
                      {cat.status === 'inactive' && (
                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 flex-shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/60 font-bold uppercase tracking-wider truncate">
                      {cat.description || 'No description'}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 flex items-center gap-4">
                  <div className="text-right space-y-0.5">
                    <p className="font-black text-[16px] tabular-nums tracking-tighter">
                      {cat.default_price ? `₦${cat.default_price.toLocaleString()}` : '—'}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                      Default Rate
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

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 z-30">
        <Touchable 
          onPress={() => setIsAddSheetOpen(true)}
          className="w-16 h-16 bg-primary text-white rounded-2xl shadow-2xl shadow-primary/40 flex items-center justify-center transition-transform active:scale-95"
        >
          <Plus size={32} strokeWidth={2.5} />
        </Touchable>
      </div>

      {/* Add/Edit Sheet */}
      <BottomSheet 
        isOpen={isAddSheetOpen} 
        onClose={resetForm}
        title={editingCategory ? "Edit Category" : "New Service Category"}
      >
        <div className="space-y-6 py-6 pb-4">
          <div className="space-y-4">
            {/* Category Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Category Name</label>
              <input 
                type="text"
                placeholder="e.g. Haircut, Consulting"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-secondary p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Description (Optional)</label>
              <textarea 
                placeholder="Briefly describe this service..."
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-secondary p-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
              />
            </div>

            {/* Default Price */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Default Price (Optional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">₦</span>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={formData.default_price}
                  onChange={e => setFormData({ ...formData, default_price: e.target.value })}
                  className="w-full bg-secondary py-4 pl-10 pr-4 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Status (if editing) */}
            {editingCategory && (
              <div className="flex items-center justify-between p-4 glass-card rounded-2xl">
                <div>
                  <p className="font-bold text-sm">Category Status</p>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase">
                    {formData.status === 'active' ? 'Currently accepting services' : 'Hidden from selection'}
                  </p>
                </div>
                <button 
                  onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'inactive' : 'active' })}
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    formData.status === 'active' ? "bg-primary" : "bg-muted"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                    formData.status === 'active' ? "left-7" : "left-1"
                  )} />
                </button>
              </div>
            )}
          </div>

          <Touchable 
            onPress={handleSave} 
            disabled={!formData.name}
            className={cn(
              "w-full p-5 rounded-2xl font-black text-center shadow-lg transition-all",
              formData.name 
                ? "bg-primary text-white shadow-primary/20 active:scale-[0.98]" 
                : "bg-muted text-muted-foreground shadow-none"
            )}
          >
            {editingCategory ? "Update Category" : "Create Category"}
          </Touchable>
        </div>
      </BottomSheet>
    </div>
  );
}
