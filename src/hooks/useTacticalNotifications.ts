import { useState, useEffect, useCallback } from 'react';
import { TacticalAlert } from '../types';

export function useTacticalNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState<boolean>(false);
  const [alerts, setAlerts] = useState<TacticalAlert[]>(() => {
    try {
      const stored = localStorage.getItem('maya_tactical_alerts');
      if (stored) return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
    return [
      {
        id: 'alt-1',
        title: 'AttendLink Lab Telemetry Verification',
        description: 'Verify RFID/QR scanner rate limits with Hari Vishnu (COO) for Bishop Heber pilot.',
        severity: 'medium',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        category: 'deadline',
        read: false,
      },
      {
        id: 'alt-2',
        title: 'Beginner CTF Lab Isolation Audit',
        description: 'Ensure CTF docker network sandboxing has zero outbound gateway access.',
        severity: 'high',
        timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
        category: 'security',
        read: false,
      },
      {
        id: 'alt-3',
        title: 'PONNI MUN 3.0 Registration Gate',
        description: 'Delegate validation schema and payment reconciliation pipeline review.',
        severity: 'low',
        timestamp: new Date(Date.now() - 3600000 * 18).toISOString(),
        category: 'brief',
        read: true,
      },
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('maya_tactical_alerts', JSON.stringify(alerts));
    } catch (e) {
      // ignore
    }
  }, [alerts]);

  const requestPermission = useCallback(async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const res = await Notification.requestPermission();
        setPermission(res);
        return res;
      } catch (err) {
        console.warn('Notification permission error:', err);
      }
    }
    return 'denied';
  }, []);

  const triggerAlert = useCallback(
    (alert: Omit<TacticalAlert, 'id' | 'timestamp' | 'read'>) => {
      const newAlert: TacticalAlert = {
        ...alert,
        id: `alt-${Date.now()}`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      setAlerts((prev) => [newAlert, ...prev]);

      // Trigger Web Notification if allowed
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(`[MAYA TACTICAL] ${newAlert.title}`, {
            body: newAlert.description,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: newAlert.id,
          });
        } catch (e) {
          console.warn('Native notification dispatch failed:', e);
        }
      }

      return newAlert;
    },
    []
  );

  const markAllRead = useCallback(() => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const unreadCount = alerts.filter((a) => !a.read).length;

  return {
    permission,
    supported,
    alerts,
    unreadCount,
    requestPermission,
    triggerAlert,
    markAllRead,
    clearAlerts,
  };
}
