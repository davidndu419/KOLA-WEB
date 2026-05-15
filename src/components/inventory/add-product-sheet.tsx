'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { inventoryService } from '@/services/inventory.service';
import { useStore } from '@/store/use-store';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Package, Hash, Tag, Coins, Layers, User } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  category_id: z.string().optional(),
  unit_type: z.enum(['piece', 'kg', 'liter', 'pack', 'set']),
  buying_price: z.number().min(0),
  selling_price: z.number().min(0),
  stock: z.number().min(0),
  min_stock: z.number().min(0),
  sku: z.string().optional(),
  supplier_id: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function AddProductSheet({ 
  isOpen, 
  onClose 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const { business } = useStore();
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

  const onSubmit = async (data: ProductFormValues) => {
    if (!business) return;
    try {
      const profit_margin = data.selling_price - data.buying_price;
      
      await inventoryService.addProduct({
        ...data,
        profit_margin,
      }, business.id);
      
      reset();
      onClose();
    } catch (err: any) {
      console.error('Failed to add product:', err);
      alert('Error adding product: ' + err.message);
    }
  };


  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Add New Product"
      dismissible={false}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-2">Basic Info</label>
            <div className="relative">
              <Package size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input {...register('name')} placeholder="Product Name" className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
            </div>
            {errors.name && <p className="text-[10px] text-red-500 ml-2 font-bold">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input {...register('category_id')} placeholder="Category" className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <select {...register('unit_type')} className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none appearance-none">
              <option value="piece">Pieces</option>
              <option value="kg">Kilograms</option>
              <option value="liter">Liters</option>
              <option value="pack">Packs</option>
              <option value="set">Sets</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-2">Pricing</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₦</span>
                <input type="number" {...register('buying_price', { valueAsNumber: true })} placeholder="Cost" className="w-full bg-secondary rounded-2xl p-4 pl-10 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">₦</span>
                <input type="number" {...register('selling_price', { valueAsNumber: true })} placeholder="Price" className="w-full bg-secondary rounded-2xl p-4 pl-10 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-2">Stock Levels</label>
            <div className="grid grid-cols-2 gap-4">
              <input type="number" {...register('stock', { valueAsNumber: true })} placeholder="Stock" className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
              <input type="number" {...register('min_stock', { valueAsNumber: true })} placeholder="Min Alert" className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="relative">
              <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input {...register('sku')} placeholder="SKU" className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input {...register('supplier_id')} placeholder="Supplier" className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" />
            </div>
          </div>

        </div>

        <Touchable disabled={isSubmitting} className="w-full bg-primary text-white font-bold py-5 rounded-[24px] shadow-xl shadow-primary/20 flex items-center justify-center disabled:opacity-50 mt-4">
          {isSubmitting ? 'Saving...' : 'Complete Entry'}
        </Touchable>
      </form>
    </BottomSheet>
  );
}
