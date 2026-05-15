'use client';

import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/dexie';
import { 
  Home, 
  Package, 
  ShoppingCart, 
  Briefcase,
  BarChart3,
  Settings,
  Receipt
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { springs } from '@/lib/animation-config';

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/inventory', icon: Package, label: 'Stock' },
  { href: '/sales', icon: ShoppingCart, label: 'Sales' },
  { href: '/service', icon: Briefcase, label: 'Service' },
  { href: '/expenses', icon: Receipt, label: 'Expense' },
  { href: '/reports', icon: BarChart3, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const syncCount = useLiveQuery(() => db.sync_queue.count());

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] pb-safe">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-2xl border-t border-border/50" />
      
      <div className="relative flex items-center justify-around px-2 h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center w-full h-14"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  transition={springs.snappy}
                  className="absolute -top-1 w-8 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                />
              )}
              
              <motion.div
                animate={{ 
                  scale: isActive ? 1.1 : 0.9,
                  y: isActive ? -2 : 0,
                }}
                transition={springs.snappy}
                className={cn(
                  'p-1.5 rounded-xl transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {item.label === 'Settings' && syncCount !== undefined && syncCount > 0 && (
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-background animate-pulse" />
                )}
              </motion.div>
              
              <span className={cn(
                'text-[10px] font-bold transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
