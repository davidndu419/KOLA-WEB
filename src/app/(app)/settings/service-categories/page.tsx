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
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-4">
          <Touchable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
          >
            <ArrowLeft size={20} />
          </Touchable>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black tracking-tight">Service Categories</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              Manage Professional Services
            </p>
          </div>
          <Touchable 
            onPress={() => setIsAddSheetOpen(true)}
            className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"
          >
            <Plus size={20} />
          </Touchable>
        </div>

        {/* Search Bar */}
        <div className="mt-4 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <input 
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-secondary/50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-bold placeholder:text-muted-foreground/40 focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
      </header>

      {/* Categories List */}
      <div className="px-6 py-6 space-y-4">
        {filteredCategories.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center px-10">
            <div className="w-20 h-20 bg-secondary/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground/40">
              <Zap size={40} />
            </div>
            <h3 className="font-black text-lg">No Categories Found</h3>
            <p className="text-sm text-muted-foreground font-medium mt-2">
              Create service categories like "Haircut", "Consultation", or "Maintenance" to speed up your billing.
            </p>
            <Touchable 
              onPress={() => setIsAddSheetOpen(true)}
              className="mt-6 px-8 py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20"
            >
              Create First Category
            </Touchable>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filteredCategories.map((cat) => (
              <Touchable 
                key={cat.local_id} 
                onPress={() => openEdit(cat)}
                className="py-4 flex items-center gap-4 active:bg-secondary/40 transition-colors rounded-xl px-2 -mx-2"
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0",
                  cat.status === 'active' ? "bg-indigo-500/10 text-indigo-600" : "bg-slate-500/10 text-slate-400"
                )}>
                  <Zap size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={cn(
                      "font-black text-[15px] tracking-tight truncate",
                      cat.status === 'inactive' && "text-muted-foreground"
                    )}>
                      {cat.name}
                    </h4>
                    {cat.status === 'inactive' && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 font-bold uppercase truncate">
                    {cat.description || 'No description'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-black text-sm tabular-nums">
                    {cat.default_price ? `₦${cat.default_price.toLocaleString()}` : 'No Price'}
                  </p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">
                    Default Rate
                  </p>
                </div>
              </Touchable>
            ))}
          </div>
        )}
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
