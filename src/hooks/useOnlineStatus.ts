import { useState, useEffect } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../firebase';

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    let active = true;

    const checkFirebase = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (active) setIsOnline(false);
        return;
      }

      try {
        // Run a lightweight read-from-server on a dummy path to test real Firestore reachability.
        // If we are offline/unreachable, this will throw a network/unreachable error.
        // If we are online, it will either succeed (or throw a 'not-found' permission error, which still means the server was reached).
        const pingPromise = getDocFromServer(doc(db, '_ping_connectivity_', 'ping'))
          .then(() => true)
          .catch((err) => {
            const errMsg = String(err).toLowerCase();
            // If the server responded with permission-denied or not-found, it means we successfully reached the Firestore backend!
            if (
              errMsg.includes('not-found') || 
              errMsg.includes('permission-denied') || 
              errMsg.includes('failed-precondition')
            ) {
              return true;
            }
            return false;
          });

        // Cap the check at 3 seconds to avoid waiting forever on bad connections
        const timeoutPromise = new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 3000)
        );

        const reachable = await Promise.race([pingPromise, timeoutPromise]);
        if (active) {
          setIsOnline(reachable);
        }
      } catch {
        if (active) setIsOnline(false);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      checkFirebase();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Run initial check
    checkFirebase();

    // Heartbeat every 10 seconds to detect silent connection drops
    const intervalId = setInterval(checkFirebase, 10000);

    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      clearInterval(intervalId);
    };
  }, []);

  return isOnline;
}
