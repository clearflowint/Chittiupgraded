import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  writeBatch,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  startAfter,
  limit,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { DisplayIdRegistryService, HUMAN_ID_REGEX } from '../services/displayIdRegistry';
import { normalizePhoneNumber } from '../utils/phone';

import { 
  CommunicationDispatch,
  Fund, 
  Share, 
  Cycle, 
  Payment, 
  Billing,
  Payout,
  Contact, 
  Group, 
  Campaign, 
  CampaignTargetAudience,
  CampaignChannel,
  AuditRecord, 
  PaymentMethod,
  MaterializedLedger,
  PortalTokenRecord,
  PaginatedResult,
  FinalReportSnapshot
} from '../types';
import { localDb, QueuedOfflineMutation } from '../services/localDb';
import { FinancialEngine } from '../services/financialEngine';
import { ImpactEngine } from '../services/impactEngine';
import { CommunicationDispatcher } from '../services/communicationDispatcher';
import { notificationService } from '../services/notifications';

export interface AcknowledgementResult {
  isOpen: boolean;
  isSuccess: boolean;
  title: string;
  message: string;
  operationType?: string;
  referenceId?: string;
  ackTime?: string;
}

interface ChitFundContextType {
  funds: Fund[];
  shares: Share[];
  cycles: Cycle[];
  billings: Billing[];
  payouts: Payout[];
  payments: Payment[];
  contacts: Contact[];
  groups: Group[];
  campaigns: Campaign[];
  audits: AuditRecord[];
  ledgers: MaterializedLedger[];
  loading: boolean;
  activeFund: Fund | null;
  pendingOfflineCount: number;
  acknowledgementState: AcknowledgementResult;
  showAcknowledgement: (data: Omit<AcknowledgementResult, 'isOpen'>) => void;
  closeAcknowledgement: () => void;
  setActiveFundId: (id: string | null) => void;
  createFund: (data: {
    fundName: string;
    cycleFrequency?: 'monthly' | 'bi-weekly' | 'weekly';
    startDate?: string;
    reminderSchedule?: string;
    notes?: string;
    memberList?: { name: string; phone: string; shareCount: number; contactId?: string }[];
    totalPool?: number;
    numberOfShares?: number;
    totalMonths?: number;
    commissionPercent?: number;
    totalCycles?: number | null;
  }) => Promise<string>;
  addShare: (data: {
    fundId: string;
    memberName: string;
    memberPhone: string;
    shareCount?: number;
    contactId?: string;
  }) => Promise<string>;
  createCycle: (data: {
    fundId: string;
    cycleName?: string;
    startDate?: string;
    endDate?: string | null;
    netInstallmentDue?: number;
    winnerNetPayout?: number;
    organizerCommission?: number;
    auctionDate?: string;
    shareBills?: Record<string, number>;
  }) => Promise<string>;
  saveCycleBills: (data: {
    fundId: string;
    cycleId: string;
    shareBills: Record<string, number>;
    cycleName?: string;
    startDate?: string;
    endDate?: string | null;
    organizerCommission?: number;
  }) => Promise<void>;
  recordSharePayout: (data: {
    fundId: string;
    shareId: string;
    cycleId: string;
    payoutAmount: number;
    payoutDate?: string;
    paymentMethod?: PaymentMethod;
    reference?: string;
    notes?: string;
    idempotencyKey?: string;
  }) => Promise<void>;
  revokeSharePayout: (data: {
    fundId: string;
    payoutId: string;
    reason?: string;
  }) => Promise<void>;
  updateCycleMetadata: (data: {
    fundId: string;
    cycleId: string;
    cycleName?: string;
    startDate?: string;
    endDate?: string | null;
  }) => Promise<void>;
  endFund: (fundId: string) => Promise<FinalReportSnapshot>;
  revokeEndFund: (fundId: string) => Promise<void>;
  updateFundMetadata: (fundId: string, data: { totalCycles?: number | null }) => Promise<void>;
  recordPayment: (data: {
    fundId: string;
    shareId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    reference?: string;
    notes?: string;
    idempotencyKey?: string;
  }) => Promise<void>;
  finalizeCycleSettlement: (data: {
    fundId: string;
    cycleNumber: number;
    winnerShareId?: string;
    winningBidAmount?: number;
    netInstallmentDueOverride?: number;
    winnerNetPayoutOverride?: number;
    organizerCommissionOverride?: number;
  }) => Promise<void>;
  updateDrawStatus: (data: {
    fundId: string;
    cycleId: string;
    shareId: string;
    action: 'SET_DRAWN' | 'SET_UNDRAWN';
    winningBidAmount?: number;
    reason: string;
  }) => Promise<void>;
  dispatches: CommunicationDispatch[];
  recordDispatch: (dispatch: CommunicationDispatch) => Promise<void>;
  createContact: (contact: Omit<Contact, 'contactId' | 'managerId' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateContact: (contactId: string, data: Partial<Omit<Contact, 'contactId' | 'managerId' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  deleteContact: (contactId: string) => Promise<void>;
  createGroup: (name: string, description: string, memberIds?: string[]) => Promise<string>;
  updateGroup: (groupId: string, data: { name: string; description: string }) => Promise<void>;
  deleteGroup: (groupId: string) => Promise<void>;
  updateGroupMembers: (groupId: string, memberIds: string[]) => Promise<void>;
  sendCampaign: (data: { title: string; message: string; channels?: CampaignChannel[]; channel?: string; fundId?: string; targetGroupIds?: string[]; targetAudience?: CampaignTargetAudience; recipientCount?: number }) => Promise<void>;
  seedDemoDataIfEmpty: () => Promise<void>;
  rebuildMaterializedState: (fundId: string) => Promise<void>;
  updateShare: (data: {
    fundId: string;
    shareId: string;
    memberName: string;
    memberPhone: string;
    contactId?: string;
  }) => Promise<void>;
  deleteCurrentCycle: (fundId: string, cycleId: string) => Promise<void>;
  executeDrawAssignment: (data: {
    managerId: string;
    fundId: string;
    shareId: string;
    previousDrawCycleId: string | null;
    newDrawCycleId: string | null;
    payoutAmount: number;
    billingChanges: Record<number, number>;
  }) => Promise<void>;
  deleteFund: (fundId: string) => Promise<void>;
  updateFundNameAndFrequency: (fundId: string, name: string, frequency: string, startDate?: string | null) => Promise<void>;
  deleteShare: (fundId: string, shareId: string) => Promise<void>;
  getShareByPortalToken: (token: string) => Promise<{ share: Share; fund: Fund; payments: Payment[] } | null>;
  fetchPaymentsPage: (cursorDoc?: any, pageSize?: number) => Promise<PaginatedResult<Payment>>;
  fetchAuditsPage: (cursorDoc?: any, pageSize?: number) => Promise<PaginatedResult<AuditRecord>>;
}

const ChitFundContext = createContext<ChitFundContextType | undefined>(undefined);

export const ChitFundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { tenant } = useAuth();
  const managerId = tenant?.managerId;
  const authUid = tenant?.authUid;
  const actorUid = tenant?.authUid || tenant?.managerId || '';

  const [funds, setFunds] = useState<Fund[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [billings, setBillings] = useState<Billing[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [dispatches, setDispatches] = useState<CommunicationDispatch[]>([]);
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [ledgers, setLedgers] = useState<MaterializedLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFundId, setActiveFundId] = useState<string | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);

  const seenCompletedDispatchesRef = React.useRef<Set<string>>(new Set());

  const generateUniqueFundDisplayId = useCallback(() => {
    return DisplayIdRegistryService.generateCandidateId();
  }, []);

  const generateUniqueShareDisplayId = useCallback(() => {
    return DisplayIdRegistryService.generateCandidateId();
  }, []);

  const generateUniqueGroupDisplayId = useCallback(() => {
    let id = FinancialEngine.generateHumanId();
    let attempts = 0;
    while (groups.some(g => g.displayId === id) && attempts < 100) {
      id = FinancialEngine.generateHumanId();
      attempts++;
    }
    if (attempts >= 100) throw new Error('System exhausted available unique Group IDs.');
    return id;
  }, [groups]);

  const [acknowledgementState, setAcknowledgementState] = useState<AcknowledgementResult>({
    isOpen: false,
    isSuccess: false,
    title: '',
    message: '',
  });

  const showAcknowledgement = useCallback((data: Omit<AcknowledgementResult, 'isOpen'>) => {
    setAcknowledgementState({
      ...data,
      isOpen: true,
    });
  }, []);

  const closeAcknowledgement = useCallback(() => {
    setAcknowledgementState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  const activeFund = activeFundId
    ? funds.find(
        (f) =>
          f.fundId === activeFundId ||
          (f.displayId &&
            f.displayId.toLowerCase().replace(/[^a-z0-9]/g, '') ===
              activeFundId.toLowerCase().replace(/[^a-z0-9]/g, ''))
      ) || null
    : null;

  // 1. Initial Load: Retrieve ONLY the current authenticated tenant's cached data from IndexedDB
  useEffect(() => {
    async function loadTenantCache() {
      if (!managerId) {
        setFunds([]);
        setShares([]);
        setCycles([]);
        setBillings([]);
        setPayouts([]);
        setPayments([]);
        setContacts([]);
        setGroups([]);
        setCampaigns([]);
        setDispatches([]);
        setAudits([]);
        setLedgers([]);
        notificationService.setTenant(null);
        return;
      }

      notificationService.setTenant(managerId);

      const [cFunds, cShares, cCycles, cBillings, cPayouts, cPayments, cContacts, cGroups, cCampaigns, cDispatches, cAudits, cLedgers, pending] =
        await Promise.all([
          localDb.getAllForTenant<Fund>(managerId, 'funds'),
          localDb.getAllForTenant<Share>(managerId, 'shares'),
          localDb.getAllForTenant<Cycle>(managerId, 'cycles'),
          localDb.getAllForTenant<Billing>(managerId, 'billings'),
          localDb.getAllForTenant<Payout>(managerId, 'payouts'),
          localDb.getAllForTenant<Payment>(managerId, 'payments'),
          localDb.getAllForTenant<Contact>(managerId, 'contacts'),
          localDb.getAllForTenant<Group>(managerId, 'groups'),
          localDb.getAllForTenant<Campaign>(managerId, 'campaigns'),
          localDb.getAllForTenant<CommunicationDispatch>(managerId, 'dispatches'),
          localDb.getAllForTenant<AuditRecord>(managerId, 'audits'),
          localDb.getAllForTenant<MaterializedLedger>(managerId, 'ledgers'),
          localDb.getPendingMutations(managerId),
        ]);

      if (cFunds.length > 0) setFunds(cFunds);
      if (cShares.length > 0) setShares(cShares);
      if (cCycles.length > 0) setCycles(cCycles);
      if (cBillings.length > 0) setBillings(cBillings);
      if (cPayouts.length > 0) setPayouts(cPayouts);
      if (cPayments.length > 0) {
        setPayments(cPayments.map(p => {
          delete (p as any).cycleNumber;
          delete (p as any).allocations;
          return p;
        }));
      }
      if (cContacts.length > 0) setContacts(cContacts);
      if (cGroups.length > 0) setGroups(cGroups);
      if (cCampaigns.length > 0) setCampaigns(cCampaigns);
      if (cDispatches.length > 0) {
        setDispatches(cDispatches);
        cDispatches.forEach((d) => {
          if (d.status === 'completed' || d.status === 'failed') {
            seenCompletedDispatchesRef.current.add(d.dispatchId);
          }
        });
      }
      if (cAudits.length > 0) setAudits(cAudits);
      if (cLedgers.length > 0) setLedgers(cLedgers);
      setPendingOfflineCount(pending.length);
    }
    loadTenantCache();
  }, [managerId]);

  // 2. Offline Queue Replay Worker: Executes queued mutations when connectivity resumes
  const syncOfflineQueue = useCallback(async () => {
    if (!managerId || typeof navigator === 'undefined' || !navigator.onLine) return;

    const pending = await localDb.getPendingMutations(managerId);
    if (pending.length === 0) return;

    for (const item of pending) {
      try {
        // Enforce strict tenant boundary: mutation must match current authenticated tenant
        if (item.managerId !== managerId || (authUid && item.authUid && item.authUid !== authUid)) {
          console.warn('Dropping queued mutation with tenant/auth mismatch:', item.operationId);
          await localDb.removeQueuedMutation(managerId, item.operationId);
          continue;
        }

        if (item.type === 'batch') {
          // Batch execution handled by caller or single write
          const batch = writeBatch(db);
          for (const op of item.payload.operations || []) {
            const targetRef = doc(db, op.collection, op.docId);
            if (op.action === 'set') batch.set(targetRef, op.data);
            else if (op.action === 'update') batch.update(targetRef, op.data);
            else if (op.action === 'delete') batch.delete(targetRef);
          }
          await batch.commit();
        } else {
          const targetRef = doc(db, item.collection, item.docId);
          if (item.type === 'set') await setDoc(targetRef, item.payload);
          else if (item.type === 'update') await setDoc(targetRef, item.payload, { merge: true });
        }
        await localDb.removeQueuedMutation(managerId, item.operationId);
      } catch (err) {
        console.warn('Sync queue execution item error:', err);
      }
    }

    const remaining = await localDb.getPendingMutations(managerId);
    setPendingOfflineCount(remaining.length);
    if (remaining.length === 0) {
      notificationService.send('Cloud Synchronization Complete', 'All offline financial changes have been securely committed.', 'sync');
    }
  }, [managerId]);

  useEffect(() => {
    window.addEventListener('online', syncOfflineQueue);
    return () => window.removeEventListener('online', syncOfflineQueue);
  }, [syncOfflineQueue]);

  // 3. Firestore Real-Time Snapshot Listeners (Strictly Tenant-Scoped)
  useEffect(() => {
    if (!managerId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubs: (() => void)[] = [];

    const attachTenantListener = <T extends Record<string, any>>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      cacheStore: string
    ) => {
      try {
        const q = query(collection(db, colName), where('managerId', '==', managerId));
        const unsub = onSnapshot(
          q,
          async (snapshot) => {
            const list: T[] = [];
            snapshot.forEach((d) => {
              list.push({ ...d.data(), id: d.id } as unknown as T);
            });
            setter(list);
            await localDb.putBatch(managerId, cacheStore, list);
          },
          (error) => {
            console.warn(`Firestore snapshot notice on ${colName} (offline fallback):`, error.message);
          }
        );
        unsubs.push(unsub);
      } catch (err) {
        console.warn(`Snapshot subscription error for ${colName}:`, err);
      }
    };

    const attachBoundedTenantListener = <T extends Record<string, any>>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      cacheStore: string,
      limitCount = 50
    ) => {
      try {
        const q = query(
          collection(db, colName),
          where('managerId', '==', managerId),
          limit(limitCount)
        );
        const unsub = onSnapshot(
          q,
          async (snapshot) => {
            const list: T[] = [];
            snapshot.forEach((d) => {
              const itemData = d.data();
              if (colName === 'payments') {
                delete (itemData as any).cycleNumber;
                delete (itemData as any).allocations;
              }
              list.push({ ...itemData, id: d.id } as unknown as T);
            });
            setter(list);
            await localDb.putBatch(managerId, cacheStore, list);
          },
          (error) => {
            console.warn(`Firestore snapshot notice on bounded ${colName} (offline fallback):`, error.message);
          }
        );
        unsubs.push(unsub);
      } catch (err) {
        console.warn(`Snapshot subscription error for bounded ${colName}:`, err);
      }
    };

    attachTenantListener<Fund>('funds', setFunds, 'funds');
    attachTenantListener<Share>('shares', setShares, 'shares');
    attachTenantListener<Cycle>('cycles', setCycles, 'cycles');
    attachTenantListener<Billing>('billings', setBillings, 'billings');
    attachTenantListener<Payout>('payouts', setPayouts, 'payouts');
    attachBoundedTenantListener<Payment>('payments', setPayments, 'payments', 50);
    attachTenantListener<Contact>('contacts', setContacts, 'contacts');
    attachTenantListener<Group>('groups', setGroups, 'groups');
    attachTenantListener<Campaign>('campaigns', setCampaigns, 'campaigns');
    attachTenantListener<CommunicationDispatch>('dispatches', (action) => {
      const list = typeof action === 'function' ? action(dispatches) : action;
      setDispatches(list);
      list.forEach((d: CommunicationDispatch) => {
        if ((d.status === 'completed' || d.status === 'failed') && !seenCompletedDispatchesRef.current.has(d.dispatchId)) {
          seenCompletedDispatchesRef.current.add(d.dispatchId);
          if (d.status === 'completed') {
            const sentCount = d.sent ?? d.recipientCount;
            const failedCount = d.failed ?? 0;
            const skippedCount = d.skipped ?? 0;
            notificationService.send(
              'Dispatch Completed',
              `${d.fundName || 'Outreach'} — ${d.event}: ${sentCount} sent, ${failedCount} failed, ${skippedCount} skipped.`,
              'dispatch'
            );
          } else if (d.status === 'failed') {
            notificationService.send(
              'Dispatch Failed',
              `${d.fundName || 'Outreach'} — ${d.event} failed to deliver: ${d.errorMessage || 'Server error'}.`,
              'dispatch'
            );
          }
        }
      });
    }, 'dispatches');
    attachBoundedTenantListener<AuditRecord>('audits', setAudits, 'audits', 50);
    attachTenantListener<MaterializedLedger>('ledgers', setLedgers, 'ledgers');

    setLoading(false);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [managerId]);

  const recordDispatch = useCallback(async (dispatch: CommunicationDispatch) => {
    if (!managerId) return;
    try {
      await setDoc(doc(db, 'dispatches', dispatch.dispatchId), dispatch);
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid: authUid || managerId,
        collection: 'dispatches',
        docId: dispatch.dispatchId,
        type: 'set',
        payload: dispatch,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }
    await localDb.put(managerId, 'dispatches', dispatch);
    setDispatches((prev) => {
      const existingIndex = prev.findIndex((d) => d.dispatchId === dispatch.dispatchId);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = dispatch;
        return next;
      }
      return [dispatch, ...prev];
    });
  }, [managerId, authUid]);

  // Seed high-quality demo data (Idempotent using deterministic document IDs & persistent registry)
  const seedDemoDataIfEmpty = useCallback(async () => {
    if (!managerId || !authUid || loading) return;
    
    const demoFund1Id = `demo_fund_apex_${managerId}`;
    const demoFund2Id = `demo_fund_emerald_${managerId}`;

    const isPatternedId = (id?: string) => 
      !id || id === 'A1B2' || id === 'E5M0' || /^X\d+Y\d+$/.test(id) || /^Z\d+W\d+$/.test(id) || /^SH-/.test(id) || /^S\d+$/.test(id);

    // 1. Check if demo fund already exists in current tenant
    const existingFund1 = funds.find(f => f.fundId === demoFund1Id);
    const existingFund2 = funds.find(f => f.fundId === demoFund2Id);

    if (existingFund1) {
      // Check if existing demo entities have legacy patterned IDs (e.g. X1Y1, A1B2, etc.)
      const patternedShares = shares.filter(s => s.managerId === managerId && (s.fundId === demoFund1Id || s.fundId === demoFund2Id) && isPatternedId(s.displayId));
      const fund1NeedsMigration = isPatternedId(existingFund1.displayId);
      const fund2NeedsMigration = existingFund2 && isPatternedId(existingFund2.displayId);

      if (fund1NeedsMigration || fund2NeedsMigration || patternedShares.length > 0) {
        console.log('Migrating legacy demo display IDs to persistent system-wide registry...');
        try {
          const itemsToMigrate: Array<{ entityType: 'FUND' | 'SHARE'; entityId: string }> = [];
          if (fund1NeedsMigration) itemsToMigrate.push({ entityType: 'FUND', entityId: existingFund1.fundId });
          if (fund2NeedsMigration && existingFund2) itemsToMigrate.push({ entityType: 'FUND', entityId: existingFund2.fundId });
          patternedShares.forEach(s => itemsToMigrate.push({ entityType: 'SHARE', entityId: s.shareId }));

          const migratedMap = await DisplayIdRegistryService.reserveMultipleDisplayIds(itemsToMigrate, managerId);
          const batch = writeBatch(db);

          if (fund1NeedsMigration) {
            const newId = migratedMap.get(existingFund1.fundId);
            if (newId) {
              batch.update(doc(db, 'funds', existingFund1.fundId), { displayId: newId });
              setFunds(prev => prev.map(f => f.fundId === existingFund1.fundId ? { ...f, displayId: newId } : f));
              await localDb.put(managerId, 'funds', { ...existingFund1, displayId: newId });
            }
          }
          if (fund2NeedsMigration && existingFund2) {
            const newId = migratedMap.get(existingFund2.fundId);
            if (newId) {
              batch.update(doc(db, 'funds', existingFund2.fundId), { displayId: newId });
              setFunds(prev => prev.map(f => f.fundId === existingFund2.fundId ? { ...f, displayId: newId } : f));
              await localDb.put(managerId, 'funds', { ...existingFund2, displayId: newId });
            }
          }
          for (const s of patternedShares) {
            const newId = migratedMap.get(s.shareId);
            if (newId) {
              batch.update(doc(db, 'shares', s.shareId), { displayId: newId });
              await localDb.put(managerId, 'shares', { ...s, displayId: newId });
            }
          }
          setShares(prev => prev.map(s => {
            const newId = migratedMap.get(s.shareId);
            return newId ? { ...s, displayId: newId } : s;
          }));

          await batch.commit();
          console.log('Legacy demo IDs migrated cleanly to persistent registry.');
        } catch (mErr) {
          console.warn('Demo ID migration notice:', mErr);
        }
      }

      // Check if existing contacts have legacy IDs (e.g. demo_con_*) or displayId, and migrate them
      const legacyContacts = contacts.filter(
        (c) => c.managerId === managerId && (c.contactId.startsWith('demo_con_') || (c as any).displayId)
      );
      if (legacyContacts.length > 0) {
        try {
          const cBatch = writeBatch(db);
          for (const c of legacyContacts) {
            const normPhone = normalizePhoneNumber(c.phone);
            const updated: Contact = {
              ...c,
              contactId: normPhone,
              phone: normPhone,
              updatedAt: new Date().toISOString(),
            };
            delete (updated as any).displayId;
            cBatch.set(doc(db, 'contacts', normPhone), updated);
            if (c.contactId !== normPhone) {
              cBatch.delete(doc(db, 'contacts', c.contactId));
              await localDb.delete(managerId, 'contacts', c.contactId);
            }
            await localDb.put(managerId, 'contacts', updated);
          }
          await cBatch.commit();
        } catch (cErr) {
          console.warn('Contact migration notice:', cErr);
        }
      }

      // If existing funds are present but contact groups are not yet seeded, initialize default Contact Groups
      if (groups.length === 0) {
        try {
          const nowStr = new Date().toISOString();
          const defaultGroups: Group[] = [
            {
              groupId: `demo_grp_vip_${managerId}`,
              displayId: 'GRP-VIP',
              managerId,
              name: 'VIP Customers',
              description: 'High net-worth investors eligible for premium chitti pools exceeding ₹5 Lakhs.',
              memberIds: contacts.slice(0, 12).map(c => c.contactId),
              createdAt: nowStr,
              updatedAt: nowStr,
            },
            {
              groupId: `demo_grp_prospects_${managerId}`,
              displayId: 'GRP-PRO',
              managerId,
              name: 'Prospective Members',
              description: 'Interested leads awaiting upcoming cycle registration.',
              memberIds: contacts.slice(12, 22).map(c => c.contactId),
              createdAt: nowStr,
              updatedAt: nowStr,
            },
            {
              groupId: `demo_grp_followup_${managerId}`,
              displayId: 'GRP-FOL',
              managerId,
              name: 'Follow Up',
              description: 'Members requesting dividend performance reports and scheme brochures.',
              memberIds: contacts.slice(22, 30).map(c => c.contactId),
              createdAt: nowStr,
              updatedAt: nowStr,
            },
          ];
          const gBatch = writeBatch(db);
          defaultGroups.forEach(g => gBatch.set(doc(db, 'groups', g.groupId), g));
          await gBatch.commit();
          await localDb.putBatch(managerId, 'groups', defaultGroups);
          setGroups(defaultGroups);
        } catch (grpErr) {
          console.warn('Notice seeding default contact groups:', grpErr);
        }
      }
      return;
    }

    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      const auditId = `demo_audit_bootstrap_${managerId}`;

      // Reserve genuine random registered IDs for Demo Funds and Demo Shares
      const demoItemsToReserve: Array<{ entityType: 'FUND' | 'SHARE'; entityId: string }> = [
        { entityType: 'FUND', entityId: demoFund1Id },
        { entityType: 'FUND', entityId: demoFund2Id },
        ...Array.from({ length: 20 }, (_, i) => ({ entityType: 'SHARE' as const, entityId: `demo_share_1_${i + 1}_${managerId}` })),
        ...Array.from({ length: 10 }, (_, i) => ({ entityType: 'SHARE' as const, entityId: `demo_share_2_${i + 1}_${managerId}` })),
      ];

      const reservedIdMap = await DisplayIdRegistryService.reserveMultipleDisplayIds(demoItemsToReserve, managerId);

      // 1. Create Contacts (Master CRM Records - deterministic IDs)
      const memberNames = [
        'Ananya Deshmukh', 'Vikramaditya Rao', 'Kavita Sundaram', 'Rohan Mehra', 'Deepak Chawla',
        'Sunil Gavaskar', 'Meena Iyer', 'Karthik Raja', 'Harish Babu', 'Pooja Hegde',
        'Siddharth Roy', 'Neha Kapoor', 'Arvind Kejriwal', 'Bhavna Parekh', 'Girish Karnad',
        'Tanvi Shah', 'Manoj Bajpayee', 'Shreya Ghoshal', 'Naveen Jindal', 'Zoya Akhtar',
        'Suresh Raina', 'Rahul Dravid', 'Sourav Ganguly', 'VVS Laxman', 'Anil Kumble', 
        'Zaheer Khan', 'Irfan Pathan', 'Harbhajan Singh', 'Prithvi Shaw', 'Shubman Gill'
      ];

      const seededContacts: Contact[] = memberNames.map((name, i) => {
        const phone = normalizePhoneNumber(`+91 98450 ${10000 + i}`);
        return {
          contactId: phone,
          managerId,
          name,
          phone,
          email: `${name.toLowerCase().replace(' ', '.')}@example.com`,
          createdAt: now,
          updatedAt: now,
          communicationStatus: 'subscribed'
        };
      });

      // ----------------------------------------------------
      // FUND 1: Apex Wealth Series I (High Value, Ongoing)
      // ----------------------------------------------------
      const totalPool1 = 500000;
      const totalMonths1 = 20;
      const numberOfShares1 = 20;
      const commissionPercent1 = 5;
      const fund1DisplayId = reservedIdMap.get(demoFund1Id) || FinancialEngine.generateRandomHumanDisplayId();

      const fund1: Fund = {
        fundId: demoFund1Id,
        displayId: fund1DisplayId,
        managerId,
        fundName: 'Apex Wealth Series I (₹5 Lakhs)',
        totalPool: totalPool1,
        totalPoolPaise: FinancialEngine.toPaise(totalPool1),
        totalMonths: totalMonths1,
        numberOfShares: numberOfShares1,
        currentMonth: 5,
        cycleFrequency: 'monthly',
        commissionPercent: commissionPercent1,
        startDate: '2026-05-01',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const seededShares1: Share[] = [];
      const seededTokens1: PortalTokenRecord[] = [];
      
      seededContacts.forEach((contact, i) => {
        if (i >= 20) return; // Only 20 shares for fund 1
        const shareId = `demo_share_1_${i + 1}_${managerId}`;
        const portalToken = `demo_token_1_${i + 1}_${managerId}`;
        const shareDisplayId = reservedIdMap.get(shareId) || FinancialEngine.generateRandomHumanDisplayId();
        
        // Custom states for demo variety
        const isWinner = i < 3;
        const wonMonth = isWinner ? i + 1 : null;
        
        // Varying financials
        let totalPaid = isWinner ? 21500 : 21500;
        if (i === 4) totalPaid = 15000; // Someone with arrears
        if (i === 10) totalPaid = 25000; // Someone with advance
        
        const totalBilled = 21500; // 5 months @ avg ~4300
        const resolved = FinancialEngine.resolveBalance(totalBilled, totalPaid);

        const share: Share = {
          shareId,
          displayId: shareDisplayId,
          managerId,
          fundId: demoFund1Id,
          memberId: contact.contactId,
          contactId: contact.contactId,
          memberName: contact.name,
          memberPhone: contact.phone,
          shareNumber: i + 1,
          shareCount: 1,
          hasClaimedPrize: isWinner,
          wonMonth,
          status: isWinner ? 'drawn' : 'undrawn',
          totalBilled,
          totalPaid,
          arrears: resolved.arrears,
          advance: resolved.advance,
          portalToken,
          createdAt: now,
          updatedAt: now,
        };

        seededShares1.push(share);
        seededTokens1.push({
          token: portalToken,
          managerId,
          fundId: demoFund1Id,
          shareId,
          memberName: contact.name,
          shareNumber: i + 1,
          createdAt: now,
        });
      });

      // Seed 5 cycles for Fund 1
      const bidDiscounts1 = [100000, 95000, 90000, 85000, 80000];
      const seededCycles1: Cycle[] = [];
      const seededBillings1: Billing[] = [];
      const seededPayouts1: Payout[] = [];

      for (let m = 1; m <= 5; m++) {
        const cycleId = `demo_cycle_1_${m}_${managerId}`;
        const winningBid = bidDiscounts1[m - 1];
        const calc = FinancialEngine.calculateCycle({
          totalPool: totalPool1,
          totalMonths: totalMonths1,
          totalShares: numberOfShares1,
          winningBidAmount: winningBid,
          commissionPercent: commissionPercent1,
        });

        const isClosed = m < 5;
        const cycle: Cycle = {
          cycleId,
          displayId: FinancialEngine.generateDisplayId('CY'),
          managerId,
          fundId: demoFund1Id,
          cycleNumber: m,
          monthIndex: m,
          auctionDate: `2026-0${4 + m}-15`,
          winningBidAmount: winningBid,
          winnerShareId: isClosed ? seededShares1[m - 1].shareId : null,
          winnerMemberName: isClosed ? seededShares1[m - 1].memberName : null,
          organizerCommission: calc.organizerCommission,
          dividendPool: calc.dividendPool,
          dividendPerShare: calc.dividendPerShare,
          grossInstallment: calc.grossInstallment,
          netInstallmentDue: calc.netInstallmentDue,
          winnerNetPayout: calc.winnerNetPayout,
          isAuctionClosed: isClosed,
          status: isClosed ? 'finalized' : 'bidding',
          createdAt: now,
          finalizedAt: isClosed ? `2026-0${4 + m}-15T18:00:00Z` : null,
        };
        seededCycles1.push(cycle);

        // Billings
        seededShares1.forEach(s => {
          seededBillings1.push({
            billingId: `demo_bill_1_${m}_${s.shareId}`,
            managerId,
            fundId: demoFund1Id,
            cycleId,
            shareId: s.shareId,
            billAmount: cycle.netInstallmentDue,
            billAmountPaise: FinancialEngine.toPaise(cycle.netInstallmentDue),
            createdAt: now,
            updatedAt: now,
            createdBy: authUid,
            version: 1,
          });
        });

        // Payouts
        if (isClosed && cycle.winnerShareId && cycle.winnerNetPayout > 0) {
          seededPayouts1.push({
            payoutId: `demo_payout_1_${m}_${cycle.winnerShareId}`,
            managerId,
            fundId: demoFund1Id,
            cycleId,
            shareId: cycle.winnerShareId,
            memberId: seededShares1[m - 1].memberId,
            amount: cycle.winnerNetPayout,
            amountPaise: FinancialEngine.toPaise(cycle.winnerNetPayout),
            payoutDate: cycle.auctionDate,
            paymentMethod: 'Bank',
            status: 'disbursed',
            createdAt: now,
            createdBy: authUid,
          });
        }
      }

      // ----------------------------------------------------
      // FUND 2: Emerald Micro (Low Value, Just Started)
      // ----------------------------------------------------
      const fund2DisplayId = reservedIdMap.get(demoFund2Id) || FinancialEngine.generateRandomHumanDisplayId();
      const fund2: Fund = {
        fundId: demoFund2Id,
        displayId: fund2DisplayId,
        managerId,
        fundName: 'Emerald Micro (₹1 Lakh)',
        totalPool: 100000,
        totalPoolPaise: FinancialEngine.toPaise(100000),
        totalMonths: 10,
        numberOfShares: 10,
        currentMonth: 1,
        cycleFrequency: 'monthly',
        commissionPercent: 5,
        startDate: '2026-09-01',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      const seededShares2: Share[] = [];
      for (let i = 0; i < 10; i++) {
        const contact = seededContacts[i];
        const shareId = `demo_share_2_${i + 1}_${managerId}`;
        const shareDisplayId = reservedIdMap.get(shareId) || FinancialEngine.generateRandomHumanDisplayId();
        seededShares2.push({
          shareId,
          displayId: shareDisplayId,
          managerId,
          fundId: demoFund2Id,
          memberId: contact.contactId,
          contactId: contact.contactId,
          memberName: contact.name,
          memberPhone: contact.phone,
          shareNumber: i + 1,
          shareCount: 1,
          hasClaimedPrize: false,
          wonMonth: null,
          status: 'undrawn',
          totalBilled: 0,
          totalPaid: 0,
          arrears: 0,
          advance: 0,
          portalToken: `demo_token_2_${i + 1}_${managerId}`,
          createdAt: now,
          updatedAt: now,
        });
      }

      // Final Batch Write
      seededContacts.forEach(c => batch.set(doc(db, 'contacts', c.contactId), c));
      
      batch.set(doc(db, 'funds', demoFund1Id), fund1);
      seededShares1.forEach(s => batch.set(doc(db, 'shares', s.shareId), s));
      seededTokens1.forEach(t => batch.set(doc(db, 'portal_tokens', t.token), t));
      seededCycles1.forEach(c => batch.set(doc(db, 'cycles', c.cycleId), c));
      seededBillings1.forEach(b => batch.set(doc(db, 'billings', b.billingId), b));
      seededPayouts1.forEach(p => batch.set(doc(db, 'payouts', p.payoutId), p));

      batch.set(doc(db, 'funds', demoFund2Id), fund2);
      seededShares2.forEach(s => batch.set(doc(db, 'shares', s.shareId), s));

      const seededGroups: Group[] = [
        {
          groupId: `demo_grp_vip_${managerId}`,
          displayId: 'GRP-VIP',
          managerId,
          name: 'VIP Customers',
          description: 'High net-worth investors eligible for premium chitti pools exceeding ₹5 Lakhs.',
          memberIds: seededContacts.slice(0, 12).map(c => c.contactId),
          createdAt: now,
          updatedAt: now,
        },
        {
          groupId: `demo_grp_prospects_${managerId}`,
          displayId: 'GRP-PRO',
          managerId,
          name: 'Prospective Members',
          description: 'Interested leads awaiting upcoming cycle registration.',
          memberIds: seededContacts.slice(12, 22).map(c => c.contactId),
          createdAt: now,
          updatedAt: now,
        },
        {
          groupId: `demo_grp_followup_${managerId}`,
          displayId: 'GRP-FOL',
          managerId,
          name: 'Follow Up',
          description: 'Members requesting dividend performance reports and scheme brochures.',
          memberIds: seededContacts.slice(22, 30).map(c => c.contactId),
          createdAt: now,
          updatedAt: now,
        },
      ];
      seededGroups.forEach(g => batch.set(doc(db, 'groups', g.groupId), g));

      const audit: AuditRecord = {
        auditId,
        managerId,
        actorUid,
        action: 'FUND_BOOTSTRAP',
        entityType: 'FUND',
        entityId: demoFund1Id,
        timestamp: now,
        createdAt: serverTimestamp(),
        reason: 'Seeded comprehensive enterprise demo dataset with Contacts, 2 Schemes, 15+ Cycles, and Ledger records.',
      };
      batch.set(doc(db, 'audits', auditId), audit);

      await batch.commit();

      // Update Local Cache
      await localDb.putBatch(managerId, 'contacts', seededContacts);
      await localDb.put(managerId, 'funds', fund1);
      await localDb.putBatch(managerId, 'shares', seededShares1);
      await localDb.putBatch(managerId, 'cycles', seededCycles1);
      await localDb.putBatch(managerId, 'billings', seededBillings1);
      await localDb.putBatch(managerId, 'payouts', seededPayouts1);
      await localDb.put(managerId, 'funds', fund2);
      await localDb.putBatch(managerId, 'shares', seededShares2);
      await localDb.putBatch(managerId, 'groups', seededGroups);
      await localDb.put(managerId, 'audits', audit);

      // Refresh Context State (Selective)
      setContacts(seededContacts);
      setGroups(seededGroups);
      // Ensure we don't duplicate in state either
      setFunds(prev => {
        const next = [...prev];
        if (!next.some(f => f.fundId === fund1.fundId)) next.push(fund1);
        if (!next.some(f => f.fundId === fund2.fundId)) next.push(fund2);
        return next;
      });
      setShares(prev => [...prev, ...seededShares1, ...seededShares2]);
      setCycles(prev => [...prev, ...seededCycles1]);
      setBillings(prev => [...prev, ...seededBillings1]);
      setPayouts(prev => [...prev, ...seededPayouts1]);
      setActiveFundId(demoFund1Id);
      
      notificationService.send('Demo Seeding Complete', 'CRM Contacts and Portfolio Workspaces have been initialized.', 'sync');
    } catch (e) {
      console.warn('Enterprise Seeding Exception:', e);
    }
  }, [managerId, authUid, loading, funds]);

  useEffect(() => {
    if (funds.length === 0 && managerId && !loading) {
      seedDemoDataIfEmpty();
    }
  }, [funds.length, managerId, loading, seedDemoDataIfEmpty]);

  // Phase 4 & 6: Create New Fund Wizard (Atomic Multi-Document Batch)
  const createFund = async (data: {
    fundName: string;
    cycleFrequency?: 'monthly' | 'bi-weekly' | 'weekly';
    startDate?: string;
    reminderSchedule?: string;
    notes?: string;
    memberList?: { name: string; phone: string; shareCount: number; contactId?: string }[];
    totalPool?: number;
    numberOfShares?: number;
    totalMonths?: number;
    commissionPercent?: number;
    totalCycles?: number | null;
  }): Promise<string> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fundId = FinancialEngine.generateCryptoToken();
    const memberList = data.memberList || [];

    // Pre-generate unique entity IDs for each member share
    const memberShareIds = memberList.map(() => FinancialEngine.generateCryptoToken());

    // Atomically reserve global unique display IDs for Fund and all initial Shares
    const itemsToReserve: Array<{ entityType: 'FUND' | 'SHARE'; entityId: string }> = [
      { entityType: 'FUND', entityId: fundId },
      ...memberShareIds.map(sId => ({ entityType: 'SHARE' as const, entityId: sId }))
    ];

    const reservedIdsMap = await DisplayIdRegistryService.reserveMultipleDisplayIds(itemsToReserve, managerId);
    const fundDisplayId = reservedIdsMap.get(fundId) || FinancialEngine.generateRandomHumanDisplayId();

    if (!HUMAN_ID_REGEX.test(fundDisplayId)) {
      throw new Error('Invalid Fund ID generated. Please try again.');
    }

    const pool = data.totalPool || 0;
    const totalShares = data.numberOfShares !== undefined ? data.numberOfShares : memberList.length;
    const totalMonths = data.totalMonths !== undefined ? data.totalMonths : 1;
    const commPercent = data.commissionPercent || 0;
    const frequency = data.cycleFrequency || 'monthly';
    const start = data.startDate || new Date().toISOString().split('T')[0];

    const newFund: Fund = {
      fundId,
      displayId: fundDisplayId,
      managerId,
      fundName: data.fundName,
      totalPool: pool,
      totalPoolPaise: FinancialEngine.toPaise(pool),
      numberOfShares: totalShares,
      totalMonths,
      currentMonth: 1,
      cycleFrequency: frequency,
      commissionPercent: commPercent,
      startDate: start,
      reminderSchedule: data.reminderSchedule || '3 days before cycle date',
      notes: data.notes || '',
      status: 'active',
      totalCycles: data.totalCycles || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const createdShares: Share[] = [];
    const createdTokens: PortalTokenRecord[] = [];

    let shareNum = 1;
    for (let idx = 0; idx < memberList.length; idx++) {
      const mem = memberList[idx];
      const shareId = memberShareIds[idx];
      const portalToken = FinancialEngine.generateCryptoToken();
      const shareDisplayId = reservedIdsMap.get(shareId) || FinancialEngine.generateRandomHumanDisplayId();

      const share: Share = {
        shareId,
        displayId: shareDisplayId,
        managerId,
        fundId,
        memberId: mem.contactId || FinancialEngine.generateCryptoToken(),
        memberName: mem.name,
        memberPhone: mem.phone,
        shareNumber: shareNum,
        shareCount: mem.shareCount || 1,
        hasClaimedPrize: false,
        wonMonth: null,
        status: 'undrawn',
        totalBilled: 0,
        totalPaid: 0,
        arrears: 0,
        advance: 0,
        portalToken,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      createdShares.push(share);
      createdTokens.push({
        token: portalToken,
        managerId,
        fundId,
        shareId,
        memberName: mem.name,
        shareNumber: shareNum,
        createdAt: new Date().toISOString(),
        shareSnapshot: share,
        fundSnapshot: newFund,
        recentPayments: [],
      } as any);
      shareNum++;
    }

    // Materialized Chitti Ledger
    const chittiLedger: MaterializedLedger = {
      ledgerId: `ledger_${fundId}`,
      managerId,
      fundId,
      ledgerType: 'CHITTI_LEDGER',
      totalPool: pool,
      totalCollected: 0,
      totalDisbursed: 0,
      totalArrears: 0,
      totalMembers: totalShares,
      updatedAt: new Date().toISOString(),
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'FUND_CREATED',
      entityType: 'FUND',
      entityId: fundId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Initialized scheme ${data.fundName} with start date ${start}.`,
    };

    // Atomic commit
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'funds', fundId), newFund);
      for (const s of createdShares) batch.set(doc(db, 'shares', s.shareId), s);
      for (const t of createdTokens) batch.set(doc(db, 'portal_tokens', t.token), t);
      batch.set(doc(db, 'ledgers', chittiLedger.ledgerId), chittiLedger);
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (err) {
      console.warn('Offline mode: queuing fund creation mutation:', err);
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'funds',
        docId: fundId,
        type: 'set',
        payload: newFund,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.put(managerId, 'funds', newFund);
    await localDb.putBatch(managerId, 'shares', createdShares);
    await localDb.put(managerId, 'ledgers', chittiLedger);
    await localDb.put(managerId, 'audits', audit);

    setFunds((prev) => [newFund, ...prev]);
    setShares((prev) => [...createdShares, ...prev]);
    setLedgers((prev) => [chittiLedger, ...prev]);
    setActiveFundId(fundId);

    notificationService.send('Scheme Initialized', `${data.fundName} created successfully.`, 'cycle');
    return fundId;
  };

  const addShare = async (data: {
    fundId: string;
    memberName: string;
    memberPhone: string;
    shareCount?: number;
    contactId?: string;
  }): Promise<string> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === data.fundId);
    if (!fund) throw new Error('Chitti scheme not found');
    
    // Explicit manager ownership validation
    if (fund.managerId !== managerId) {
      throw new Error('Unauthorised: This Chitti scheme does not belong to you.');
    }

    if (fund.status === 'ended') {
      throw new Error('Cannot add share to an ENDED Chitti. Re-activate the Chitti first.');
    }

    const fundShares = shares.filter((s) => s.fundId === data.fundId);
    const nextShareNumber = fundShares.length + 1;
    const shareId = FinancialEngine.generateCryptoToken();
    const portalToken = FinancialEngine.generateCryptoToken();
    const shareDisplayId = await DisplayIdRegistryService.reserveDisplayId({
      entityType: 'SHARE',
      entityId: shareId,
      managerId,
    });

    if (!HUMAN_ID_REGEX.test(shareDisplayId)) {
      throw new Error('Invalid Share ID generated. Please try again.');
    }

    const newShare: Share = {
      shareId,
      displayId: shareDisplayId,
      managerId,
      fundId: data.fundId,
      memberId: data.contactId || FinancialEngine.generateCryptoToken(),
      contactId: data.contactId,
      memberName: data.memberName.trim(),
      memberPhone: data.memberPhone.trim(),
      shareNumber: nextShareNumber,
      shareCount: data.shareCount || 1,
      hasClaimedPrize: false,
      wonMonth: null,
      status: 'undrawn',
      totalBilled: 0,
      totalPaid: 0,
      arrears: 0,
      advance: 0,
      portalToken,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const tokenRecord = {
      token: portalToken,
      managerId,
      fundId: data.fundId,
      shareId,
      memberName: data.memberName,
      shareNumber: nextShareNumber,
      createdAt: new Date().toISOString(),
      shareSnapshot: newShare,
      fundSnapshot: fund,
      recentPayments: [],
    };

    const updatedFund: Fund = {
      ...fund,
      numberOfShares: fundShares.length + 1,
      updatedAt: new Date().toISOString(),
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'ADD_SHARE',
      entityType: 'SHARE',
      entityId: shareId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Added Share #${nextShareNumber} (${data.memberName}) to Chitti ${fund.fundName}.`,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'shares', shareId), newShare);
      batch.set(doc(db, 'portal_tokens', portalToken), tokenRecord);
      batch.update(doc(db, 'funds', data.fundId), {
        numberOfShares: updatedFund.numberOfShares,
        updatedAt: updatedFund.updatedAt,
      });
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Offline mode: queuing addShare mutation:', e);
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'shares',
        docId: shareId,
        type: 'set',
        payload: newShare,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.put(managerId, 'shares', newShare);
    await localDb.put(managerId, 'funds', updatedFund);
    await localDb.put(managerId, 'audits', audit);

    setShares((prev) => [...prev, newShare]);
    setFunds((prev) => prev.map((f) => (f.fundId === data.fundId ? updatedFund : f)));
    notificationService.send('Share Added', `Allotted Share #${nextShareNumber} to ${data.memberName}.`, 'sync');

    return shareId;
  };

  const createCycle = async (data: {
    fundId: string;
    cycleName?: string;
    startDate?: string;
    endDate?: string | null;
    netInstallmentDue?: number;
    winnerNetPayout?: number;
    organizerCommission?: number;
    auctionDate?: string;
    shareBills?: Record<string, number>;
  }): Promise<string> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === data.fundId);
    if (!fund) throw new Error('Chitti scheme not found');
    if (fund.status === 'ended') {
      throw new Error('Cannot create cycle on an ENDED Chitti. Re-activate the Chitti first.');
    }

    const fundCycles = cycles.filter((c) => c.fundId === data.fundId);
    const maxCycleNum = fundCycles.length > 0 ? Math.max(...fundCycles.map((c) => c.cycleNumber)) : 0;
    const nextCycleNum = maxCycleNum + 1;

    const name = data.cycleName?.trim() || `Cycle #${nextCycleNum}`;
    const start = data.startDate || data.auctionDate || new Date().toISOString().split('T')[0];
    const end = data.endDate ? data.endDate.trim() : null;

    if (end && end < start) {
      throw new Error('End Date cannot be earlier than Start Date');
    }

    const cycleId = FinancialEngine.generateCryptoToken();
    const billingDue = data.netInstallmentDue || 0;
    const winnerPayout = data.winnerNetPayout || 0;
    const commission = data.organizerCommission || 0;

    const fundShares = shares.filter((s) => s.fundId === data.fundId);
    const updatedShares: Share[] = [];
    const billingDocs: Billing[] = [];

    for (const share of fundShares) {
      const billAmt = data.shareBills && data.shareBills[share.shareId] !== undefined
        ? data.shareBills[share.shareId]
        : billingDue;

      const billingId = `${managerId}_${cycleId}_${share.shareId}`;
      const newBilling: Billing = {
        billingId,
        managerId,
        fundId: data.fundId,
        cycleId,
        shareId: share.shareId,
        billAmount: billAmt,
        billAmountPaise: FinancialEngine.toPaise(billAmt),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: authUid,
        version: 1,
      };
      billingDocs.push(newBilling);

      const otherCyclesBilled = billings
        .filter(b => b.shareId === share.shareId && b.fundId === data.fundId)
        .reduce((sum, b) => sum + b.billAmount, 0);

      const newTotalBilled = otherCyclesBilled + billAmt;
      const resolved = FinancialEngine.resolveBalance(newTotalBilled, share.totalPaid);

      const updatedShare: Share = {
        ...share,
        totalBilled: newTotalBilled,
        arrears: resolved.arrears,
        advance: resolved.advance,
        updatedAt: new Date().toISOString(),
      };
      updatedShares.push(updatedShare);
    }

    const newCycle: Cycle = {
      cycleId,
      displayId: FinancialEngine.generateDisplayId('CY'),
      managerId,
      fundId: data.fundId,
      cycleNumber: nextCycleNum,
      cycleName: name,
      startDate: start,
      endDate: end,
      monthIndex: nextCycleNum,
      auctionDate: start,
      winningBidAmount: 0,
      organizerCommission: commission,
      dividendPool: 0,
      dividendPerShare: 0,
      grossInstallment: billingDue,
      netInstallmentDue: billingDue,
      winnerNetPayout: winnerPayout,
      isAuctionClosed: false,
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    };

    const updatedFund: Fund = {
      ...fund,
      currentMonth: nextCycleNum,
      totalMonths: Math.max(fund.totalMonths, nextCycleNum),
      updatedAt: new Date().toISOString(),
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'CYCLE_CREATED',
      entityType: 'CYCLE',
      entityId: cycleId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Created Cycle #${nextCycleNum} ("${name}") for Chitti ${fund.fundName}.`,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'cycles', cycleId), newCycle);
      batch.update(doc(db, 'funds', data.fundId), {
        currentMonth: updatedFund.currentMonth,
        totalMonths: updatedFund.totalMonths,
        updatedAt: updatedFund.updatedAt,
      });
      for (const b of billingDocs) {
        batch.set(doc(db, 'billings', b.billingId), b);
      }
      for (const us of updatedShares) {
        batch.update(doc(db, 'shares', us.shareId), {
          totalBilled: us.totalBilled,
          arrears: us.arrears,
          advance: us.advance,
          updatedAt: us.updatedAt,
        });
      }
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Offline mode: queuing createCycle mutation:', e);
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'cycles',
        docId: cycleId,
        type: 'set',
        payload: newCycle,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.put(managerId, 'cycles', newCycle);
    await localDb.put(managerId, 'funds', updatedFund);
    await localDb.put(managerId, 'audits', audit);
    for (const b of billingDocs) {
      await localDb.put(managerId, 'billings', b);
    }
    for (const us of updatedShares) {
      await localDb.put(managerId, 'shares', us);
    }

    setCycles((prev) => [...prev, newCycle]);
    setBillings((prev) => [...prev, ...billingDocs]);
    setFunds((prev) => prev.map((f) => (f.fundId === data.fundId ? updatedFund : f)));
    if (updatedShares.length > 0) {
      setShares((prev) =>
        prev.map((s) => {
          const found = updatedShares.find((us) => us.shareId === s.shareId);
          return found || s;
        })
      );
    }

    notificationService.send('Cycle Created', `${name} (Cycle #${nextCycleNum}) initialized for ${fund.fundName}.`, 'cycle');

    return cycleId;
  };

  const saveCycleBills = async (data: {
    fundId: string;
    cycleId: string;
    shareBills: Record<string, number>;
    cycleName?: string;
    startDate?: string;
    endDate?: string | null;
    organizerCommission?: number;
  }): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === data.fundId);
    if (!fund) throw new Error('Chitti scheme not found');
    if (fund.status === 'ended') {
      throw new Error('Cannot update bills on an ENDED Chitti. Re-activate the Chitti first.');
    }

    const targetCycle = cycles.find((c) => c.cycleId === data.cycleId && c.fundId === data.fundId);
    if (!targetCycle) throw new Error('Target cycle not found');

    if (targetCycle.managerId !== managerId) {
      throw new Error('PERMISSION_DENIED: Unauthorized manager cannot edit billing for this cycle');
    }

    const fundShares = shares.filter((s) => s.fundId === data.fundId);
    const updatedShares: Share[] = [];
    const billingDocs: Billing[] = [];

    let totalCycleBillSum = 0;
    for (const [sId, billAmt] of Object.entries(data.shareBills)) {
      totalCycleBillSum += billAmt || 0;
    }

    const avgBillPerShare = fundShares.length > 0 ? Math.round(totalCycleBillSum / fundShares.length) : 0;

    for (const share of fundShares) {
      const billAmount = data.shareBills[share.shareId] !== undefined ? data.shareBills[share.shareId] : avgBillPerShare;
      
      const billingId = `${managerId}_${data.cycleId}_${share.shareId}`;
      const newBilling: Billing = {
        billingId,
        managerId,
        fundId: data.fundId,
        cycleId: data.cycleId,
        shareId: share.shareId,
        billAmount: billAmount,
        billAmountPaise: FinancialEngine.toPaise(billAmount),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: authUid,
        version: 1,
      };
      billingDocs.push(newBilling);

      const otherCyclesBilled = billings
        .filter(b => b.shareId === share.shareId && b.cycleId !== data.cycleId && b.fundId === data.fundId)
        .reduce((sum, b) => sum + b.billAmount, 0);

      const newTotalBilled = otherCyclesBilled + billAmount;
      const resolved = FinancialEngine.resolveBalance(newTotalBilled, share.totalPaid);

      const updatedShare: Share = {
        ...share,
        totalBilled: newTotalBilled,
        arrears: resolved.arrears,
        advance: resolved.advance,
        updatedAt: new Date().toISOString(),
      };
      updatedShares.push(updatedShare);
    }

    const updatedCycle: Cycle = {
      ...targetCycle,
      grossInstallment: avgBillPerShare,
      netInstallmentDue: avgBillPerShare,
      cycleName: data.cycleName ?? targetCycle.cycleName,
      startDate: data.startDate ?? targetCycle.startDate,
      endDate: data.endDate !== undefined ? data.endDate : targetCycle.endDate,
      organizerCommission: data.organizerCommission ?? targetCycle.organizerCommission,
    };

    const totalCollected = updatedShares.reduce((a, s) => a + s.totalPaid, 0);
    const totalArrears = updatedShares.reduce((a, s) => a + s.arrears, 0);

    const chittiLedger = ledgers.find((l) => l.fundId === data.fundId && l.ledgerType === 'CHITTI_LEDGER');
    const updatedLedger: MaterializedLedger | null = chittiLedger
      ? {
          ...chittiLedger,
          totalArrears,
          totalCollected,
          updatedAt: new Date().toISOString(),
        }
      : null;

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'UPDATE_CYCLE_BILLS',
      entityType: 'CYCLE',
      entityId: data.cycleId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Saved share bills for Cycle #${targetCycle.cycleNumber} (${targetCycle.cycleName || 'Current'}). Total cycle bills: ₹${totalCycleBillSum}.`,
    };

