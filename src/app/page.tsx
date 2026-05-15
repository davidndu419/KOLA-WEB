'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  Zap, 
  ShoppingBag, 
  Users, 
  BarChart3, 
  Printer, 
  WifiOff,
  ArrowRight,
  Store,
  Scissors,
  Package,
  CheckCircle2
} from 'lucide-react';
import Image from 'next/image';
import { Touchable } from '@/components/touchable';
import { useAuth } from '@/hooks/useAuth';

export default function LandingPage() {
  const [logoError, setLogoError] = React.useState(false);
  const router = useRouter();
  const { isAuthenticated, isInitialized, business } = useAuth();

  React.useEffect(() => {
    if (isInitialized && isAuthenticated && business) {
      router.replace('/dashboard');
    }
  }, [business, isAuthenticated, isInitialized, router]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 glassmorphism border-b border-border/40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!logoError ? (
            <Image 
              src="/logo/kola-logo.png" 
              alt="Kola" 
              width={32} 
              height={32} 
              className="object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">K</span>
            </div>
          )}
          <span className="font-black text-xl tracking-tight">Kola</span>
        </div>
        <Link href="/auth/login">
          <Touchable onPress={() => {}} className="px-4 py-2 text-sm font-bold text-emerald-500 hover:text-emerald-600 transition-colors">
            Login
          </Touchable>
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 text-center space-y-8 max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 text-xs font-bold uppercase tracking-widest">
            <WifiOff size={12} /> Works Offline
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] text-foreground">
            Run your business, <br />
            <span className="text-emerald-500">even without internet.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-xl mx-auto leading-relaxed">
            Inventory, sales, expenses, credit, and reports for African small businesses.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col md:flex-row items-center justify-center gap-4 pt-4"
        >
          <Link href="/auth/register" className="w-full md:w-auto">
            <Touchable
              onPress={() => {}}
              className="w-full md:px-12 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center gap-2 font-black text-lg shadow-xl shadow-emerald-500/25"
            >
              Get Started Free <ArrowRight size={20} />
            </Touchable>
          </Link>
        </motion.div>
      </section>

      {/* Feature Grid */}
      <section className="py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard 
            icon={<WifiOff className="text-emerald-500" />}
            title="Always Works"
            description="Sell and track inventory even in remote areas. Data syncs automatically when you connect."
          />
          <FeatureCard 
            icon={<ShoppingBag className="text-emerald-500" />}
            title="Stock Tracking"
            description="Know exactly what you have. Get low stock alerts before you run out of fast-selling items."
          />
          <FeatureCard 
            icon={<Users className="text-emerald-500" />}
            title="Credit Management"
            description="Track customer debts and send payment reminders. Never lose money to forgotten credits."
          />
          <FeatureCard 
            icon={<BarChart3 className="text-emerald-500" />}
            title="Daily Reports"
            description="See your profit and expenses in real-time. Make smarter decisions with clear business data."
          />
          <FeatureCard 
            icon={<Printer className="text-emerald-500" />}
            title="Digital Receipts"
            description="Generate professional receipts for every sale. Send via WhatsApp or print via Bluetooth."
          />
          <FeatureCard 
            icon={<Zap className="text-emerald-500" />}
            title="Lightning Fast"
            description="Designed for entry-level smartphones. Fast, smooth, and uses very little data."
          />
        </div>
      </section>

      {/* Business Types */}
      <section className="py-20 px-6 bg-secondary/30">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight">Built for every shop.</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <BusinessType icon={<Store />} label="Provision Shops" />
            <BusinessType icon={<Package />} label="Mini Marts" />
            <BusinessType icon={<Scissors />} label="Salons" />
            <BusinessType icon={<Zap />} label="POS Agents" />
            <BusinessType icon={<BarChart3 />} label="Wholesalers" />
            <BusinessType icon={<Users />} label="Services" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 px-6 text-center max-w-4xl mx-auto">
        <div className="bg-emerald-500 rounded-[48px] p-12 md:p-20 space-y-8 relative overflow-hidden shadow-2xl shadow-emerald-500/20">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <h2 className="text-4xl md:text-6xl font-black text-white leading-tight relative z-10">
            Ready to grow your business?
          </h2>
          <p className="text-white/80 text-lg font-medium max-w-lg mx-auto relative z-10 leading-relaxed">
            Join thousands of African entrepreneurs using Kola to manage their shops professionally.
          </p>
          <div className="flex justify-center pt-4 relative z-10">
            <Link href="/auth/register">
              <Touchable
                onPress={() => {}}
                className="px-12 h-16 bg-white text-emerald-600 rounded-full flex items-center justify-center gap-2 font-black text-xl hover:bg-emerald-50 transition-colors shadow-lg"
              >
                Create Account Now
              </Touchable>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <Image 
              src="/logo/kola-logo.png" 
              alt="Kola" 
              width={24} 
              height={24} 
              className="object-contain opacity-80"
            />
            <span className="font-bold text-lg tracking-tight">Kola</span>
          </div>
          <p className="text-sm text-muted-foreground font-medium">
            © 2026 Kola PWA. Built for African Small Businesses.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="p-8 rounded-[32px] bg-card border border-border/50 space-y-4 hover:border-emerald-500/30 transition-colors"
    >
      <div className="w-12 h-12 bg-secondary rounded-2xl flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xl font-black tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm font-medium leading-relaxed">{description}</p>
    </motion.div>
  );
}

function BusinessType({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="p-6 rounded-[24px] bg-background border border-border/50 flex flex-col items-center gap-3">
      <div className="text-emerald-500">{icon}</div>
      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
    </div>
  );
}
