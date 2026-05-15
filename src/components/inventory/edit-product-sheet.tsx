'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { inventoryService } from '@/services/inventory.service';
import { BottomSheet } from '@/components/bottom-sheet';
import { Touchable } from '@/components/touchable';
import { Package, Hash, Tag, Coins, Layers, User, Check } from 'lucide-react';
import { Product } from '@/db/schema';
import { useState, useEffect } from 'react';

const productSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  category_id: z.string().optional(),
  unit_type: z.enum(['piece', 'kg', 'liter', 'pack', 'set']),
  buying_price: z.number().min(0),
  selling_price: z.number().min(0),
  min_stock: z.number().min(0),
  sku: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export function EditProductSheet({ 
  product,
  isOpen, 
  onClose 
}: { 
  product: Product | null;
  isOpen: boolean; 
  onClose: () => void; 
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
  });

  useEffect(() => {
    if (product && isOpen) {
      reset({
        name: product.name,
        category_id: product.category_id,
        unit_type: product.unit_type,
        buying_price: product.buying_price,
        selling_price: product.selling_price,
        min_stock: product.min_stock,
        sku: product.sku,
      });
    }
  }, [product, isOpen, reset]);

  if (!product) return null;

  const onSubmit = async (data: ProductFormValues) => {
    setIsSubmitting(true);
    try {
      await inventoryService.updateProduct(product.local_id, data);
      onClose();
    } catch (err: any) {
      alert('Error updating product: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <BottomSheet 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Edit Product Info"
      dismissible={!isSubmitting}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4 pb-2">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Basic Info</label>
            <div className="relative">
              <Package size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                {...register('name')} 
                placeholder="Product Name" 
                className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" 
              />
            </div>
            {errors.name && <p className="text-[10px] text-red-500 ml-2 font-bold">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <Tag size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                {...register('category_id')} 
                placeholder="Category" 
                className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" 
              />
            </div>
            <select 
              {...register('unit_type')} 
              className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none appearance-none"
            >
              <option value="piece">Pieces</option>
              <option value="kg">Kilograms</option>
              <option value="liter">Liters</option>
              <option value="pack">Packs</option>
              <option value="set">Sets</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Pricing</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">₦</span>
                <input 
                  type="number" 
                  {...register('buying_price', { valueAsNumber: true })} 
                  placeholder="Cost" 
                  className="w-full bg-secondary rounded-2xl p-4 pl-10 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" 
                />
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">₦</span>
                <input 
                  type="number" 
                  {...register('selling_price', { valueAsNumber: true })} 
                  placeholder="Price" 
                  className="w-full bg-secondary rounded-2xl p-4 pl-10 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" 
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">Low Stock Alert</label>
               <input 
                 type="number" 
                 {...register('min_stock', { valueAsNumber: true })} 
                 placeholder="Min Alert" 
                 className="w-full bg-secondary rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" 
               />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">SKU / Code</label>
               <div className="relative">
                 <Hash size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                 <input 
                   {...register('sku')} 
                   placeholder="SKU" 
                   className="w-full bg-secondary rounded-2xl p-4 pl-12 text-sm font-bold focus:ring-2 focus:ring-primary outline-none" 
                 />
               </div>
            </div>
          </div>
        </div>

        <Touchable 
          disabled={isSubmitting} 
          className="w-full bg-primary text-white font-bold py-5 rounded-[24px] shadow-xl shadow-primary/20 flex items-center justify-center gap-3 disabled:opacity-50"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check size={20} strokeWidth={3} />
              <span>Save Changes</span>
            </>
          )}
        </Touchable>
      </form>
    </BottomSheet>
  );
}