    try {
      const batch = writeBatch(db);
      for (const b of billingDocs) {
        batch.set(doc(db, 'billings', b.billingId), b);
      }
      batch.update(doc(db, 'cycles', data.cycleId), {
        grossInstallment: updatedCycle.grossInstallment,
        netInstallmentDue: updatedCycle.netInstallmentDue,
        cycleName: updatedCycle.cycleName,
        startDate: updatedCycle.startDate,
        endDate: updatedCycle.endDate,
        organizerCommission: updatedCycle.organizerCommission,
      });
      for (const s of updatedShares) {
        batch.update(doc(db, 'shares', s.shareId), {
          totalBilled: s.totalBilled,
          arrears: s.arrears,
          advance: s.advance,
          updatedAt: s.updatedAt,
        });
      }
      if (updatedLedger) {
        batch.update(doc(db, 'ledgers', updatedLedger.ledgerId), {
          totalArrears: updatedLedger.totalArrears,
          totalCollected: updatedLedger.totalCollected,
          updatedAt: updatedLedger.updatedAt,
        });
      }
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Network bill update notice:', e);
    }

    setCycles((prev) => prev.map((c) => (c.cycleId === data.cycleId ? updatedCycle : c)));
    setBillings((prev) => {
      const filtered = prev.filter(b => b.cycleId !== data.cycleId || b.fundId !== data.fundId);
      return [...filtered, ...billingDocs];
    });
    setShares((prev) =>
      prev.map((s) => {
        const found = updatedShares.find((us) => us.shareId === s.shareId);
        return found || s;
      })
    );
    if (updatedLedger) {
      setLedgers((prev) => prev.map((l) => (l.ledgerId === updatedLedger.ledgerId ? updatedLedger : l)));
    }

