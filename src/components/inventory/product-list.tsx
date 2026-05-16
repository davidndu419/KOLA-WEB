// src/components/inventory/product-list.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { Touchable } from '@/components/touchable';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Product } from '@/db/schema';
import { useSearchParams } from 'next/navigation';

export function ProductList({ searchQuery }: { searchQuery: string }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');

  const products = useLiveQuery(async () => {
    const results = await db.products
      .orderBy('updated_at')
      .reverse()
      .filter((product) => !product.is_archived && !product.deleted_at)
      .toArray();
    
    if (!searchQuery) return results;
    
    const lowerSearch = searchQuery.toLowerCase();
    return results.filter(p => 
      p.name.toLowerCase().includes(lowerSearch) || 
      p.sku?.toLowerCase().includes(lowerSearch)
    );
  }, [searchQuery]);


  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Handle return flow: reopen product detail if productId is in URL
  useEffect(() => {
    if (productId && !selectedProduct) {
      db.products.where('local_id').equals(productId).first().then(p => {
        if (p) setSelectedProduct(p);
      });
    }
  }, [productId]);

  // TanStack Virtual exposes imperative helpers that React Compiler cannot memoize safely.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: products?.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 84, // Approximate height of each product row
    overscan: 5,
  });

  if (!products) return <div className="p-8 text-center animate-pulse text-muted-foreground font-bold">Loading Inventory...</div>;

  if (products.length === 0) {
    return (
      <div className="glass-card p-12 rounded-[32px] flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <Package size={32} />
        </div>
        <div>
          <h3 className="font-bold text-lg">No Products Found</h3>
          <p className="text-sm text-muted-foreground max-w-[200px] mx-auto">
            {searchQuery ? "Try a different search term" : "Start by adding your first product to track stock."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div 
        ref={parentRef}
        className="w-full"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const product = products[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="py-1.5"
              >
                <Touchable 
                  onPress={() => setSelectedProduct(product)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between p-4 glass-card rounded-2xl h-full border-border/40">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-secondary/80 rounded-2xl flex items-center justify-center text-muted-foreground">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="font-bold text-sm tracking-tight">{product.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 bg-muted text-muted-foreground rounded-md uppercase tracking-wider">
                            {product.unit_type}
                          </span>
                          {product.stock <= product.min_stock && (
                            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-0.5">
                               Low Stock
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm tabular-nums">₦{product.selling_price.toLocaleString()}</p>
                      <p className={cn(
                        "text-[11px] font-bold tabular-nums",
                        product.stock <= 0 ? "text-red-500" : 
                        product.stock <= product.min_stock ? "text-amber-500" : "text-emerald-500"
                      )}>
                        {product.stock} {product.unit_type}s
                      </p>

                    </div>
                  </div>
                </Touchable>
              </div>
            );
          })}
        </div>
      </div>

      <ProductDetailSheet 
        product={selectedProduct}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </>
  );
}

import { ProductDetailSheet } from './product-detail-sheet';
