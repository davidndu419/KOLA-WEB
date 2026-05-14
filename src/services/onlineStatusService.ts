'use client';

type StatusCallback = (isOnline: boolean) => void;

class OnlineStatusService {
  private callbacks: Set<StatusCallback> = new Set();
  private isOnline: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => this.handleStatusChange(true));
      window.addEventListener('offline', () => this.handleStatusChange(false));
    }
  }

  private handleStatusChange(online: boolean) {
    this.isOnline = online;
    this.callbacks.forEach(cb => cb(online));
  }

  subscribe(callback: StatusCallback) {
    this.callbacks.add(callback);
    callback(this.isOnline);
    return () => this.callbacks.delete(callback);
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export const onlineStatusService = new OnlineStatusService();
