import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const PwaContext = createContext(null);

const LOW_BANDWIDTH_STORAGE_KEY = 'solarmind_low_bandwidth_mode';
const OFFLINE_QUEUE_STORAGE_KEY = 'solarmind_offline_actions_queue';
const LAST_SYNC_STORAGE_KEY = 'solarmind_last_successful_sync';

export const PwaProvider = ({ children }) => {
  // 1. Installability State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true
      );
    }
    return false;
  });

  // 2. Service Worker & Update State
  const [hasUpdate, setHasUpdate] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  // 3. Online / Offline State
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  // 4. Last Successful Sync
  const [lastSuccessfulSync, setLastSuccessfulSync] = useState(() => {
    try {
      return localStorage.getItem(LAST_SYNC_STORAGE_KEY) || new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  });

  // 5. Offline Queued Actions (e.g., technician notes, checklist updates)
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      const saved = localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // 6. Low-Bandwidth Mode
  const [isLowBandwidthMode, setIsLowBandwidthMode] = useState(() => {
    try {
      const saved = localStorage.getItem(LOW_BANDWIDTH_STORAGE_KEY);
      if (saved !== null) return saved === 'true';
      // Auto-detect browser saveData or 2g/slow-2g connection
      if (typeof navigator !== 'undefined' && navigator.connection) {
        if (navigator.connection.saveData || navigator.connection.effectiveType === '2g' || navigator.connection.effectiveType === 'slow-2g') {
          return true;
        }
      }
    } catch {
      // Ignore errors
    }
    return false;
  });

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto trigger queue flush when back online
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register Service Worker in production / supported environments
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // Check for waiting updates
          if (reg.waiting) {
            setWaitingWorker(reg.waiting);
            setHasUpdate(true);
          }

          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setWaitingWorker(newWorker);
                  setHasUpdate(true);
                }
              });
            }
          });
        })
        .catch((err) => {
          // Worker registration might fail in dev / test environments, handled gracefully
          console.debug('ServiceWorker registration skipped or failed:', err?.message);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  // Trigger PWA Install
  const installApp = useCallback(async () => {
    if (!deferredPrompt) return false;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.error('Error during PWA install:', err);
    }
    return false;
  }, [deferredPrompt]);

  // Apply Service Worker Update
  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }, [waitingWorker]);

  // Toggle Low-Bandwidth Mode
  const toggleLowBandwidthMode = useCallback(() => {
    setIsLowBandwidthMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LOW_BANDWIDTH_STORAGE_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  // Record successful sync
  const recordSyncSuccess = useCallback(() => {
    const now = new Date().toISOString();
    setLastSuccessfulSync(now);
    try {
      localStorage.setItem(LAST_SYNC_STORAGE_KEY, now);
    } catch {
      // Ignore
    }
  }, []);

  // Queue an action when offline
  const queueOfflineAction = useCallback((action) => {
    const queueItem = {
      ...action,
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      queuedAt: new Date().toISOString(),
      synced: false,
    };
    setOfflineQueue((prev) => {
      const updated = [...prev, queueItem];
      try {
        localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
    return queueItem;
  }, []);

  // Clear or sync offline queue
  const clearOfflineQueue = useCallback(() => {
    setOfflineQueue([]);
    try {
      localStorage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Dynamic Polling Interval: 30s in normal mode vs 300s in low-bandwidth vs paused (0) when offline
  const pollingIntervalMs = !isOnline ? 0 : isLowBandwidthMode ? 300000 : 30000;

  return (
    <PwaContext.Provider
      value={{
        isInstallable,
        isInstalled,
        installApp,
        hasUpdate,
        applyUpdate,
        isOnline,
        lastSuccessfulSync,
        recordSyncSuccess,
        isLowBandwidthMode,
        toggleLowBandwidthMode,
        pollingIntervalMs,
        offlineQueue,
        queueOfflineAction,
        clearOfflineQueue,
      }}
    >
      {children}
    </PwaContext.Provider>
  );
};

export const usePwa = () => {
  const context = useContext(PwaContext);
  if (!context) {
    return {
      isInstallable: false,
      isInstalled: false,
      installApp: async () => false,
      hasUpdate: false,
      applyUpdate: () => {},
      isOnline: true,
      lastSuccessfulSync: new Date().toISOString(),
      recordSyncSuccess: () => {},
      isLowBandwidthMode: false,
      toggleLowBandwidthMode: () => {},
      pollingIntervalMs: 30000,
      offlineQueue: [],
      queueOfflineAction: () => ({}),
      clearOfflineQueue: () => {},
    };
  }
  return context;
};

export default PwaProvider;
