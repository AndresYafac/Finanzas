import React from 'react';
import { notify } from '../services/feedback';

const OFFLINE_QUEUE_KEY = 'fintrack_offline_queue';

export function useOfflineSync() {
  const [online, setOnline] = React.useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [pendingCount, setPendingCount] = React.useState(() => {
    try {
      return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]').length;
    } catch {
      return 0;
    }
  });

  const enqueue = React.useCallback((operation) => {
    const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    queue.push({ ...operation, createdAt: new Date().toISOString() });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    setPendingCount(queue.length);
    notify('Operacion guardada para sincronizar cuando vuelva la conexion.', 'warning');
  }, []);

  const clearQueue = React.useCallback(() => {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    setPendingCount(0);
  }, []);

  React.useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      const queue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      if (queue.length) notify(`Hay ${queue.length} operaciones pendientes por sincronizar.`, 'warning');
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { online, pendingCount, enqueue, clearQueue };
}

