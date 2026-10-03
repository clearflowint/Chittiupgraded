/**
 * Push Notification Service for Real-time Operational Alerts
 * Strictly tenant-isolated: stores and distributes alerts scoped to the authenticated manager.
 */

export interface AppNotification {
  id: string;
  managerId?: string;
  tenantId?: string;
  title: string;
  body: string;
  timestamp: string;
  type: 'auction' | 'payment' | 'cycle' | 'sync' | 'dispatch';
  read: boolean;
}

class NotificationService {
  private currentManagerId: string | null = null;
  private inAppNotifications: AppNotification[] = [];
  private inMemoryStorage: Map<string, AppNotification[]> = new Map();
  private listeners: ((notifications: AppNotification[]) => void)[] = [];

  constructor() {
    this.loadFromStorage();
  }

  setTenant(managerId: string | null) {
    if (this.currentManagerId === managerId) return;
    this.currentManagerId = managerId;
    this.loadFromStorage();
    this.notifyListeners();
  }

  private getStorageKey(): string {
    return this.currentManagerId ? `clearflow_alerts_${this.currentManagerId}` : 'clearflow_alerts_anonymous';
  }

  private loadFromStorage() {
    if (!this.currentManagerId) {
      this.inAppNotifications = [];
      return;
    }
    const mem = this.inMemoryStorage.get(this.getStorageKey());
    if (mem) {
      this.inAppNotifications = [...mem];
      return;
    }
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.getStorageKey());
        if (stored) {
          this.inAppNotifications = JSON.parse(stored);
          return;
        }
      }
    } catch (e) {
      // ignore
    }
    this.inAppNotifications = [];
  }

  private saveToStorage() {
    if (!this.currentManagerId) return;
    this.inMemoryStorage.set(this.getStorageKey(), [...this.inAppNotifications]);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.inAppNotifications.slice(0, 50)));
      }
    } catch (e) {
      // ignore
    }
  }

  subscribe(callback: (notifications: AppNotification[]) => void) {
    this.listeners.push(callback);
    callback([...this.inAppNotifications]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.saveToStorage();
    this.listeners.forEach(l => l([...this.inAppNotifications]));
  }

  async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('This browser does not support desktop notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  async send(title: string, body: string, type: 'auction' | 'payment' | 'cycle' | 'sync' | 'dispatch' = 'sync', managerId?: string) {
    const targetManagerId = managerId || this.currentManagerId || '';

    // 1. Add to In-App Notification Log (scoped to current tenant)
    const newAlert: AppNotification = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      managerId: targetManagerId,
      tenantId: targetManagerId,
      title,
      body,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      read: false,
    };

    this.inAppNotifications.unshift(newAlert);
    this.notifyListeners();

    // 2. Trigger native OS / Web Push Notification if permission granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/icon.svg',
            tag: `clearflow-${Date.now()}`,
          });
        } else {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
          });
        }
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }
  }

  markAllAsRead() {
    this.inAppNotifications = this.inAppNotifications.map(n => ({ ...n, read: true }));
    this.notifyListeners();
  }

  clear() {
    this.inAppNotifications = [];
    this.notifyListeners();
  }
}

export const notificationService = new NotificationService();
