import { doc, runTransaction, serverTimestamp, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { FinancialEngine } from './financialEngine';
import { localDb } from './localDb';

export const HUMAN_ID_REGEX = /^[A-Z][0-9][A-Z][0-9]([A-Z][0-9])?$/;

export interface DisplayIdRegistryDoc {
  displayId: string;
  entityType: 'FUND' | 'SHARE';
  entityId: string;
  managerId: string;
  status: 'ACTIVE' | 'RETIRED';
  createdAt?: any;
  updatedAt?: any;
  retiredAt?: any;
  retiredReason?: string;
}

/**
 * Authoritative system-wide Display ID Registry Service
 * Enforces globally unique, non-recyclable, cryptographically random
 * 4-character identifiers (LETTER NUMBER LETTER NUMBER) across all tenants.
 */
export class DisplayIdRegistryService {
  /**
   * Generates a single random 4-character ID: ^[A-Z][0-9][A-Z][0-9]$
   */
  static generateCandidateId(): string {
    return FinancialEngine.generateRandomHumanDisplayId();
  }

  /**
   * Atomically checks and reserves a single display ID in the global registry.
   * If a collision occurs, it retries with a new randomly generated ID up to maxAttempts.
   * Never overwrites or modifies existing registry entries during reservation.
   */
  static async reserveDisplayId(params: {
    entityType: 'FUND' | 'SHARE';
    entityId: string;
    managerId: string;
    authUid: string;
    maxAttempts?: number;
  }): Promise<string> {
    const { entityType, entityId, managerId, authUid, maxAttempts = 50 } = params;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const candidateId = this.generateCandidateId();

      try {
        const reservedId = await runTransaction(db, async (tx) => {
          const regRef = doc(db, 'display_id_registry', candidateId);
          const snap = await tx.get(regRef);

          if (snap.exists()) {
            // Collision detected - already claimed or retired globally
            return null;
          }

          const regDoc: DisplayIdRegistryDoc = {
            displayId: candidateId,
            entityType,
            entityId,
            managerId,
            status: 'ACTIVE',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          tx.set(regRef, regDoc);
          return candidateId;
        });

        if (reservedId) {
          // Cache locally for offline fast lookups
          await localDb.put(managerId, 'app_cache', {
            id: `reg_${reservedId}`,
            displayId: reservedId,
            entityType,
            entityId,
            managerId,
            status: 'ACTIVE',
          });
          return reservedId;
        }
      } catch (err: any) {
        console.warn(`Registry transaction error for candidate ${candidateId} (attempt ${attempt + 1}):`, err?.message || err);
        
        // If offline, check local cache and fallback gracefully
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await localDb.getForTenant(managerId, 'app_cache', `reg_${candidateId}`);
          if (!cached) {
            await localDb.put(managerId, 'app_cache', {
              id: `reg_${candidateId}`,
              displayId: candidateId,
              entityType,
              entityId,
              managerId,
              status: 'ACTIVE',
            });

            // Queue authoritative reservation for when back online
            await localDb.queueOfflineMutation({
              operationId: `reserve_${candidateId}`,
              managerId,
              authUid,
              collection: 'display_id_registry',
              docId: candidateId,
              type: 'set',
              payload: {
                displayId: candidateId,
                entityType,
                entityId,
                managerId,
                status: 'ACTIVE',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }
            });
          }
          return candidateId;
        }
        
        if (attempt === maxAttempts - 1) throw err;
      }
    }
    throw new Error(`Failed to reserve unique Display ID after ${maxAttempts} attempts.`);
  }

  /**
   * Batch reservation for multiple entities
   */
  static async reserveMultipleDisplayIds(
    items: Array<{ entityType: 'FUND' | 'SHARE'; entityId: string }>,
    managerId: string,
    authUid: string,
    maxAttempts: number = 50
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    for (const item of items) {
      const reservedId = await this.reserveDisplayId({
        entityType: item.entityType,
        entityId: item.entityId,
        managerId,
        authUid,
        maxAttempts
      });
      results.set(item.entityId, reservedId);
    }
    
    return results;
  }

  /**
   * Hardened Replay logic for Display ID reservation.
   * Ensures that replay never overwrites an existing authoritative owner.
   */
  static async applyReplayReservation(payload: any): Promise<void> {
    const { displayId, entityId } = payload;
    
    await runTransaction(db, async (tx) => {
      const regRef = doc(db, 'display_id_registry', displayId);
      const snap = await tx.get(regRef);

      if (snap.exists()) {
        const existingData = snap.data() as DisplayIdRegistryDoc;
        if (existingData.entityId === entityId) {
          // Idempotent success: we already own this ID in the registry
          return;
        }
        // Collision: ID is owned by a DIFFERENT entity
        throw new Error(`REGISTRY_COLLISION: Display ID ${displayId} is already reserved by entity ${existingData.entityId}. Manual recovery required.`);
      }

      // Safe to reserve during replay
      tx.set(regRef, {
        ...payload,
        status: 'ACTIVE',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
  }

  /**
   * Retires a display ID globally, preventing it from being reused.
   */
  static async retireDisplayId(displayId: string, managerId: string, reason: string): Promise<void> {
    const regRef = doc(db, 'display_id_registry', displayId);
    await updateDoc(regRef, {
      status: 'RETIRED',
      retiredAt: serverTimestamp(),
      retiredReason: reason,
      updatedAt: serverTimestamp()
    });
    
    // Update local cache
    await localDb.put(managerId, 'app_cache', {
      id: `reg_${displayId}`,
      displayId,
      managerId,
      status: 'RETIRED',
      retiredReason: reason
    });
  }
}
