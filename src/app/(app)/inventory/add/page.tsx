'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { inventoryService } from '@/services/inventory.service';
import { useStore } from '@/store/use-store';
import { Touchable } from '@/components/touchable';
import { db } from '@/db/dexie';
import { 
  Package, 
  Hash, 
  Tag, 
  Coins, 
  Layers, 
  User, 
  ChevronLeft, 
  Check, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useUIStore } from '@/store/use-ui-store';
import { useEffect, useState } from 'react';

const productSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  category_id: z.string().optional(),
  unit_type: z.enum(['piece', 'kg', 'liter', 'pack', 'set']),
  buying_price: z.number().min(0, 'Must be 0 or more'),
  selling_price: z.number().min(0, 'Must be 0 or more'),
  stock: z.number().min(0, 'Must be 0 or more'),
  min_stock: z.number().min(0, 'Must be 0 or more'),
  sku: z.string().optional(),
  supplier_id: z.string().optional(),
  notes: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function AddProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { business } = useStore();
  const { incrementSheets, decrementSheets } = useUIStore();
  
  const productId = searchParams.get('id');
  const isEditing = !!productId;

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      unit_type: 'piece',
      buying_price: 0,
      selling_price: 0,
      stock: 0,
      min_stock: 5,
    }
  });

  // Load product if editing
  useEffect(() => {
    if (productId) {
      db.products.where('local_id').equals(productId).first().then(product => {
        if (product) {
          reset({
            name: product.name,
            category_id: product.category_id,
            unit_type: product.unit_type,
            buying_price: product.wac_price ?? product.buying_price,
            selling_price: product.selling_price,
            stock: product.stock,
            min_stock: product.min_stock,
            sku: product.sku,
            supplier_id: (product as any).supplier_id,
            notes: (product as any).notes,
          });
        }
      });
    }
  }, [productId, reset]);

  // Hide bottom nav and lock scroll on mount
  useEffect(() => {
    incrementSheets();
    return () => decrementSheets();
  }, [incrementSheets, decrementSheets]);

  const onSubmit = async (data: ProductFormValues) => {
    if (!business) return;
    try {
      if (isEditing && productId) {
        await inventoryService.updateProduct(productId, data);
      } else {
        const profit_margin = data.selling_price - data.buying_price;
        await inventoryService.addProduct({
          ...data,
          profit_margin,
        }, business.id);
      }
      
      router.push('/inventory');
    } catch (err: any) {
      console.error('Failed to save product:', err);
      alert('Error saving product: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 flex items-center gap-4 bg-background/80 backdrop-blur-md z-10 border-b border-border/50 flex-shrink-0">
        <Touchable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground"
        >
          <ChevronLeft size={20} />
        </Touchable>
        <div>
          <h1 className="text-xl font-bold tracking-tight">{isEditing ? 'Edit Product' : 'Add Product'}</h1>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            {isEditing ? 'Update Information' : 'New Inventory Item'}
          </p>
        </div>
      </header>

      {/* Scrollable Form Area */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        <form 
          onSubmit={handleSubmit(onSubmit)} 
          className="px-6 pt-6 pb-40 space-y-8"
        >
        {/* Section: Basic Info */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Package size={14} className="text-primary" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60">General Information</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Product Name</label>
              <div className="relative group">
                <Package size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input 
                  {...register('name')} 
                  placeholder="e.g. Premium Basmati Rice" 
                  className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-12 text-sm font-bold outline-none transition-all" 
                />
              </div>
              {errors.name && <p className="text-[10px] text-red-500 ml-3 font-bold">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Category</label>
                <div className="relative group">
                  <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    {...register('category_id')} 
                    placeholder="Food" 
                    className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-12 text-sm font-bold outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Unit</label>
                <select 
                  {...register('unit_type')} 
                  className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 text-sm font-bold outline-none transition-all appearance-none"
                >
                  <option value="piece">Pieces (pcs)</option>
                  <option value="kg">Kilograms (kg)</option>
                  <option value="liter">Liters (L)</option>
                  <option value="pack">Packs</option>
                  <option value="set">Sets</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Pricing & Stock */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Coins size={14} className="text-primary" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60">Financials & Logistics</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cost Price</label>
                  <span className="text-[8px] font-bold text-primary uppercase tracking-tighter bg-primary/10 px-1 rounded">WAC Basis</span>
                </div>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground group-focus-within:text-primary">₦</span>
                  <input 
                    type="number" 
                    {...register('buying_price', { valueAsNumber: true })} 
                    placeholder="0" 
                    className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-10 text-sm font-black outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Selling Price</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground group-focus-within:text-primary">₦</span>
                  <input 
                    type="number" 
                    {...register('selling_price', { valueAsNumber: true })} 
                    placeholder="0" 
                    className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-10 text-sm font-black outline-none transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Current Stock</label>
                <div className="relative group">
                  <Layers size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    type="number" 
                    {...register('stock', { valueAsNumber: true })} 
                    placeholder="0" 
                    className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-12 text-sm font-bold outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Min Alert</label>
                <div className="relative group">
                  <AlertCircle size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    type="number" 
                    {...register('min_stock', { valueAsNumber: true })} 
                    placeholder="5" 
                    className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-12 text-sm font-bold outline-none transition-all" 
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Identifiers */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <Hash size={14} className="text-primary" />
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60">Advanced Details</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">SKU / Code</label>
                <div className="relative group">
                  <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    {...register('sku')} 
                    placeholder="Optional" 
                    className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-12 text-sm font-bold outline-none transition-all" 
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Supplier</label>
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input 
                    {...register('supplier_id')} 
                    placeholder="Optional" 
                    className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-12 text-sm font-bold outline-none transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-3">Product Notes</label>
              <div className="relative group">
                <FileText size={18} className="absolute left-4 top-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <textarea 
                  {...register('notes')} 
                  placeholder="Additional information..." 
                  className="w-full bg-secondary border-2 border-transparent focus:border-primary/20 rounded-[24px] p-4 pl-12 text-sm font-bold outline-none transition-all min-h-[120px]" 
                />
              </div>
            </div>
          </div>
        </section>

        {/* Sticky Action Button */}
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent pointer-events-none">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="pointer-events-auto"
          >
            <Touchable 
              disabled={isSubmitting} 
              className="w-full bg-primary text-white font-black py-5 rounded-[28px] shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={24} strokeWidth={3} />
                  <span className="text-lg">{isEditing ? 'Save Changes' : 'Save Product'}</span>
                </>
              )}
            </Touchable>
          </motion.div>
        </div>
      </form>
    </div>
    </div>
  );
}
