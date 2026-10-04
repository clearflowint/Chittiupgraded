import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

export interface FirebaseAuthorityStatus {
  isOnline: boolean;
  isFirebaseReachable: boolean;
  canMutate: boolean;
  offlineReason: string | null;
}

/**
 * FirebaseAuthorityService
 * 
 * Canonical authority for network and Firebase availability in ClearFlow.
 * Enforces online-authoritative constraints:
 * - Distinguishes between device browser network and actual Firestore reachability.
 * - Rejects any mutation when offline or when Firebase is unreachable.
 * - Zero offline mutation queuing or delayed replay.
 */
export class FirebaseAuthorityService {
  private static isOnlineState: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private static isFirebaseReachableState: boolean = true;
  private static lastProbeTime: number = 0;
  private static probeInFlight: Promise<boolean> | null = null;
  private static listeners = new Set<(status: FirebaseAuthorityStatus) => void>();
  private static initialized: boolean = false;

  static init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    window.addEventListener('online', () => {
      this.isOnlineState = true;
      this.checkFirebaseReachability(true);
    });

    window.addEventListener('offline', () => {
      this.isOnlineState = false;
      this.isFirebaseReachableState = false;
      this.notifyListeners();
    });

    // Initial check
    this.checkFirebaseReachability();

    // Heartbeat check every 15 seconds
    setInterval(() => {
      if (this.isOnlineState) {
        this.checkFirebaseReachability();
      }
    }, 15000);
  }

  static getStatus(): FirebaseAuthorityStatus {
    const can = this.isOnlineState && this.isFirebaseReachableState;
    let offlineReason: string | null = null;
    if (!this.isOnlineState) {
      offlineReason = 'Internet connection required';
    } else if (!this.isFirebaseReachableState) {
      offlineReason = 'Available when online (Connecting to database...)';
    }
    return {
      isOnline: this.isOnlineState,
      isFirebaseReachable: this.isFirebaseReachableState,
      canMutate: can,
      offlineReason,
    };
  }

  static canMutate(): boolean {
    return this.isOnlineState && this.isFirebaseReachableState;
  }

  static isOnline(): boolean {
    return this.isOnlineState;
  }

  static isFirebaseReachable(): boolean {
    return this.isFirebaseReachableState;
  }

  static subscribe(listener: (status: FirebaseAuthorityStatus) => void): () => void {
    this.init();
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.warn('Listener error in FirebaseAuthorityService:', err);
      }
    });
  }

  /**
   * Probes Firestore to verify active server responsiveness.
   * Caches successful probe for 8 seconds to prevent excessive traffic.
   */
  static async checkFirebaseReachability(force = false): Promise<boolean> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnlineState = false;
      this.isFirebaseReachableState = false;
      this.notifyListeners();
      return false;
    }

    const now = Date.now();
    if (!force && now - this.lastProbeTime < 8000 && this.isFirebaseReachableState) {
      return this.canMutate();
    }

    if (this.probeInFlight) {
      return this.probeInFlight;
    }

    this.probeInFlight = (async () => {
      try {
        // Fast server probe with 3500ms timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firebase probe timeout')), 3500)
        );

        // Directly probing the server confirms live network path to Firestore
        const probeDocRef = doc(db, '_health_probe', 'ping');
        const probePromise = getDocFromServer(probeDocRef);

        await Promise.race([probePromise, timeoutPromise]).catch((err) => {
          // If Firestore returns permission-denied or doc not found, Firebase server replied!
          const msg = err?.message || String(err);
          const code = err?.code || '';
          if (
            code.includes('permission-denied') ||
            code.includes('not-found') ||
            msg.includes('Missing or insufficient permissions') ||
            msg.includes('NOT_FOUND')
          ) {
            return true; // Server is alive and responding
          }
          throw err;
        });

        this.isOnlineState = true;
        this.isFirebaseReachableState = true;
        this.lastProbeTime = Date.now();
        this.notifyListeners();
        return true;
      } catch (e) {
        console.warn('[FirebaseAuthority] Firebase server unreachable:', e);
        this.isFirebaseReachableState = false;
        this.notifyListeners();
        return false;
      } finally {
        this.probeInFlight = null;
      }
    })();

    return this.probeInFlight;
  }

  /**
   * Defense-in-depth invariant check.
   * Every authoritative mutation MUST call this before execution.
   */
  static async assertCanMutate(operationName: string): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(`Operation "${operationName}" rejected: Internet connection required. ClearFlow is online-authoritative.`);
    }

    const reachable = await this.checkFirebaseReachability();
    if (!reachable) {
      throw new Error(`Operation "${operationName}" rejected: Firebase is currently unavailable. ClearFlow is online-authoritative.`);
    }
  }
}

/**
 * React hook to observe online/Firebase authority status
 */
export function useFirebaseAuthority(): FirebaseAuthorityStatus {
  const [status, setStatus] = useState<FirebaseAuthorityStatus>(() => FirebaseAuthorityService.getStatus());

  useEffect(() => {
    return FirebaseAuthorityService.subscribe(setStatus);
  }, []);

  return status;
}