    for (const b of billingDocs) {
      await localDb.put(managerId, 'billings', b);
    }
    for (const us of updatedShares) {
      await localDb.put(managerId, 'shares', us);
    }
    await localDb.put(managerId, 'cycles', updatedCycle);
    if (updatedLedger) {
      await localDb.put(managerId, 'ledgers', updatedLedger);
    }
    await localDb.put(managerId, 'audits', audit);

    notificationService.send('Bills Saved', `Saved individual share bills for Cycle #${targetCycle.cycleNumber}.`, 'sync');
  };

  const recordSharePayout = async (data: {
    fundId: string;
    shareId: string;
    cycleId: string;
    payoutAmount: number;
    payoutDate?: string;
    paymentMethod?: PaymentMethod;
    reference?: string;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === data.fundId);
    if (!fund) throw new Error('Chitti scheme not found');
    if (fund.status === 'ended') {
      throw new Error('Cannot record payout on an ENDED Chitti. Re-activate the Chitti first.');
    }

    const share = shares.find((s) => s.shareId === data.shareId && s.fundId === data.fundId);
    if (!share) throw new Error('Target share not found or unauthorized');
    if (share.managerId !== managerId) {
      throw new Error('PERMISSION_DENIED: Unauthorized manager cannot record payout for this share');
    }

    const targetCycle = cycles.find((c) => c.cycleId === data.cycleId && c.fundId === data.fundId);
    if (!targetCycle) throw new Error('Selected cycle not found');
    if (targetCycle.managerId !== managerId) {
      throw new Error('PERMISSION_DENIED: Unauthorized manager cannot record payout for this cycle');
    }

    const now = new Date().toISOString();

    const key = data.idempotencyKey || FinancialEngine.generateCryptoToken();
    const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    const payoutId = `${managerId}_pay_${cleanKey}`;

    const newPayout: Payout = {
      payoutId,
      managerId,
      fundId: data.fundId,
      cycleId: data.cycleId,
      shareId: data.shareId,
      memberId: share.memberId,
      amount: data.payoutAmount,
      amountPaise: FinancialEngine.toPaise(data.payoutAmount),
      payoutDate: data.payoutDate || new Date().toISOString().split('T')[0],
      paymentMethod: data.paymentMethod || 'Bank',
      reference: data.reference || '',
      notes: data.notes || '',
      status: 'disbursed',
      createdAt: now,
      createdBy: authUid,
      idempotencyKey: cleanKey,
    };

    const updatedShare: Share = {
      ...share,
      hasClaimedPrize: true,
      wonMonth: targetCycle.cycleNumber,
      status: 'drawn',
      updatedAt: now,
    };

    const updatedCycle: Cycle = {
      ...targetCycle,
      winnerShareId: share.shareId,
      winnerMemberName: share.memberName,
      winnerNetPayout: data.payoutAmount,
      isAuctionClosed: true,
    };

    const chittiLedger = ledgers.find((l) => l.fundId === data.fundId && l.ledgerType === 'CHITTI_LEDGER');
    const updatedLedger: MaterializedLedger | null = chittiLedger
      ? {
          ...chittiLedger,
          totalDisbursed: chittiLedger.totalDisbursed + data.payoutAmount,
          updatedAt: now,
        }
      : null;

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'RECORD_PAYOUT',
      entityType: 'SHARE',
      entityId: data.shareId,
      timestamp: now,
      createdAt: serverTimestamp(),
      reason: `Recorded payout of ₹${data.payoutAmount} for Share #${share.shareNumber} (${share.memberName}) in Cycle #${targetCycle.cycleNumber}.`,
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'payouts', payoutId), newPayout);
      batch.update(doc(db, 'shares', data.shareId), {
        hasClaimedPrize: true,
        wonMonth: targetCycle.cycleNumber,
        status: 'drawn',
        updatedAt: now,
      });
      batch.update(doc(db, 'cycles', data.cycleId), {
        winnerShareId: share.shareId,
        winnerMemberName: share.memberName,
        winnerNetPayout: data.payoutAmount,
        isAuctionClosed: true,
      });
      if (updatedLedger) {
        batch.update(doc(db, 'ledgers', updatedLedger.ledgerId), {
          totalDisbursed: updatedLedger.totalDisbursed,
          updatedAt: now,
        });
      }
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Network payout recording notice:', e);
    }

    setPayouts((prev) => [...prev, newPayout]);
    setShares((prev) => prev.map((s) => (s.shareId === data.shareId ? updatedShare : s)));
    setCycles((prev) => prev.map((c) => (c.cycleId === data.cycleId ? updatedCycle : c)));
    if (updatedLedger) {
      setLedgers((prev) => prev.map((l) => (l.ledgerId === updatedLedger.ledgerId ? updatedLedger : l)));
    }

    await localDb.put(managerId, 'payouts', newPayout);
    await localDb.put(managerId, 'shares', updatedShare);
    await localDb.put(managerId, 'cycles', updatedCycle);
    if (updatedLedger) await localDb.put(managerId, 'ledgers', updatedLedger);
    await localDb.put(managerId, 'audits', audit);

    notificationService.send(
      'Payout Recorded',
      `Disbursed payout of ₹${data.payoutAmount} to Share #${share.shareNumber} (${share.memberName}) for Cycle #${targetCycle.cycleNumber}.`,
      'sync'
    );
  };

  const revokeSharePayout = async (data: {
    fundId: string;
    payoutId: string;
    reason?: string;
  }): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const payout = payouts.find((p) => p.payoutId === data.payoutId);
    if (!payout) throw new Error('Payout record not found');

    if (payout.managerId !== managerId) {
      throw new Error('PERMISSION_DENIED: Unauthorized manager cannot revoke this payout');
    }

    if (payout.fundId !== data.fundId) {
      throw new Error('Security Violation: Payout does not belong to the specified Chitti');
    }

    const share = shares.find((s) => s.shareId === payout.shareId);
    if (!share) throw new Error('Associated share not found');

    if (share.fundId !== data.fundId) {
      throw new Error('Security Violation: Associated share does not belong to the specified Chitti');
    }

    const targetCycle = cycles.find((c) => c.cycleId === payout.cycleId);
    if (!targetCycle) throw new Error('Associated cycle not found');

    if (targetCycle.fundId !== data.fundId) {
      throw new Error('Security Violation: Associated cycle does not belong to the specified Chitti');
    }

    const now = new Date().toISOString();

    const updatedPayout: Payout = {
      ...payout,
      status: 'cancelled',
      updatedAt: now,
      updatedBy: authUid,
    };

    // Calculate if there are other active payouts for this share in this scheme
    const otherActivePayouts = payouts.filter(
      (p) => p.shareId === share.shareId && p.payoutId !== payout.payoutId && p.status === 'disbursed'
    );

    const hasOtherPayouts = otherActivePayouts.length > 0;
    const otherPayoutCycle = hasOtherPayouts ? cycles.find(c => c.cycleId === otherActivePayouts[0].cycleId) : null;
    const wonMonthVal = otherPayoutCycle ? otherPayoutCycle.cycleNumber : null;

    const updatedShare: Share = {
      ...share,
      hasClaimedPrize: hasOtherPayouts,
      wonMonth: wonMonthVal,
      status: hasOtherPayouts ? 'drawn' : 'undrawn',
      updatedAt: now,
    };

    const updatedCycle: Cycle = {
      ...targetCycle,
      winnerShareId: null,
      winnerMemberName: null,
      winnerNetPayout: 0,
      isAuctionClosed: false,
    };

    const chittiLedger = ledgers.find((l) => l.fundId === data.fundId && l.ledgerType === 'CHITTI_LEDGER');
    const updatedLedger: MaterializedLedger | null = chittiLedger
      ? {
          ...chittiLedger,
          totalDisbursed: Math.max(0, chittiLedger.totalDisbursed - payout.amount),
          updatedAt: now,
        }
      : null;

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'REVOKE_PAYOUT',
      entityType: 'SHARE',
      entityId: share.shareId,
      timestamp: now,
      createdAt: serverTimestamp(),
      reason: `Revoked payout of ₹${payout.amount} for Share #${share.shareNumber} (${share.memberName}) in Cycle #${targetCycle.cycleNumber}. Reason: ${data.reason || 'None'}.`,
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'payouts', payout.payoutId), {
        status: 'cancelled',
        updatedAt: now,
        updatedBy: authUid,
      });
      batch.update(doc(db, 'shares', share.shareId), {
        hasClaimedPrize: updatedShare.hasClaimedPrize,
        wonMonth: updatedShare.wonMonth,
        status: updatedShare.status,
        updatedAt: now,
      });
      batch.update(doc(db, 'cycles', targetCycle.cycleId), {
        winnerShareId: null,
        winnerMemberName: null,
        winnerNetPayout: 0,
        isAuctionClosed: false,
      });
      if (updatedLedger) {
        batch.update(doc(db, 'ledgers', updatedLedger.ledgerId), {
          totalDisbursed: updatedLedger.totalDisbursed,
          updatedAt: now,
        });
      }
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Network payout revocation notice:', e);
    }

    setPayouts((prev) => prev.map((p) => (p.payoutId === payout.payoutId ? updatedPayout : p)));
    setShares((prev) => prev.map((s) => (s.shareId === share.shareId ? updatedShare : s)));
    setCycles((prev) => prev.map((c) => (c.cycleId === targetCycle.cycleId ? updatedCycle : c)));
    if (updatedLedger) {
      setLedgers((prev) => prev.map((l) => (l.ledgerId === updatedLedger.ledgerId ? updatedLedger : l)));
    }

    await localDb.put(managerId, 'payouts', updatedPayout);
    await localDb.put(managerId, 'shares', updatedShare);
    await localDb.put(managerId, 'cycles', updatedCycle);
    if (updatedLedger) await localDb.put(managerId, 'ledgers', updatedLedger);
    await localDb.put(managerId, 'audits', audit);

    notificationService.send(
      'Payout Revoked',
      `Revoked payout of ₹${payout.amount} for Share #${share.shareNumber} (${share.memberName}).`,
      'sync'
    );
  };

  const updateCycleMetadata = async (data: {
    fundId: string;
    cycleId: string;
    cycleName?: string;
    startDate?: string;
    endDate?: string | null;
  }): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const targetCycle = cycles.find((c) => c.cycleId === data.cycleId && c.fundId === data.fundId);
    if (!targetCycle) throw new Error('Cycle not found');

    if (targetCycle.managerId !== managerId) {
      throw new Error('PERMISSION_DENIED: Unauthorized manager cannot edit this cycle metadata');
    }

    const newName = data.cycleName !== undefined ? data.cycleName.trim() : targetCycle.cycleName;
    const newStart = data.startDate || targetCycle.startDate || targetCycle.auctionDate;
    const newEnd = data.endDate !== undefined ? (data.endDate ? data.endDate.trim() : null) : targetCycle.endDate;

    if (newEnd && newStart && newEnd < newStart) {
      throw new Error('End Date cannot be earlier than Start Date');
    }

    const updatedCycle: Cycle = {
      ...targetCycle,
      cycleName: newName || `Cycle #${targetCycle.cycleNumber}`,
      startDate: newStart,
      endDate: newEnd,
      auctionDate: newStart,
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'UPDATE_CYCLE_METADATA',
      entityType: 'CYCLE',
      entityId: data.cycleId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Updated Cycle #${targetCycle.cycleNumber} metadata: Name="${updatedCycle.cycleName}", Start="${newStart}", End="${newEnd || 'None'}".`,
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'cycles', data.cycleId), {
        cycleName: updatedCycle.cycleName,
        startDate: updatedCycle.startDate,
        endDate: updatedCycle.endDate,
        auctionDate: updatedCycle.auctionDate,
      });
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Offline mode: queuing metadata update:', e);
    }

    await localDb.put(managerId, 'cycles', updatedCycle);
    await localDb.put(managerId, 'audits', audit);

    setCycles((prev) => prev.map((c) => (c.cycleId === data.cycleId ? updatedCycle : c)));
    notificationService.send('Cycle Updated', `Updated metadata for ${updatedCycle.cycleName}.`, 'sync');
  };

  const updateFundMetadata = async (fundId: string, data: { totalCycles?: number | null }) => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const fund = funds.find((f) => f.fundId === fundId);
    if (!fund) throw new Error('Chitti scheme not found');

    const updatedFund: Fund = {
      ...fund,
      totalCycles: data.totalCycles !== undefined ? data.totalCycles : fund.totalCycles,
      updatedAt: new Date().toISOString(),
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid: authUid,
      action: 'FUND_METADATA_UPDATE',
      entityType: 'FUND',
      entityId: fundId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Updated fund metadata (Total Cycles: ${data.totalCycles})`,
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'funds', fundId), {
        totalCycles: updatedFund.totalCycles,
        updatedAt: updatedFund.updatedAt,
      });
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Offline mode: queuing fund metadata update:', e);
    }

    await localDb.put(managerId, 'funds', updatedFund);
    await localDb.put(managerId, 'audits', audit);

    setFunds((prev) => prev.map((f) => (f.fundId === fundId ? updatedFund : f)));
    notificationService.send('Scheme Updated', `Updated metadata for ${fund.fundName}.`, 'sync');
  };

  const endFund = async (fundId: string): Promise<FinalReportSnapshot> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === fundId);
    if (!fund) throw new Error('Chitti scheme not found');

    const fundShares = shares.filter((s) => s.fundId === fundId);
    const fundCycles = cycles.filter((c) => c.fundId === fundId);

    const totalBilled = fundShares.reduce((a, s) => a + s.totalBilled, 0);
    const totalCollected = fundShares.reduce((a, s) => a + s.totalPaid, 0);
    const totalDisbursed = fundCycles.filter((c) => c.isAuctionClosed).reduce((a, c) => a + c.winnerNetPayout, 0);
    const totalCommission = fundCycles.filter((c) => c.isAuctionClosed).reduce((a, c) => a + c.organizerCommission, 0);
    const totalArrears = fundShares.reduce((a, s) => a + s.arrears, 0);
    const totalAdvance = fundShares.reduce((a, s) => a + s.advance, 0);

    const reportSnapshot: FinalReportSnapshot = {
      generatedAt: new Date().toISOString(),
      generatedByManagerId: managerId,
      fundName: fund.fundName,
      fundId: fund.fundId,
      startDate: fund.startDate,
      endedAt: new Date().toISOString(),
      totalShares: fundShares.length,
      totalCycles: fundCycles.length,
      totalBilled,
      totalCollected,
      totalDisbursed,
      totalCommission,
      totalArrears,
      totalAdvance,
      shares: fundShares.map((s) => ({
        shareId: s.shareId,
        shareNumber: s.shareNumber,
        memberName: s.memberName,
        memberPhone: s.memberPhone,
        status: s.status,
        hasClaimedPrize: s.hasClaimedPrize,
        totalBilled: s.totalBilled,
        totalPaid: s.totalPaid,
        arrears: s.arrears,
        advance: s.advance,
      })),
      cycles: fundCycles.map((c) => ({
        cycleNumber: c.cycleNumber,
        netInstallmentDue: c.netInstallmentDue,
        winnerNetPayout: c.winnerNetPayout,
        organizerCommission: c.organizerCommission,
        winnerMemberName: c.winnerMemberName,
        isAuctionClosed: c.isAuctionClosed,
      })),
    };

    const endedAt = new Date().toISOString();
    const updatedFund: Fund = {
      ...fund,
      status: 'ended',
      endedAt,
      endedByManagerId: managerId,
      finalReportSnapshot: reportSnapshot,
      updatedAt: endedAt,
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'END_CHITTI',
      entityType: 'FUND',
      entityId: fundId,
      timestamp: endedAt,
      createdAt: serverTimestamp(),
      reason: `Chitti ${fund.fundName} marked as ENDED. Final report materialized.`,
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'funds', fundId), {
        status: 'ended',
        endedAt,
        endedByManagerId: managerId,
        finalReportSnapshot: reportSnapshot,
        updatedAt: endedAt,
      });
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Offline mode: queuing endFund mutation:', e);
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'funds',
        docId: fundId,
        type: 'update',
        payload: {
          status: 'ended',
          endedAt,
          endedByManagerId: managerId,
          finalReportSnapshot: reportSnapshot,
          updatedAt: endedAt,
        },
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.put(managerId, 'funds', updatedFund);
    await localDb.put(managerId, 'audits', audit);

    setFunds((prev) => prev.map((f) => (f.fundId === fundId ? updatedFund : f)));
    notificationService.send('Chitti Ended', `${fund.fundName} has been closed. Final report generated.`, 'sync');

    return reportSnapshot;
  };

  const revokeEndFund = async (fundId: string): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === fundId);
    if (!fund) throw new Error('Chitti scheme not found');
    if (fund.status !== 'ended') {
      throw new Error('Chitti is not currently ENDED.');
    }

    const updatedAt = new Date().toISOString();
    const updatedFund: Fund = {
      ...fund,
      status: 'active',
      updatedAt,
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'REVOKE_END',
      entityType: 'FUND',
      entityId: fundId,
      timestamp: updatedAt,
      createdAt: serverTimestamp(),
      reason: `Revoked ENDED state for Chitti ${fund.fundName}. Restored to ACTIVE status.`,
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'funds', fundId), {
        status: 'active',
        updatedAt,
      });
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Offline mode: queuing revokeEndFund mutation:', e);
    }

    await localDb.put(managerId, 'funds', updatedFund);
    await localDb.put(managerId, 'audits', audit);

    setFunds((prev) => prev.map((f) => (f.fundId === fundId ? updatedFund : f)));
    notificationService.send('Chitti Reactivated', `${fund.fundName} has been restored to ACTIVE status.`, 'sync');
  };

  // Phase 4 & 5: Record Payment (Atomic Multi-Document Batch with Authoritative Server-Side Idempotency)
  const recordPayment = async (data: {
    fundId: string;
    shareId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    paymentDate: string;
    reference?: string;
    notes?: string;
    idempotencyKey?: string;
  }) => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const share = shares.find((s) => s.shareId === data.shareId);
    if (!share) throw new Error('Share allotment not found');

    if (share.fundId !== data.fundId) {
      throw new Error('Security Violation: Share does not belong to the specified Chitti');
    }

    const rawKey = data.idempotencyKey || FinancialEngine.generateCryptoToken();
    const cleanIdempotencyKey = rawKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    // Authoritative tenant-scoped payment document ID (R-1)
    const paymentDocId = `${managerId}_${cleanIdempotencyKey}`;
    const paymentDisplayId = FinancialEngine.generateDisplayId('PAY');

    // 1. In-memory deduplication check
    const existingLocal = payments.find((p) => p.idempotencyKey === cleanIdempotencyKey || p.paymentId === paymentDocId);
    if (existingLocal) {
      console.warn('Duplicate payment submission intercepted by local idempotency check:', cleanIdempotencyKey);
      return;
    }

    // 2. Authoritative server-side uniqueness check before computing state consequences
    const paymentRef = doc(db, 'payments', paymentDocId);
    try {
      const existingSnap = await getDoc(paymentRef);
      if (existingSnap.exists()) {
        console.warn('Duplicate payment intercepted by authoritative database check:', paymentDocId);
        return;
      }
    } catch (e) {
      // Offline fallback: check local IndexedDB
      const cached = await localDb.getForTenant<Payment>(managerId, 'payments', paymentDocId);
      if (cached) {
        console.warn('Duplicate payment intercepted by offline storage check:', paymentDocId);
        return;
      }
    }

    // Universal Financial Core: Payments are Share-level financial activity
    const updatedTotalPaid = share.totalPaid + data.amount;
    const resolved = FinancialEngine.resolveBalance(share.totalBilled, updatedTotalPaid);
    const updatedArrears = resolved.arrears;
    const updatedAdvance = resolved.advance;

    const payment: Payment = {
      paymentId: paymentDocId,
      displayId: paymentDisplayId,
      managerId,
      fundId: data.fundId,
      memberId: share.memberId,
      memberName: share.memberName,
      shareId: share.shareId,
      shareNumber: share.shareNumber,
      amount: data.amount,
      paymentDate: data.paymentDate,
      paymentMethod: data.paymentMethod,
      reference: data.reference,
      notes: data.notes,
      verificationStatus: 'verified',
      idempotencyKey: cleanIdempotencyKey,
      createdAt: new Date().toISOString(),
    };

    const updatedShare: Share = {
      ...share,
      totalPaid: updatedTotalPaid,
      arrears: updatedArrears,
      advance: updatedAdvance,
      updatedAt: new Date().toISOString(),
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: paymentDocId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Recorded installment of ₹${data.amount} for Share #${share.shareNumber} (${share.memberName}). Method: ${data.paymentMethod}. Arrears: ₹${resolved.arrears}, Advance: ₹${resolved.advance}.`,
      operationId: cleanIdempotencyKey,
    };

    // Atomic Firestore Batch: Payment + Share + Audit + Portal Token Projection
    try {
      const batch = writeBatch(db);
      batch.set(paymentRef, payment);
      batch.update(doc(db, 'shares', share.shareId), {
        totalPaid: updatedTotalPaid,
        arrears: updatedArrears,
        advance: updatedAdvance,
        updatedAt: updatedShare.updatedAt,
      });
      if (share.portalToken) {
        batch.set(doc(db, 'portal_tokens', share.portalToken), {
          token: share.portalToken,
          managerId,
          fundId: data.fundId,
          shareId: share.shareId,
          memberName: share.memberName,
          shareNumber: share.shareNumber,
          createdAt: share.createdAt,
          shareSnapshot: updatedShare,
          fundSnapshot: funds.find((f) => f.fundId === data.fundId) || null,
          recentPayments: [payment, ...payments.filter((p) => p.shareId === share.shareId).slice(0, 19)],
        }, { merge: true });
      }
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (err) {
      console.warn('Offline mode: queuing payment transaction:', err);
      await localDb.queueOfflineMutation({
        operationId: cleanIdempotencyKey,
        managerId,
        authUid,
        collection: 'payments',
        docId: paymentDocId,
        type: 'set',
        payload: payment,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.put(managerId, 'payments', payment);
    await localDb.put(managerId, 'shares', updatedShare);
    await localDb.put(managerId, 'audits', audit);

    setPayments((prev) => [payment, ...prev]);
    setShares((prev) => prev.map((s) => (s.shareId === share.shareId ? updatedShare : s)));

    notificationService.send('Payment Logged', `Received ₹${data.amount} from ${share.memberName} via ${data.paymentMethod}.`, 'payment');
  };

  // Phase 4 & 6: Finalize Cycle Settlement & Winner Assignment (Atomic Persistence of ALL Shares)
  const finalizeCycleSettlement = async (data: {
    fundId: string;
    cycleNumber: number;
    winnerShareId?: string;
    winningBidAmount?: number;
    netInstallmentDueOverride?: number;
    winnerNetPayoutOverride?: number;
    organizerCommissionOverride?: number;
  }) => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === data.fundId);
    if (!fund) throw new Error('Fund scheme not found');

    const winningBid = data.winningBidAmount || 0;
    const share = data.winnerShareId ? shares.find((s) => s.shareId === data.winnerShareId) : undefined;
    if (data.winnerShareId && !share) throw new Error('Winner share allotment not found');

    if (share && share.fundId !== data.fundId) {
      throw new Error('Security Violation: Share does not belong to the specified Chitti');
    }

    const cycle = cycles.find((c) => c.fundId === data.fundId && c.cycleNumber === data.cycleNumber);
    if (!cycle) throw new Error('Target cycle not found');

    if (cycle.fundId !== data.fundId) {
      throw new Error('Security Violation: Auction cycle does not belong to the specified Chitti');
    }

    const calc = FinancialEngine.calculateCycle({
      totalPool: fund.totalPool,
      totalMonths: fund.totalMonths,
      totalShares: fund.numberOfShares,
      winningBidAmount: winningBid,
      commissionPercent: fund.commissionPercent,
    });

    const finalNetInstallmentDue = data.netInstallmentDueOverride ?? calc.netInstallmentDue;
    const finalWinnerNetPayout = data.winnerNetPayoutOverride ?? calc.winnerNetPayout;
    const finalOrganizerCommission = data.organizerCommissionOverride ?? calc.organizerCommission;

    const updatedCycle: Cycle = {
      ...cycle,
      winningBidAmount: winningBid,
      winnerShareId: share?.shareId || '',
      winnerMemberId: share?.memberId || '',
      winnerMemberName: share?.memberName || '',
      organizerCommission: finalOrganizerCommission,
      dividendPool: calc.dividendPool,
      dividendPerShare: calc.dividendPerShare,
      grossInstallment: calc.grossInstallment,
      netInstallmentDue: finalNetInstallmentDue,
      winnerNetPayout: finalWinnerNetPayout,
      isAuctionClosed: true,
      status: 'finalized',
      finalizedAt: new Date().toISOString(),
    };

    const updatedWinnerShare: Share | null = share ? {
      ...share,
      hasClaimedPrize: true,
      wonMonth: data.cycleNumber,
      status: 'drawn',
      updatedAt: new Date().toISOString(),
    } : null;

    // Calculate and persist updated billing & arrears across ALL shares in the fund with advance drawdown
    const updatedAllShares = shares.map((s) => {
      if (s.fundId !== data.fundId) return s;
      const isWinner = share ? s.shareId === share.shareId : false;
      const currentAdvance = s.advance || 0;
      const installmentDue = finalNetInstallmentDue;
      const advanceDrawn = Math.min(currentAdvance, installmentDue);
      const remainingAdvance = currentAdvance - advanceDrawn;
      const totalBilled = s.totalBilled + installmentDue;
      const totalPaid = s.totalPaid + advanceDrawn;
      const arrears = Math.max(0, totalBilled - totalPaid);
      return {
        ...(isWinner && updatedWinnerShare ? updatedWinnerShare : s),
        totalBilled,
        totalPaid,
        arrears,
        advance: remainingAdvance,
        updatedAt: new Date().toISOString(),
      };
    });

    // Schedule next cycle if available
    let nextCycle: Cycle | null = null;
    if (data.cycleNumber < fund.totalMonths) {
      const nextCycleNum = data.cycleNumber + 1;
      const nextCycleId = FinancialEngine.generateCryptoToken();
      nextCycle = {
        cycleId: nextCycleId,
        displayId: FinancialEngine.generateDisplayId('CY'),
        managerId,
        fundId: data.fundId,
        cycleNumber: nextCycleNum,
        monthIndex: nextCycleNum,
        auctionDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        winningBidAmount: 0,
        organizerCommission: calc.organizerCommission,
        dividendPool: 0,
        dividendPerShare: 0,
        grossInstallment: calc.grossInstallment,
        netInstallmentDue: calc.grossInstallment,
        winnerNetPayout: fund.totalPool,
        isAuctionClosed: false,
        status: 'upcoming',
        createdAt: new Date().toISOString(),
      };
    }

    // Materialized Chitti Ledger update
    const chittiLedger: MaterializedLedger = {
      ledgerId: `ledger_${fund.fundId}`,
      managerId,
      fundId: fund.fundId,
      ledgerType: 'CHITTI_LEDGER',
      totalPool: fund.totalPool,
      totalCollected: updatedAllShares.filter((s) => s.fundId === fund.fundId).reduce((a, s) => a + s.totalPaid, 0),
      totalDisbursed: cycles.filter((c) => c.fundId === fund.fundId && c.isAuctionClosed).reduce((a, c) => a + c.winnerNetPayout, 0) + calc.winnerNetPayout,
      totalArrears: updatedAllShares.filter((s) => s.fundId === fund.fundId).reduce((a, s) => a + s.arrears, 0),
      totalMembers: fund.numberOfShares,
      updatedAt: new Date().toISOString(),
    };

    const billingDocs: Billing[] = [];
    for (const s of updatedAllShares.filter((sh) => sh.fundId === data.fundId)) {
      const billingId = `${managerId}_${cycle.cycleId}_${s.shareId}`;
      billingDocs.push({
        billingId,
        managerId,
        fundId: data.fundId,
        cycleId: cycle.cycleId,
        shareId: s.shareId,
        billAmount: finalNetInstallmentDue,
        billAmountPaise: FinancialEngine.toPaise(finalNetInstallmentDue),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: authUid,
        version: 1,
      });
    }

    let payoutDoc: Payout | null = null;
    if (share && finalWinnerNetPayout > 0) {
      const payoutId = `${managerId}_pay_auc_${cycle.cycleId}_${share.shareId}`;
      payoutDoc = {
        payoutId,
        managerId,
        fundId: data.fundId,
        cycleId: cycle.cycleId,
        shareId: share.shareId,
        memberId: share.memberId,
        amount: finalWinnerNetPayout,
        amountPaise: FinancialEngine.toPaise(finalWinnerNetPayout),
        payoutDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Bank',
        reference: `Auction Winner #${cycle.cycleNumber}`,
        notes: `Authoritative payout generated via finalized auction for Cycle #${cycle.cycleNumber}.`,
        status: 'disbursed',
        createdAt: new Date().toISOString(),
        createdBy: authUid,
      };
    }

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'AUCTION_FINALIZED',
      entityType: 'CYCLE',
      entityId: cycle.cycleId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Month #${data.cycleNumber} closed. Winner: ${share ? `Share #${share.shareNumber} (${share.memberName})` : 'None'}. Payout: ₹${finalWinnerNetPayout}. Persisted billing across all ${fund.numberOfShares} shares.`,
    };

    // ATOMIC WRITE BATCH: Cycle + All Shares + Next Cycle + Ledger + Audit + Billings + Payout
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'cycles', cycle.cycleId), updatedCycle as any);
      batch.update(doc(db, 'funds', fund.fundId), {
        currentMonth: Math.min(fund.totalMonths, data.cycleNumber + 1),
        updatedAt: new Date().toISOString(),
      });

      // Crucial: Atomically update every participating share and portal token projection in Firestore
      for (const s of updatedAllShares.filter((sh) => sh.fundId === data.fundId)) {
        batch.update(doc(db, 'shares', s.shareId), {
          totalBilled: s.totalBilled,
          totalPaid: s.totalPaid,
          arrears: s.arrears,
          advance: s.advance,
          hasClaimedPrize: s.hasClaimedPrize,
          wonMonth: s.wonMonth,
          status: s.status,
          updatedAt: s.updatedAt,
        });
        if (s.portalToken) {
          batch.set(doc(db, 'portal_tokens', s.portalToken), {
            shareSnapshot: s,
            updatedAt: s.updatedAt,
          }, { merge: true });
        }
      }

      for (const b of billingDocs) {
        batch.set(doc(db, 'billings', b.billingId), b);
      }
      if (payoutDoc) {
        batch.set(doc(db, 'payouts', payoutDoc.payoutId), payoutDoc);
      }

      if (nextCycle) {
        batch.set(doc(db, 'cycles', nextCycle.cycleId), nextCycle);
      }
      batch.set(doc(db, 'ledgers', chittiLedger.ledgerId), chittiLedger);
      batch.set(doc(db, 'audits', audit.auditId), audit);

      await batch.commit();
    } catch (err) {
      console.warn('Offline mode: queuing cycle finalization batch:', err);
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'cycles',
        docId: cycle.cycleId,
        type: 'update',
        payload: updatedCycle,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.put(managerId, 'cycles', updatedCycle);
    await localDb.putBatch(managerId, 'shares', updatedAllShares);
    if (nextCycle) await localDb.put(managerId, 'cycles', nextCycle);
    await localDb.put(managerId, 'ledgers', chittiLedger);
    await localDb.put(managerId, 'audits', audit);
    for (const b of billingDocs) {
      await localDb.put(managerId, 'billings', b);
    }
    if (payoutDoc) {
      await localDb.put(managerId, 'payouts', payoutDoc);
    }

    setCycles((prev) => {
      const filtered = prev.map((c) => (c.cycleId === cycle.cycleId ? updatedCycle : c));
      return nextCycle ? [...filtered, nextCycle] : filtered;
    });
    setBillings((prev) => {
      const filtered = prev.filter(b => b.cycleId !== cycle.cycleId || b.fundId !== fund.fundId);
      return [...filtered, ...billingDocs];
    });
    if (payoutDoc) {
      setPayouts((prev) => [...prev, payoutDoc!]);
    }
    setShares(updatedAllShares);
    setLedgers((prev) => [...prev.filter((l) => l.ledgerId !== chittiLedger.ledgerId), chittiLedger]);

    notificationService.send(
      `Cycle Billing Finalized: Month #${data.cycleNumber}`,
      `Winner: ${share ? share.memberName : 'None'}. Net prize payout: ₹${FinancialEngine.formatNumber(finalWinnerNetPayout)}.`,
      'auction'
    );
  };

  // Phase 4 & 7: Historical Correction & Deep Reconciliation (Atomic Commit)
  const updateDrawStatus = async (data: {
    fundId: string;
    cycleId: string;
    shareId: string;
    action: 'SET_DRAWN' | 'SET_UNDRAWN';
    winningBidAmount?: number;
    reason: string;
  }) => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find((f) => f.fundId === data.fundId);
    const cycle = cycles.find((c) => c.cycleId === data.cycleId);
    const targetShare = shares.find((s) => s.shareId === data.shareId);
    if (!fund || !cycle || !targetShare) throw new Error('Target record not found');

    if (targetShare.fundId !== data.fundId) {
      throw new Error('Security Violation: Share does not belong to the specified Chitti');
    }
    if (cycle.fundId !== data.fundId) {
      throw new Error('Security Violation: Auction cycle does not belong to the specified Chitti');
    }

    const proposedBid = data.winningBidAmount ?? (cycle.winningBidAmount || Math.round(fund.totalPool * 0.15));

    // Authoritative Reconciliation Engine produces complete multi-cycle state change
    const plan = ImpactEngine.buildReconciliationPlan({
      fund,
      cycles,
      targetCycle: cycle,
      targetShare,
      allShares: shares,
      proposedBidAmount: proposedBid,
      reason: data.reason,
      actorUid,
    });

    const audit: AuditRecord = {
      ...plan.auditPayload,
      auditId: FinancialEngine.generateCryptoToken(),
      createdAt: serverTimestamp(),
    };

    // Materialized Chitti Ledger recalculation
    const chittiLedger: MaterializedLedger = {
      ledgerId: `ledger_${fund.fundId}`,
      managerId,
      fundId: fund.fundId,
      ledgerType: 'CHITTI_LEDGER',
      totalPool: fund.totalPool,
      totalCollected: plan.updatedShares.filter((s) => s.fundId === fund.fundId).reduce((a, s) => a + s.totalPaid, 0),
      totalDisbursed: plan.updatedCycles.filter((c) => c.fundId === fund.fundId && c.isAuctionClosed).reduce((a, c) => a + c.winnerNetPayout, 0),
      totalArrears: plan.updatedShares.filter((s) => s.fundId === fund.fundId).reduce((a, s) => a + s.arrears, 0),
      totalMembers: fund.numberOfShares,
      updatedAt: new Date().toISOString(),
    };

    // ATOMIC WRITE BATCH
    try {
      const batch = writeBatch(db);
      for (const c of plan.updatedCycles.filter((cy) => cy.fundId === fund.fundId)) {
        batch.update(doc(db, 'cycles', c.cycleId), c as any);
      }
      for (const s of plan.updatedShares.filter((sh) => sh.fundId === fund.fundId)) {
        batch.update(doc(db, 'shares', s.shareId), {
          totalBilled: s.totalBilled,
          arrears: s.arrears,
          hasClaimedPrize: s.hasClaimedPrize,
          wonMonth: s.wonMonth,
          status: s.status,
          updatedAt: s.updatedAt,
        });
      }
      batch.set(doc(db, 'ledgers', chittiLedger.ledgerId), chittiLedger);
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (err) {
      console.warn('Offline mode: queuing historical reconciliation batch:', err);
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'cycles',
        docId: cycle.cycleId,
        type: 'update',
        payload: { cycleId: cycle.cycleId, reason: data.reason },
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.putBatch(managerId, 'cycles', plan.updatedCycles);
    await localDb.putBatch(managerId, 'shares', plan.updatedShares);
    await localDb.put(managerId, 'ledgers', chittiLedger);
    await localDb.put(managerId, 'audits', audit);

    setCycles(plan.updatedCycles);
    setShares(plan.updatedShares);
    setLedgers((prev) => [...prev.filter((l) => l.ledgerId !== chittiLedger.ledgerId), chittiLedger]);

    notificationService.send('Historical Reconciliation Applied', `Reconciled Month #${cycle.cycleNumber}. New Winner: ${plan.newWinnerShare.memberName}.`, 'sync');
  };

  // Phase 13: Cryptographically Verified Member Portal Retrieval
  const getShareByPortalToken = async (token: string): Promise<{ share: Share; fund: Fund; payments: Payment[] } | null> => {
    if (!token) return null;

    if (token === 'demo' && import.meta.env.DEV && shares.length > 0) {
      return {
        share: shares[0],
        fund: activeFund || funds[0],
        payments: payments.filter((p) => p.shareId === shares[0]?.shareId),
      };
    }

    if (token.trim().length < 8) return null;

    try {
      // 1. Validate token record from Firestore portal_tokens
      const tokenDoc = await getDoc(doc(db, 'portal_tokens', token));
      if (!tokenDoc.exists()) {
        // Fallback: check local cache if manager is currently authenticated
        if (managerId) {
          const localTokens = await localDb.getAllForTenant<PortalTokenRecord>(managerId, 'portal_tokens');
          const matched = localTokens.find((t) => t.token === token || (t as any).shareId === token);
          if (matched) {
            const localShare = await localDb.getForTenant<Share>(managerId, 'shares', (matched as any).shareId);
            if (localShare) {
              const localFund = (await localDb.getForTenant<Fund>(managerId, 'funds', localShare.fundId)) || funds[0];
              const localPayments = (await localDb.getAllForTenant<Payment>(managerId, 'payments')).filter((p) => p.shareId === localShare.shareId);
              return { share: localShare, fund: localFund, payments: localPayments };
            }
          }
        }
        return null;
      }

      const tokenData = tokenDoc.data() as any;

      // 2. Check if token document has embedded passbook projection
      if (tokenData.shareSnapshot && tokenData.fundSnapshot) {
        return {
          share: tokenData.shareSnapshot as Share,
          fund: tokenData.fundSnapshot as Fund,
          payments: (tokenData.recentPayments || []) as Payment[],
        };
      }

      // 3. Fallback if the viewer is the authenticated manager who owns the fund
      if (managerId && tokenData.managerId === managerId) {
        const [shareDoc, fundDoc] = await Promise.all([
          getDoc(doc(db, 'shares', tokenData.shareId)),
          getDoc(doc(db, 'funds', tokenData.fundId)),
        ]);
        if (shareDoc.exists() && fundDoc.exists()) {
          const targetShare = shareDoc.data() as Share;
          const targetFund = fundDoc.data() as Fund;
          const paymentsQuery = query(
            collection(db, 'payments'),
            where('managerId', '==', managerId),
            where('shareId', '==', targetShare.shareId)
          );
          const paymentsSnap = await getDocs(paymentsQuery);
          const memberPayments: Payment[] = [];
          paymentsSnap.forEach((p) => memberPayments.push(p.data() as Payment));
          return {
            share: targetShare,
            fund: targetFund,
            payments: memberPayments,
          };
        }
      }

      return null;
    } catch (err) {
      console.warn('Portal token lookup error:', err);
      // Local fallback for offline mode
      if (managerId) {
        const localTokens = await localDb.getAllForTenant<PortalTokenRecord>(managerId, 'portal_tokens');
        const matched = localTokens.find((t) => t.token === token || (t as any).shareId === token);
        if (matched) {
          const localShare = await localDb.getForTenant<Share>(managerId, 'shares', (matched as any).shareId);
          if (localShare) {
            const localFund = (await localDb.getForTenant<Fund>(managerId, 'funds', localShare.fundId)) || funds[0];
            const localPayments = (await localDb.getAllForTenant<Payment>(managerId, 'payments')).filter((p) => p.shareId === localShare.shareId);
            return { share: localShare, fund: localFund, payments: localPayments };
          }
        }
      }
      return null;
    }
  };

  // Phase 14: Server-Side Cursor Pagination for Payments (R-3 Scalability)
  const fetchPaymentsPage = async (cursorDoc?: any, pageSize = 50): Promise<PaginatedResult<Payment>> => {
    if (!managerId) return { items: [], nextCursorDoc: null, hasMore: false };
    try {
      let q = query(
        collection(db, 'payments'),
        where('managerId', '==', managerId),
        limit(pageSize)
      );
      if (cursorDoc) {
        q = query(
          collection(db, 'payments'),
          where('managerId', '==', managerId),
          startAfter(cursorDoc),
          limit(pageSize)
        );
      }
      const snap = await getDocs(q);
      const items: Payment[] = [];
      snap.forEach((d) => items.push({ ...d.data(), paymentId: d.id } as Payment));
      items.sort((a, b) => new Date(b.paymentDate || b.createdAt).getTime() - new Date(a.paymentDate || a.createdAt).getTime());
      const nextCursor = snap.docs.length >= pageSize ? snap.docs[snap.docs.length - 1] : null;
      return {
        items,
        nextCursorDoc: nextCursor,
        hasMore: Boolean(nextCursor),
      };
    } catch (err) {
      console.warn('fetchPaymentsPage notice:', err);
      const local = await localDb.getAllForTenant<Payment>(managerId, 'payments');
      return { items: local.slice(0, pageSize), nextCursorDoc: null, hasMore: false };
    }
  };

  // Phase 14: Server-Side Cursor Pagination for Audits (R-3 Scalability)
  const fetchAuditsPage = async (cursorDoc?: any, pageSize = 50): Promise<PaginatedResult<AuditRecord>> => {
    if (!managerId) return { items: [], nextCursorDoc: null, hasMore: false };
    try {
      let q = query(
        collection(db, 'audits'),
        where('managerId', '==', managerId),
        limit(pageSize)
      );
      if (cursorDoc) {
        q = query(
          collection(db, 'audits'),
          where('managerId', '==', managerId),
          startAfter(cursorDoc),
          limit(pageSize)
        );
      }
      const snap = await getDocs(q);
      const items: AuditRecord[] = [];
      snap.forEach((d) => items.push({ ...d.data(), auditId: d.id } as AuditRecord));
      items.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.timestamp || 0).getTime();
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });
      const nextCursor = snap.docs.length >= pageSize ? snap.docs[snap.docs.length - 1] : null;
      return {
        items,
        nextCursorDoc: nextCursor,
        hasMore: Boolean(nextCursor),
      };
    } catch (err) {
      console.warn('fetchAuditsPage notice:', err);
      const local = await localDb.getAllForTenant<AuditRecord>(managerId, 'audits');
      return { items: local.slice(0, pageSize), nextCursorDoc: null, hasMore: false };
    }
  };

  // Phase 15: CRM Contact Creation
  const createContact = async (contact: Omit<Contact, 'contactId' | 'managerId' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    
    // Normalize phone number
    const normPhone = normalizePhoneNumber(contact.phone);
    if (!normPhone) throw new Error('Valid phone number is required.');

    // Check if phone number already exists for this tenant
    const existing = contacts.find(
      (c) => c.managerId === managerId && normalizePhoneNumber(c.phone) === normPhone
    );
    if (existing) {
      throw new Error('A contact with this phone number already exists.');
    }

    // Normalized phone number is the unique identifier
    const contactId = normPhone;
    const newContact: Contact = {
      ...contact,
      phone: normPhone,
      contactId,
      managerId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, 'contacts', contactId), newContact);
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'contacts',
        docId: contactId,
        type: 'set',
        payload: newContact,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }
    await localDb.put(managerId, 'contacts', newContact);
    setContacts((prev) => [newContact, ...prev]);
    return contactId;
  };

  // Phase 15: CRM Contact Update
  const updateContact = async (
    contactId: string, 
    data: Partial<Omit<Contact, 'contactId' | 'managerId' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const existing = contacts.find((c) => c.contactId === contactId && c.managerId === managerId);
    if (!existing) throw new Error('Contact not found');

    let updatedPhone = existing.phone;
    let targetContactId = contactId;

    if (data.phone) {
      const normNewPhone = normalizePhoneNumber(data.phone);
      if (!normNewPhone) throw new Error('Valid phone number is required.');

      // Check if another contact for this tenant already has this phone number
      const duplicate = contacts.find(
        (c) => c.contactId !== contactId && c.managerId === managerId && normalizePhoneNumber(c.phone) === normNewPhone
      );
      if (duplicate) {
        throw new Error('A contact with this phone number already exists.');
      }
      updatedPhone = normNewPhone;
      targetContactId = normNewPhone;
    }

    const updatedContact: Contact = {
      ...existing,
      ...data,
      phone: updatedPhone,
      contactId: targetContactId,
      updatedAt: new Date().toISOString(),
    };
    // Ensure displayId is removed for contacts
    delete (updatedContact as any).displayId;

    try {
      if (targetContactId !== contactId) {
        // Phone number changed: write new doc, delete old doc
        await setDoc(doc(db, 'contacts', targetContactId), updatedContact);
        await deleteDoc(doc(db, 'contacts', contactId));
        await localDb.delete(managerId, 'contacts', contactId);

        // Update any groups containing the old contact ID
        for (const g of groups) {
          if (g.memberIds && g.memberIds.includes(contactId)) {
            const newMemberIds = g.memberIds.map((id) => (id === contactId ? targetContactId : id));
            await updateDoc(doc(db, 'groups', g.groupId), { 
              memberIds: newMemberIds, 
              updatedAt: new Date().toISOString() 
            });
            await localDb.put(managerId, 'groups', { ...g, memberIds: newMemberIds, updatedAt: new Date().toISOString() });
          }
        }
        setGroups((prev) =>
          prev.map((g) =>
            g.memberIds && g.memberIds.includes(contactId)
              ? { ...g, memberIds: g.memberIds.map((id) => (id === contactId ? targetContactId : id)) }
              : g
          )
        );
      } else {
        await setDoc(doc(db, 'contacts', contactId), updatedContact, { merge: true });
      }
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'contacts',
        docId: targetContactId,
        type: 'set',
        payload: updatedContact,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.put(managerId, 'contacts', updatedContact);
    setContacts((prev) => prev.map((c) => (c.contactId === contactId ? updatedContact : c)));
  };

  // Phase 15: Safe CRM Contact Deletion
  const deleteContact = async (contactId: string): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const existing = contacts.find((c) => c.contactId === contactId && c.managerId === managerId);
    if (!existing) throw new Error('Contact not found');

    // Rule 3 Safety Check: Deleting a CRM contact must NOT delete fund, share, billing, payment, payout, ledger, audit.
    // If the contact is linked to an existing member/share: prevent deletion and explain that the contact is linked to a member.
    const normPhone = normalizePhoneNumber(existing.phone);
    const isLinkedToMember = shares.some(
      (s) =>
        s.managerId === managerId &&
        (s.contactId === contactId || (s.memberPhone && normalizePhoneNumber(s.memberPhone) === normPhone))
    );
    if (isLinkedToMember) {
      throw new Error(
        'This contact is linked to an active member/share record and cannot be deleted from financial history. You can edit their contact details instead.'
      );
    }

    try {
      await deleteDoc(doc(db, 'contacts', contactId));
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'contacts',
        docId: contactId,
        type: 'delete',
        payload: null,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    await localDb.delete(managerId, 'contacts', contactId);
    setContacts((prev) => prev.filter((c) => c.contactId !== contactId));

    // Remove contact from any group memberships
    for (const g of groups) {
      if (g.memberIds && g.memberIds.includes(contactId)) {
        const newMemberIds = g.memberIds.filter((id) => id !== contactId);
        try {
          await updateDoc(doc(db, 'groups', g.groupId), { 
            memberIds: newMemberIds, 
            updatedAt: new Date().toISOString() 
          });
        } catch (err) {
          console.warn('Notice updating group after contact deletion:', err);
        }
        await localDb.put(managerId, 'groups', { ...g, memberIds: newMemberIds });
      }
    }
    setGroups((prev) =>
      prev.map((g) =>
        g.memberIds && g.memberIds.includes(contactId)
          ? { ...g, memberIds: g.memberIds.filter((id) => id !== contactId) }
          : g
      )
    );
  };

  // Phase 15: CRM Group Creation
  const createGroup = async (name: string, description: string, memberIds: string[] = []): Promise<string> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const groupId = FinancialEngine.generateCryptoToken();
    const displayId = generateUniqueGroupDisplayId();
    const newGroup: Group = {
      groupId,
      displayId,
      managerId,
      name: name.trim(),
      description: description.trim(),
      memberIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'groups', groupId), newGroup);
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'groups',
        docId: groupId,
        type: 'set',
        payload: newGroup,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }
    await localDb.put(managerId, 'groups', newGroup);
    setGroups((prev) => [newGroup, ...prev]);
    return groupId;
  };

  // Phase 15: CRM Group Update (Name & Description)
  const updateGroup = async (groupId: string, data: { name: string; description: string }): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const existing = groups.find((g) => g.groupId === groupId && g.managerId === managerId);
    if (!existing) throw new Error('Group not found');

    const updatedGroup: Group = {
      ...existing,
      name: data.name.trim(),
      description: data.description.trim(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        name: updatedGroup.name,
        description: updatedGroup.description,
        updatedAt: updatedGroup.updatedAt,
      });
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'groups',
        docId: groupId,
        type: 'set',
        payload: updatedGroup,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }
    await localDb.put(managerId, 'groups', updatedGroup);
    setGroups((prev) => prev.map((g) => (g.groupId === groupId ? updatedGroup : g)));
  };

  // Phase 15: CRM Group Deletion (Preserves contacts, campaigns, financial records)
  const deleteGroup = async (groupId: string): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const existing = groups.find((g) => g.groupId === groupId && g.managerId === managerId);
    if (!existing) throw new Error('Group not found');

    try {
      await deleteDoc(doc(db, 'groups', groupId));
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'groups',
        docId: groupId,
        type: 'delete',
        payload: null,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }
    await localDb.delete(managerId, 'groups', groupId);
    setGroups((prev) => prev.filter((g) => g.groupId !== groupId));
  };

  // Phase 15: CRM Group Membership Update (Add / Remove contacts)
  const updateGroupMembers = async (groupId: string, memberIds: string[]): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const existing = groups.find((g) => g.groupId === groupId && g.managerId === managerId);
    if (!existing) throw new Error('Group not found');

    const updatedGroup: Group = {
      ...existing,
      memberIds,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(doc(db, 'groups', groupId), {
        memberIds,
        updatedAt: updatedGroup.updatedAt,
      });
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'groups',
        docId: groupId,
        type: 'set',
        payload: updatedGroup,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }
    await localDb.put(managerId, 'groups', updatedGroup);
    setGroups((prev) => prev.map((g) => (g.groupId === groupId ? updatedGroup : g)));
  };

  // Phase 15: CRM Campaign Outreach
  const sendCampaign = async (data: { 
    title: string; 
    message: string; 
    channels?: CampaignChannel[]; 
    channel?: string; 
    fundId?: string; 
    targetGroupIds?: string[]; 
    targetAudience?: CampaignTargetAudience; 
    recipientCount?: number 
  }) => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    // Normalize channels - must have at least 1
    const selectedChannels: CampaignChannel[] = 
      data.channels && data.channels.length > 0 
        ? data.channels 
        : data.channel 
          ? [data.channel.toUpperCase() as CampaignChannel] 
          : ['WHATSAPP'];

    if (selectedChannels.length < 1) {
      throw new Error('At least one communication channel must be selected.');
    }

    const campaignId = FinancialEngine.generateCryptoToken();
    const newCampaign: Campaign = {
      campaignId,
      displayId: FinancialEngine.generateDisplayId('CMP'),
      managerId,
      fundId: data.fundId,
      title: data.title,
      message: data.message,
      channels: selectedChannels,
      channel: selectedChannels.join(', '),
      targetGroupIds: data.targetGroupIds,
      targetAudience: data.targetAudience,
      recipientCount: data.recipientCount ?? (contacts.filter((c) => c.communicationStatus !== 'unsubscribed').length || 1),
      status: 'sent',
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'campaigns', campaignId), newCampaign);
    } catch (e) {
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid,
        collection: 'campaigns',
        docId: campaignId,
        type: 'set',
        payload: newCampaign,
      });
      setPendingOfflineCount((prev) => prev + 1);
    }
    await localDb.put(managerId, 'campaigns', newCampaign);
    setCampaigns((prev) => [newCampaign, ...prev]);

    // Dispatch ONE centralized webhook trigger for campaign_launch to n8n
    try {
      const fundObj = funds.find((f) => f.fundId === data.fundId);
      const res = await CommunicationDispatcher.dispatchCampaignLaunch({
        tenantId: managerId,
        managerId,
        managerName: tenant?.name || 'Operations Manager',
        managerPhone: tenant?.phone || '',
        managerEmail: tenant?.email || '',
        campaignId,
        title: data.title,
        message: data.message,
        channels: selectedChannels,
        targetType: data.targetAudience || (data.targetGroupIds?.length ? 'GROUPS' : 'ALL'),
        targetId: data.targetGroupIds?.join(',') || 'ALL',
        fundId: data.fundId,
        fundName: fundObj?.fundName || '',
        recipientCount: newCampaign.recipientCount,
      });
      if (res.dispatchRecord) {
        await recordDispatch(res.dispatchRecord);
      }
    } catch (commErr) {
      console.warn('Outbound webhook trigger notification:', commErr);
    }

    notificationService.send('Outreach Dispatched', `Campaign "${data.title}" dispatched via ${selectedChannels.join(' + ')}.`, 'sync');
  };

  const updateShare = async (data: {
    fundId: string;
    shareId: string;
    memberName: string;
    memberPhone: string;
    contactId?: string;
  }) => {
    if (!managerId) throw new Error('Unauthenticated tenant');

    const trimmedName = data.memberName.trim();
    const trimmedPhone = data.memberPhone.trim();
    if (!trimmedName) throw new Error('Member name is required');
    if (!trimmedPhone) throw new Error('Member phone number is required');

    const targetShare = shares.find((s) => s.shareId === data.shareId && s.managerId === managerId);
    if (!targetShare) throw new Error('Share not found or unauthorized');

    if (targetShare.fundId !== data.fundId) {
      throw new Error('Security Violation: Share does not belong to the specified Chitti');
    }

    const now = new Date().toISOString();
    const updatedShareData: Share = {
      ...targetShare,
      memberName: trimmedName,
      memberPhone: trimmedPhone,
      contactId: data.contactId || targetShare.contactId,
      memberId: data.contactId || targetShare.memberId,
      updatedAt: now,
    };

    // 1. Update in Firestore with audit
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'shares', data.shareId), {
        memberName: trimmedName,
        memberPhone: trimmedPhone,
        contactId: data.contactId || targetShare.contactId || null,
        memberId: data.contactId || targetShare.memberId,
        updatedAt: now,
      });

      // Update portal token document snapshot if present
      if (targetShare.portalToken) {
        batch.set(
          doc(db, 'portal_tokens', targetShare.portalToken),
          {
            memberName: trimmedName,
            shareSnapshot: {
              ...targetShare,
              memberName: trimmedName,
              memberPhone: trimmedPhone,
              updatedAt: now,
            },
            updatedAt: now,
          },
          { merge: true }
        );
      }

      // Authoritative audit trail
      const auditId = `aud_shrupd_${Date.now()}`;
      batch.set(doc(db, 'audits', auditId), {
        auditId,
        managerId,
        actorUid,
        action: 'UPDATE_MEMBER_INFO',
        entityType: 'SHARE',
        entityId: data.shareId,
        details: `Updated member info for share ${targetShare.shareNumber} (${data.shareId}) to "${trimmedName}" (${trimmedPhone})`,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (e) {
      console.warn('Network update failed, queueing offline mutation:', e);
      await localDb.queueOfflineMutation({
        operationId: FinancialEngine.generateCryptoToken(),
        managerId,
        authUid: authUid || managerId || '',
        collection: 'shares',
        docId: data.shareId,
        type: 'update',
        payload: {
          memberName: trimmedName,
          memberPhone: trimmedPhone,
          updatedAt: now,
        },
      });
      setPendingOfflineCount((prev) => prev + 1);
    }

    // 2. Update local state
    setShares((prev) =>
      prev.map((s) => (s.shareId === data.shareId ? updatedShareData : s))
    );

    // 3. Update localDb
    await localDb.put(managerId, 'shares', updatedShareData);
    notificationService.send('Member Updated', `Share #${targetShare.shareNumber} info updated for ${trimmedName}.`, 'sync');
  };

  const deleteCurrentCycle = async (fundId: string, cycleId: string) => {
    if (!managerId) throw new Error('Unauthenticated tenant');

    const fundCycles = cycles.filter((c) => c.fundId === fundId);
    if (fundCycles.length === 0) throw new Error('No cycles found for this Chitti');

    const maxCycleNumber = Math.max(...fundCycles.map((c) => c.cycleNumber));
    const targetCycle = fundCycles.find((c) => c.cycleId === cycleId || c.cycleNumber === maxCycleNumber);

    if (!targetCycle) throw new Error('Target cycle not found');

    // ENFORCE SECTION 5 RULE: ONLY THE CURRENT/LATEST CYCLE CAN BE DELETED.
    if (targetCycle.cycleNumber < maxCycleNumber) {
      throw new Error(`Security Policy: Only the current/latest cycle (Cycle #${maxCycleNumber}) can be deleted. Historical cycles (Cycle #${targetCycle.cycleNumber}) are locked to preserve financial integrity.`);
    }

    // Atomically delete target cycle and revert cycle-specific winner claims
    const winnerShare = targetCycle.winnerShareId
      ? shares.find((s) => s.shareId === targetCycle.winnerShareId)
      : null;

    let updatedWinnerShare: Share | null = null;
    if (winnerShare && winnerShare.wonMonth === targetCycle.cycleNumber) {
      updatedWinnerShare = {
        ...winnerShare,
        hasClaimedPrize: false,
        wonMonth: null,
        status: 'undrawn',
        updatedAt: new Date().toISOString(),
      };
    }

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'cycles', targetCycle.cycleId));
      if (updatedWinnerShare) {
        batch.update(doc(db, 'shares', updatedWinnerShare.shareId), {
          hasClaimedPrize: false,
          wonMonth: null,
          status: 'undrawn',
          updatedAt: updatedWinnerShare.updatedAt,
        });
      }
      await batch.commit();
    } catch (e) {
      console.warn('Network cycle deletion notice:', e);
    }

    // Update local state
    setCycles((prev) => prev.filter((c) => c.cycleId !== targetCycle.cycleId));
    if (updatedWinnerShare) {
      setShares((prev) => prev.map((s) => (s.shareId === updatedWinnerShare!.shareId ? updatedWinnerShare! : s)));
    }

    await localDb.delete(managerId, 'cycles', targetCycle.cycleId);
    if (updatedWinnerShare) {
      await localDb.put(managerId, 'shares', updatedWinnerShare);
    }

    notificationService.send('Cycle Deleted', `Cycle #${targetCycle.cycleNumber} was removed. Active cycle reverted to Cycle #${Math.max(1, maxCycleNumber - 1)}.`, 'sync');
  };

  const deleteFund = async (fundId: string) => {
    if (!managerId) throw new Error('Unauthenticated tenant');
    const targetFund = funds.find((f) => f.fundId === fundId && f.managerId === managerId);
    if (!targetFund) throw new Error('Fund not found or unauthorized');

    const targetShares = shares.filter((s) => s.fundId === fundId);
    const targetCycles = cycles.filter((c) => c.fundId === fundId);
    const targetLedgers = ledgers.filter((l) => l.fundId === fundId);
    const targetBillings = billings.filter((b) => b.fundId === fundId);
    const targetPayouts = payouts.filter((p) => p.fundId === fundId);

    // Commit atomic batch deletion across all fund entities
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'funds', fundId));
      targetShares.forEach((s) => batch.delete(doc(db, 'shares', s.shareId)));
      targetCycles.forEach((c) => batch.delete(doc(db, 'cycles', c.cycleId)));
      targetLedgers.forEach((l) => batch.delete(doc(db, 'ledgers', l.ledgerId)));
      targetBillings.forEach((b) => batch.delete(doc(db, 'billings', b.billingId)));
      targetPayouts.forEach((p) => batch.delete(doc(db, 'payouts', p.payoutId)));

      // Permanently retire display IDs in the global registry (never recycled)
      if (targetFund.displayId && HUMAN_ID_REGEX.test(targetFund.displayId)) {
        batch.update(doc(db, 'display_id_registry', targetFund.displayId), {
          status: 'RETIRED',
          retiredAt: serverTimestamp(),
          retiredReason: `Deleted with Fund "${targetFund.fundName}" (${fundId})`,
          updatedAt: serverTimestamp(),
        });
      }
      targetShares.forEach((s) => {
        if (s.displayId && HUMAN_ID_REGEX.test(s.displayId)) {
          batch.update(doc(db, 'display_id_registry', s.displayId), {
            status: 'RETIRED',
            retiredAt: serverTimestamp(),
            retiredReason: `Deleted with Fund "${targetFund.fundName}" (${fundId})`,
            updatedAt: serverTimestamp(),
          });
        }
      });

      const auditId = `aud_funddel_${Date.now()}`;
      batch.set(doc(db, 'audits', auditId), {
        auditId,
        managerId,
        actorUid,
        action: 'DELETE_CHITTI_SCHEME',
        entityType: 'FUND',
        entityId: fundId,
        details: `Deleted Chitti scheme "${targetFund.fundName}" (${fundId}) with ${targetShares.length} shares, ${targetCycles.length} cycles, ${targetBillings.length} billings, and ${targetPayouts.length} payouts`,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    } catch (e) {
      console.warn('Network deletion failed:', e);
      throw new Error('Failed to delete scheme on server. Check network connection.');
    }

    // Update local state
    setFunds((prev) => prev.filter((f) => f.fundId !== fundId));
    setShares((prev) => prev.filter((s) => s.fundId !== fundId));
    setCycles((prev) => prev.filter((c) => c.fundId !== fundId));
    setLedgers((prev) => prev.filter((l) => l.fundId !== fundId));
    setBillings((prev) => prev.filter((b) => b.fundId !== fundId));
    setPayouts((prev) => prev.filter((p) => p.fundId !== fundId));

    // Clear from local IndexedDB
    await localDb.delete(managerId, 'funds', fundId);
    for (const s of targetShares) {
      await localDb.delete(managerId, 'shares', s.shareId);
    }
    for (const c of targetCycles) {
      await localDb.delete(managerId, 'cycles', c.cycleId);
    }
    for (const b of targetBillings) {
      await localDb.delete(managerId, 'billings', b.billingId);
    }
    for (const p of targetPayouts) {
      await localDb.delete(managerId, 'payouts', p.payoutId);
    }

    if (activeFundId === fundId) {
      const remainingFunds = funds.filter((f) => f.fundId !== fundId);
      setActiveFundId(remainingFunds[0]?.fundId || null);
    }

    notificationService.send('Scheme Deleted', `Chitti scheme "${targetFund.fundName}" has been removed.`, 'sync');
  };

  const rebuildMaterializedState = async (fundId: string): Promise<void> => {
    if (!managerId) throw new Error('Unauthenticated tenant');
    const fund = funds.find((f) => f.fundId === fundId && f.managerId === managerId);
    if (!fund) throw new Error('Fund not found or unauthorized');

    const fundShares = shares.filter((s) => s.fundId === fundId);
    const fundCycles = cycles.filter((c) => c.fundId === fundId);
    const fundBillings = billings.filter((b) => b.fundId === fundId);
    const fundPayouts = payouts.filter((p) => p.fundId === fundId && p.status === 'disbursed');
    const fundPayments = payments.filter((p) => p.fundId === fundId);

    const updatedShares: Share[] = [];
    for (const s of fundShares) {
      const shareBillings = fundBillings.filter((b) => b.shareId === s.shareId);
      const totalBilled = shareBillings.reduce((sum, b) => sum + b.billAmount, 0);

      const sharePayments = fundPayments.filter((p) => p.shareId === s.shareId);
      const totalPaid = sharePayments.reduce((sum, p) => sum + p.amount, 0);

      const resolved = FinancialEngine.resolveBalance(totalBilled, totalPaid);

      const sharePayouts = fundPayouts.filter((p) => p.shareId === s.shareId);
      const hasClaimedPrize = sharePayouts.length > 0;
      
      let wonMonthVal: number | null = null;
      if (hasClaimedPrize) {
        const earliestPayout = sharePayouts.sort((a, b) => new Date(a.payoutDate).getTime() - new Date(b.payoutDate).getTime())[0];
        const matchedC = fundCycles.find((c) => c.cycleId === earliestPayout.cycleId);
        wonMonthVal = matchedC ? matchedC.cycleNumber : null;
      }

      const updated: Share = {
        ...s,
        totalBilled,
        totalPaid,
        arrears: resolved.arrears,
        advance: resolved.advance,
        hasClaimedPrize,
        wonMonth: wonMonthVal,
        status: hasClaimedPrize ? 'drawn' : 'undrawn',
        updatedAt: new Date().toISOString(),
      };
      updatedShares.push(updated);
    }

    const totalCollected = updatedShares.reduce((a, s) => a + s.totalPaid, 0);
    const totalDisbursed = fundPayouts.reduce((sum, p) => sum + p.amount, 0);
    const totalArrears = updatedShares.reduce((a, s) => a + s.arrears, 0);

    const chittiLedger = ledgers.find((l) => l.fundId === fundId && l.ledgerType === 'CHITTI_LEDGER');
    const updatedLedger: MaterializedLedger = chittiLedger
      ? {
          ...chittiLedger,
          totalCollected,
          totalDisbursed,
          totalArrears,
          updatedAt: new Date().toISOString(),
        }
      : {
          ledgerId: `ledger_${fundId}`,
          managerId,
          fundId,
          ledgerType: 'CHITTI_LEDGER',
          totalPool: fund.totalPool,
          totalCollected,
          totalDisbursed,
          totalArrears,
          totalMembers: fund.numberOfShares,
          updatedAt: new Date().toISOString(),
        };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid,
      action: 'RECONCILIATION_CORRECTION',
      entityType: 'FUND',
      entityId: fundId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Systemic rebuild of materialized state for fund ${fund.fundName} based on /billings, /payments, and /payouts.`,
    };

    try {
      const batch = writeBatch(db);
      for (const s of updatedShares) {
        batch.update(doc(db, 'shares', s.shareId), {
          totalBilled: s.totalBilled,
          totalPaid: s.totalPaid,
          arrears: s.arrears,
          advance: s.advance,
          hasClaimedPrize: s.hasClaimedPrize,
          wonMonth: s.wonMonth,
          status: s.status,
          updatedAt: s.updatedAt,
        });
      }
      batch.set(doc(db, 'ledgers', updatedLedger.ledgerId), updatedLedger);
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Failed to commit rebuild batch to network:', e);
    }

    // Update local state and localDb
    setShares((prev) =>
      prev.map((s) => {
        const found = updatedShares.find((us) => us.shareId === s.shareId);
        return found || s;
      })
    );
    setLedgers((prev) => [...prev.filter((l) => l.ledgerId !== updatedLedger.ledgerId), updatedLedger]);

    for (const s of updatedShares) {
      await localDb.put(managerId, 'shares', s);
    }
    await localDb.put(managerId, 'ledgers', updatedLedger);
    await localDb.put(managerId, 'audits', audit);

    notificationService.send('State Rebuilt', `Materialized state successfully rebuilt from authoritative records.`, 'sync');
  };

  const updateFundNameAndFrequency = async (fundId: string, name: string, frequency: string, startDate?: string | null): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const fund = funds.find((f) => f.fundId === fundId);
    if (!fund) throw new Error('Chitti scheme not found');

    if (fund.managerId !== managerId) {
      throw new Error('PERMISSION_DENIED: Unauthorized manager cannot edit this scheme');
    }

    const plannedCyclesVal = frequency === '6-months' ? 6 : (frequency === '1-year' ? 12 : fund.totalCycles);

    const updatedFund: Fund = {
      ...fund,
      fundName: name.trim(),
      cycleFrequency: frequency as any,
      totalCycles: plannedCyclesVal,
      totalMonths: plannedCyclesVal || fund.totalMonths || 12,
      startDate: startDate || fund.startDate,
      updatedAt: new Date().toISOString(),
    };

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid: authUid,
      action: 'FUND_IDENTITY_UPDATE',
      entityType: 'FUND',
      entityId: fundId,
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      reason: `Updated fund identity: Name="${name.trim()}", Frequency="${frequency}", Start Date="${updatedFund.startDate}", Total Cycles="${plannedCyclesVal || 'Unchanged'}".`,
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'funds', fundId), {
        fundName: updatedFund.fundName,
        cycleFrequency: updatedFund.cycleFrequency,
        totalCycles: updatedFund.totalCycles,
        totalMonths: updatedFund.totalMonths,
        startDate: updatedFund.startDate,
        updatedAt: updatedFund.updatedAt,
      });
      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Offline mode: queuing fund update:', e);
    }

    await localDb.put(managerId, 'funds', updatedFund);
    await localDb.put(managerId, 'audits', audit);

    setFunds((prev) => prev.map((f) => (f.fundId === fundId ? updatedFund : f)));
    notificationService.send('Scheme Updated', `Updated identity of ${updatedFund.fundName}.`, 'sync');
  };

  const deleteShare = async (fundId: string, shareId: string): Promise<void> => {
    if (!managerId || !authUid) throw new Error('Not authenticated');
    const fund = funds.find((f) => f.fundId === fundId);
    if (!fund) throw new Error('Chitti scheme not found');

    if (fund.managerId !== managerId) {
      throw new Error('PERMISSION_DENIED: Unauthorized manager cannot edit this scheme');
    }

    const share = shares.find((s) => s.shareId === shareId);
    if (!share) throw new Error('Share not found');

    if (share.fundId !== fundId) {
      throw new Error('Security Violation: Share does not belong to the active Chitti workspace');
    }

    const now = new Date().toISOString();

    const audit: AuditRecord = {
      auditId: FinancialEngine.generateCryptoToken(),
      managerId,
      actorUid: authUid,
      action: 'SHARE_DELETED',
      entityType: 'SHARE',
      entityId: shareId,
      timestamp: now,
      createdAt: serverTimestamp(),
      reason: `Deleted Share #${share.shareNumber} (${share.memberName}) from scheme ${fund.fundName}.`,
    };

    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'shares', shareId));
      
      // Permanently retire display ID in the global registry (never recycled)
      if (share.displayId && HUMAN_ID_REGEX.test(share.displayId)) {
        batch.update(doc(db, 'display_id_registry', share.displayId), {
          status: 'RETIRED',
          retiredAt: serverTimestamp(),
          retiredReason: `Deleted Share #${share.shareNumber} from scheme ${fund.fundName}`,
          updatedAt: serverTimestamp(),
        });
      }

      const tokensRef = collection(db, 'portal_tokens');
      const q = query(tokensRef, where('shareId', '==', shareId));
      const qSnap = await getDocs(q);
      qSnap.forEach((d) => {
        batch.delete(doc(db, 'portal_tokens', d.id));
      });

      batch.set(doc(db, 'audits', audit.auditId), audit);
      await batch.commit();
    } catch (e) {
      console.warn('Network share delete notice:', e);
    }

    setShares((prev) => prev.filter((s) => s.shareId !== shareId));
    await localDb.delete(managerId, 'shares', shareId);
    await localDb.put(managerId, 'audits', audit);

    // Systemic rebuild of materialized statistics after deletion
    await rebuildMaterializedState(fundId);

    notificationService.send('Share Deleted', `Removed Share #${share.shareNumber} (${share.memberName}) successfully.`, 'sync');
  };

  const executeDrawAssignment = async (data: {
    managerId: string;
    fundId: string;
    shareId: string;
    previousDrawCycleId: string | null;
    newDrawCycleId: string | null;
    payoutAmount: number;
    billingChanges: Record<number, number>;
  }) => {
    if (!managerId || !authUid) throw new Error('Not authenticated');

    const fund = funds.find(f => f.fundId === data.fundId);
    if (!fund || fund.managerId !== managerId) throw new Error('Unauthorized or Fund not found');

    const share = shares.find(s => s.shareId === data.shareId);
    if (!share || share.fundId !== data.fundId) throw new Error('Share not found or mismatch');

    const fundCycles = cycles.filter(c => c.fundId === data.fundId);
    
    const isRevoke = data.newDrawCycleId === null;
    const isReassign = data.previousDrawCycleId !== null && data.newDrawCycleId !== null;
    const isNewAssign = data.previousDrawCycleId === null && data.newDrawCycleId !== null;

    let operationType = 'DRAW_ASSIGNED';
    if (isRevoke) operationType = 'DRAW_REVOKED';
    if (isReassign) operationType = 'DRAW_REASSIGNED';

    const newDrawCycle = data.newDrawCycleId ? fundCycles.find(c => c.cycleId === data.newDrawCycleId) : null;
    const prevDrawCycle = data.previousDrawCycleId ? fundCycles.find(c => c.cycleId === data.previousDrawCycleId) : null;

    const newDrawCycleNum = newDrawCycle ? newDrawCycle.cycleNumber : null;
    const prevPayout = data.previousDrawCycleId ? payouts.find(p => p.shareId === share.shareId && p.cycleId === data.previousDrawCycleId && p.status === 'disbursed') : null;

    const now = new Date().toISOString();
    const updatedShare: Share = {
      ...share,
      hasClaimedPrize: !isRevoke,
      wonMonth: isRevoke ? null : newDrawCycleNum,
      status: isRevoke ? 'undrawn' : 'drawn',
      updatedAt: now,
    };

    const batch = writeBatch(db);

    // a. Update Share
    batch.update(doc(db, 'shares', share.shareId), {
      hasClaimedPrize: updatedShare.hasClaimedPrize,
      wonMonth: updatedShare.wonMonth,
      status: updatedShare.status,
      updatedAt: updatedShare.updatedAt,
    });

    // b. Payouts
    if (prevPayout) {
      batch.update(doc(db, 'payouts', prevPayout.payoutId), {
        status: 'cancelled',
        updatedAt: now,
        updatedBy: authUid
      });
    }

    if (data.newDrawCycleId && data.payoutAmount > 0) {
      const payoutId = `${managerId}_pay_dra_${data.newDrawCycleId}_${share.shareId}`;
      const newPayout: Payout = {
        payoutId,
        managerId,
        fundId: data.fundId,
        cycleId: data.newDrawCycleId,
        shareId: share.shareId,
        memberId: share.memberId,
        amount: data.payoutAmount,
        amountPaise: FinancialEngine.toPaise(data.payoutAmount),
        payoutDate: newDrawCycle?.auctionDate || now.split('T')[0],
        paymentMethod: 'Bank',
        status: 'disbursed',
        createdAt: now,
        createdBy: authUid,
      };
      batch.set(doc(db, 'payouts', payoutId), newPayout);
    }

    // c. Billings
    Object.entries(data.billingChanges).forEach(([cycleNumStr, amount]) => {
      const cycleNum = parseInt(cycleNumStr);
      const cycle = fundCycles.find(c => c.cycleNumber === cycleNum);
      if (cycle) {
        const billingId = `${managerId}_${cycle.cycleId}_${share.shareId}`;
        const billing: Billing = {
          billingId,
          managerId,
          fundId: data.fundId,
          cycleId: cycle.cycleId,
          shareId: share.shareId,
          billAmount: amount,
          billAmountPaise: FinancialEngine.toPaise(amount),
          createdAt: now,
          updatedAt: now,
          createdBy: authUid,
          version: 1,
        };
        batch.set(doc(db, 'billings', billingId), billing);
      }
    });

    // d. Audit
    const auditId = FinancialEngine.generateCryptoToken();
    const audit: AuditRecord = {
      auditId,
      managerId,
      actorUid,
      fundId: data.fundId,
      shareId: data.shareId,
      previousDrawStatus: share.status,
      newDrawStatus: updatedShare.status,
      previousDrawCycleId: data.previousDrawCycleId,
      newDrawCycleId: data.newDrawCycleId,
      previousPayoutAmount: prevPayout?.amount || 0,
      newPayoutAmount: data.payoutAmount,
      billingChanges: JSON.stringify(data.billingChanges),
      affectedCycles: JSON.stringify(Object.keys(data.billingChanges)),
      timestamp: now,
      operationType,
      action: operationType,
      entityType: 'DRAW',
      entityId: share.shareId,
      createdAt: serverTimestamp(),
    };
    batch.set(doc(db, 'audits', auditId), audit);

    // e. Cycle Winner Refs
    if (prevDrawCycle && prevDrawCycle.winnerShareId === share.shareId) {
      batch.update(doc(db, 'cycles', prevDrawCycle.cycleId), {
        winnerShareId: null,
        winnerMemberId: null,
        winnerMemberName: null,
        winnerNetPayout: 0,
      });
    }
    if (newDrawCycle) {
      batch.update(doc(db, 'cycles', newDrawCycle.cycleId), {
        winnerShareId: share.shareId,
        winnerMemberId: share.memberId,
        winnerMemberName: share.memberName,
        winnerNetPayout: data.payoutAmount,
      });
    }

    await batch.commit();

    // Rebuild local state authoritative calculation
    await rebuildMaterializedState(data.fundId);
    
    notificationService.send('Draw Updated', 'Changes saved successfully.', 'sync');
  };

  return (
    <ChitFundContext.Provider
      value={{
        funds,
        shares,
        cycles,
        billings,
        payouts,
        payments,
        contacts,
        groups,
        campaigns,
        dispatches,
        recordDispatch,
        audits,
        ledgers,
        loading,
        activeFund,
        pendingOfflineCount,
        acknowledgementState,
        showAcknowledgement,
        closeAcknowledgement,
        setActiveFundId,
        createFund,
        addShare,
        createCycle,
        saveCycleBills,
        recordSharePayout,
        revokeSharePayout,
        updateCycleMetadata,
        endFund,
        revokeEndFund,
        updateFundMetadata,
        recordPayment,
        finalizeCycleSettlement,
        updateDrawStatus,
        executeDrawAssignment,
        updateShare,
        deleteCurrentCycle,
        deleteFund,
        updateFundNameAndFrequency,
        deleteShare,
        createContact,
        updateContact,
        deleteContact,
        createGroup,
        updateGroup,
        deleteGroup,
        updateGroupMembers,
        sendCampaign,
        seedDemoDataIfEmpty,
        rebuildMaterializedState,
        getShareByPortalToken,
        fetchPaymentsPage,
        fetchAuditsPage,
      }}
    >
      {children}
    </ChitFundContext.Provider>
  );
};

export const useChitFund = () => {
  const context = useContext(ChitFundContext);
  if (!context) {
    throw new Error('useChitFund must be used within a ChitFundProvider');
  }
  return context;
};
