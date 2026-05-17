// src/services/notificationService.ts

import type { Product } from '@/db/schema';
import { getStorageKeys } from '@/lib/runtime-mode';

type TransactionType = 'sale' | 'expense' | 'service';
type LocalNotificationOptions = NotificationOptions & {
  badge?: string;
  vibrate?: number[];
};

const DEFAULT_ICON = '/icons/icon-192x192.png';
const DEFAULT_BADGE = '/icons/badge.png';

export class NotificationService {
  private static instance: NotificationService;
  private stockAlertCache = new Set<string>();

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private debug(message: string, details?: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[Kola Notifications] ${message}`, details ?? '');
    }
  }

  private getNotificationsEnabled() {
    if (typeof window === 'undefined') return false;

    try {
      const keys = getStorageKeys();
      const raw = window.localStorage.getItem(keys.appStorage);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return parsed?.state?.notificationsEnabled === true;
    } catch (error) {
      this.debug('Failed to read notification preference', error);
      return false;
    }
  }

  public isSupported(): boolean {
    const supported = typeof window !== 'undefined' && 'Notification' in window;
    this.debug('Notifications supported', supported);
    return supported;
  }

  public isPermissionGranted(): boolean {
    const granted = this.isSupported() && Notification.permission === 'granted';
    this.debug('Permission state', this.isSupported() ? Notification.permission : 'unsupported');
    return granted;
  }

  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }

    try {
      const permission = await Notification.requestPermission();
      this.debug('Permission requested', permission);
      return permission;
    } catch (error) {
      this.debug('Permission request failed', error);
      return 'denied';
    }
  }

  public async showLocalNotification(title: string, options: NotificationOptions = {}) {
    if (!this.isSupported()) {
      this.debug('Notification skipped: unsupported');
      return false;
    }

    if (!this.getNotificationsEnabled()) {
      this.debug('Notification skipped: disabled in settings');
      return false;
    }

    if (!this.isPermissionGranted()) {
      this.debug('Notification skipped: permission not granted');
      return false;
    }

    const notificationOptions: LocalNotificationOptions = {
      icon: DEFAULT_ICON,
      badge: DEFAULT_BADGE,
      vibrate: [100, 50, 100],
      ...options,
      data: {
        url: '/dashboard',
        dateOfArrival: Date.now(),
        ...(options.data || {}),
      },
    };

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        this.debug('Service worker ready', Boolean(registration));
        await registration.showNotification(title, notificationOptions);
      } else {
        new Notification(title, notificationOptions);
      }

      this.debug('Notification fired', { title, options: notificationOptions });
      return true;
    } catch (error) {
      this.debug('Service worker notification failed, trying window Notification', error);
      try {
        new Notification(title, notificationOptions);
        this.debug('Fallback notification fired', title);
        return true;
      } catch (fallbackError) {
        this.debug('Notification failed', fallbackError);
        return false;
      }
    }
  }

  public notifyTransaction(type: TransactionType, amount: string | number, metadata?: { url?: string }) {
    const formattedAmount = typeof amount === 'number' ? `₦${amount.toLocaleString()}` : amount;
    const titles: Record<TransactionType, string> = {
      sale: 'Sale recorded',
      expense: 'Expense recorded',
      service: 'Service recorded',
    };
    const bodies: Record<TransactionType, string> = {
      sale: `${formattedAmount} sale completed`,
      expense: `${formattedAmount} expense saved`,
      service: `${formattedAmount} service completed`,
    };

    void this.showLocalNotification(titles[type], {
      body: bodies[type],
      data: { url: metadata?.url || '/dashboard' },
    });
  }

  public notifyLowStock(product: Pick<Product, 'local_id' | 'name' | 'stock'>) {
    const cacheKey = `low:${product.local_id}:${product.stock}`;
    if (this.stockAlertCache.has(cacheKey)) return;
    this.stockAlertCache.add(cacheKey);

    void this.showLocalNotification('Low stock alert', {
      body: `${product.name} has only ${product.stock} left`,
      data: { url: '/inventory' },
    });
  }

  public notifyOutOfStock(product: Pick<Product, 'local_id' | 'name'>) {
    const cacheKey = `out:${product.local_id}`;
    if (this.stockAlertCache.has(cacheKey)) return;
    this.stockAlertCache.add(cacheKey);

    void this.showLocalNotification('Out of stock', {
      body: `${product.name} is now out of stock`,
      data: { url: '/inventory' },
    });
  }

  public notifyStockAlert(productName: string, type: 'low' | 'out') {
    const local_id = productName;
    if (type === 'out') {
      this.notifyOutOfStock({ local_id, name: productName });
      return;
    }
    this.notifyLowStock({ local_id, name: productName, stock: 0 });
  }

  public notifySync(status: 'completed' | 'failed', message?: string) {
    const title = status === 'completed' ? 'Sync completed' : 'Sync failed';
    const body = message || (status === 'completed' ? 'Your data is now safe in the cloud.' : 'There was an error syncing your data.');

    void this.showLocalNotification(title, {
      body,
      data: { url: '/settings/sync' },
    });
  }
}

export const notificationService = NotificationService.getInstance();
