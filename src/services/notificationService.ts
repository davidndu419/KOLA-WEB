// src/services/notificationService.ts

export class NotificationService {
  private static instance: NotificationService;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Request permission for browser notifications
   */
  public async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    return permission;
  }

  /**
   * Check if notifications are supported and permitted
   */
  public isPermitted(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  /**
   * Send a local notification
   */
  public async notify(title: string, body: string, icon: string = '/icons/icon-192x192.png') {
    // Check if notifications are enabled in settings and browser
    const notificationsEnabled = localStorage.getItem('kola-app-storage') 
      ? JSON.parse(localStorage.getItem('kola-app-storage')!).state.notificationsEnabled 
      : true;

    if (!notificationsEnabled || !this.isPermitted()) {
      return;
    }

    try {
      // Use Service Worker if available for better PWA support
      const registration = await navigator.serviceWorker.ready;
      if (registration && 'showNotification' in registration) {
        await registration.showNotification(title, {
          body,
          icon,
          badge: '/icons/badge.png',
          vibrate: [100, 50, 100],
          data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
          }
        } as any);
      } else {
        // Fallback to basic Notification API
        new Notification(title, { body, icon });
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
      // Fallback
      new Notification(title, { body, icon });
    }
  }

  /**
   * Specific notify for successful transactions
   */
  public notifyTransaction(type: 'sale' | 'expense' | 'service', amount: string) {
    const titles = {
      sale: 'New Sale Recorded',
      expense: 'Expense Recorded',
      service: 'Service Recorded'
    };
    
    this.notify(titles[type], `Amount: ${amount}`);
  }

  /**
   * Specific notify for stock alerts
   */
  public notifyStockAlert(productName: string, type: 'low' | 'out') {
    const title = type === 'out' ? '⚠️ Product Out of Stock' : '📉 Low Stock Warning';
    const body = type === 'out' 
      ? `${productName} is completely out of stock.` 
      : `${productName} is running low on stock.`;
    
    this.notify(title, body);
  }

  /**
   * Notify sync status
   */
  public notifySync(status: 'completed' | 'failed', message?: string) {
    const title = status === 'completed' ? '✅ Sync Completed' : '❌ Sync Failed';
    const body = message || (status === 'completed' ? 'Your data is now safe in the cloud.' : 'There was an error syncing your data.');
    
    this.notify(title, body);
  }
}

export const notificationService = NotificationService.getInstance();
