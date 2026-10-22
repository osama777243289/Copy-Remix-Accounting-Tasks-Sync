import { useState, useEffect } from 'react';
import { Download, Bell, BellOff, Wifi, WifiOff, Smartphone, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface RegisterSWOptions {
  onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: unknown) => void;
}

function useRegisterSW(options?: RegisterSWOptions) {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        setRegistration(reg);
        options?.onRegistered?.(reg);

        if (reg.waiting) {
          setNeedRefresh(true);
        }

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  setNeedRefresh(true);
                } else {
                  setOfflineReady(true);
                }
              }
            });
          }
        });
      })
      .catch((error) => {
        options?.onRegisterError?.(error);
      });
  }, []);

  const updateServiceWorker = async (reloadPage = true) => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    if (reloadPage) {
      window.location.reload();
    }
  };

  return {
    offlineReady: [offlineReady, setOfflineReady] as [boolean, (val: boolean) => void],
    needRefresh: [needRefresh, setNeedRefresh] as [boolean, (val: boolean) => void],
    updateServiceWorker,
  };
}

export default function PWAManager() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showNotifyMenu, setShowNotifyMenu] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('أنت متصل الآن بالإنترنت', {
        icon: <Wifi className="w-4 h-4" />,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('أنت تعمل الآن في وضع عدم الاتصال', {
        icon: <WifiOff className="w-4 h-4" />,
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check notification permission
    try {
      if ('Notification' in window) {
        setNotificationsEnabled(Notification.permission === 'granted');
      }
    } catch (e) {
      console.warn('Failed to read Notification permission status:', e);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('المتصفح لا يدعم التنبيهات');
      return;
    }

    if (Notification.permission === 'granted') {
      // Toggle menu if permission is already granted
      setShowNotifyMenu(!showNotifyMenu);
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        setShowNotifyMenu(true);
        toast.success('تم تفعيل التنبيهات بنجاح');
        
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          registration.showNotification('نظام الإدارة والمالية 📱', {
            body: 'تم تفعيل التنبيهات بنجاح على جوالك الآن! يمكنك تجربة الإشعارات التجريبية.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            vibrate: [200, 100, 200]
          } as any);
        } else {
          new Notification('نظام الإدارة والمالية', {
            body: 'تم تفعيل التنبيهات بنجاح',
            icon: '/icon-192.png'
          });
        }
      } else {
        setNotificationsEnabled(false);
        toast.error('تم رفض تفعيل التنبيهات');
      }
    } catch (e) {
      console.error('Failed to request permission:', e);
      toast.error('حدث خطأ أثناء تفعيل التنبيهات');
    }
  };

  const sendTestNotification = async () => {
    if (!notificationsEnabled) {
      toast.error('يرجى تفعيل التنبيهات أولاً');
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        registration.showNotification('تنبيه مباشر للجوال 📱', {
          body: 'تهانينا! التنبيهات المباشرة تعمل بكفاءة عالية على جوالك الآن.',
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [100, 50, 100, 50, 200],
          tag: 'test-notification',
          renotify: true,
          data: {
            url: window.location.href
          }
        } as any);
        toast.success('تم إرسال الإشعار التجريبي للجوال!');
      } else {
        new Notification('تنبيه مباشر 📱', {
          body: 'تنبيهات المتصفح تعمل بنجاح!',
          icon: '/icon-192.png'
        });
        toast.success('تم إرسال إشعار المتصفح!');
      }
    } catch (e) {
      console.error('Error sending test notification:', e);
      toast.error('فشل إرسال الإشعار التجريبي');
    }
  };

  const testSetBadge = (count: number) => {
    try {
      if ('setAppBadge' in navigator) {
        navigator.setAppBadge(count).then(() => {
          toast.success(`تم تحديث شارة الأيقونة إلى ${count} على الشاشة الرئيسية!`);
        }).catch((err) => {
          console.warn("Failed to set app badge:", err);
          toast.error('فشل تعيين شارة الأيقونة');
        });
      } else {
        toast.error('جهازك أو متصفحك لا يدعم تغيير شارة الأيقونة (App Badging)');
      }
    } catch (e) {
      console.warn("Badge API error:", e);
    }
  };

  const clearBadge = () => {
    try {
      if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().then(() => {
          toast.success('تم مسح شارة الأيقونة بنجاح');
        }).catch((err) => {
          console.warn("Failed to clear app badge:", err);
        });
      }
    } catch (e) {
      console.warn("Badge API error:", e);
    }
  };

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return null;
}
