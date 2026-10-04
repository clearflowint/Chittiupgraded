export type FundStatus = 'draft' | 'active' | 'auction_pending' | 'completed' | 'ended';
export type ShareStatus = 'undrawn' | 'drawn' | 'defaulted';
export type CycleStatus = 'upcoming' | 'bidding' | 'finalized';
export type PaymentMethod = 'UPI' | 'Bank' | 'Cash';
export type CampaignStatus = 'draft' | 'queued' | 'sent';

/**
 * DATABASE CONTRACT - COLLECTION: /tenants
 * - Document Identity: tenantId matches the Firebase Auth UID.
 * - Tenant Ownership: Owned by the authenticated manager/tenant (request.auth.uid == tenantId).
 * - Parent Relationship: Root collection.
 * - Who Creates It: Automatically created during manager signup.
 * - Who Updates It: The authenticated manager (for name/phone defaults).
 * - Who Deletes It: NEVER deleted via client SDK.
 * - Authoritative/Derived: Authoritative master configuration.
 * - Client Writes Permitted: Yes, but strictly isolated to their own Auth UID.
 */
export interface Tenant {
  managerId: string;
  authUid: string;
  name: string;
  email: string;
  phone: string;
  currency: string;
  defaultCommissionPercent: number;
  profileCompleted?: boolean;
  createdAt: string;
  updatedAt?: string;
  status: 'active' | 'suspended';
}

/**
 * DATABASE CONTRACT - COLLECTION: /contacts
 * - Document Identity: contactId is the normalized phone number prefix-protected (+91...).
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Root collection.
 * - Who Creates It: Managers on CRM view or automatically during contact import.
 * - Who Updates It: Managers on CRM view.
 * - Who Deletes It: Managers on CRM view.
 * - Authoritative/Derived: Authoritative.
 * - Client Writes Permitted: Yes, restricted to the owning tenant.
 */
export interface Contact {
  contactId: string; // Normalized phone number as unique identifier
  managerId: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  tags?: string[];
  notes?: string;
  communicationStatus?: 'subscribed' | 'unsubscribed' | 'pending';
  createdAt: string;
  updatedAt: string;
}

/**
 * DATABASE CONTRACT - COLLECTION: /groups
 * - Document Identity: groupId is a randomized UUID.
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Root collection.
 * - Who Creates It: Managers on CRM segment view.
 * - Who Updates It: Managers (adding/removing contactIds).
 * - Who Deletes It: Managers.
 * - Authoritative/Derived: Authoritative contact segment grouping.
 * - Client Writes Permitted: Yes, restricted to the owning tenant.
 */
export interface Group {
  groupId: string;
  displayId?: string;
  managerId: string;
  name: string;
  description: string;
  contactIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FinalReportSnapshot {
  generatedAt: string;
  generatedByManagerId: string;
  fundName: string;
  fundId: string;
  startDate: string;
  endedAt?: string;
  totalShares: number;
  totalCycles: number;
  totalBilled: number;
  totalCollected: number;
  totalDisbursed: number;
  totalCommission: number;
  totalArrears: number;
  totalAdvance: number;
  shares: Array<{
    shareId: string;
    shareNumber: number;
    memberName: string;
    memberPhone: string;
    status: ShareStatus;
    hasClaimedPrize: boolean;
    totalBilled: number;
    totalCredits: number;
    totalDebits: number;
    arrears: number;
    advance: number;
  }>;
  cycles: Array<{
    cycleNumber: number;
    cycleName?: string;
    startDate?: string;
    endDate?: string | null;
    netInstallmentDue: number;
    winnerNetPayout: number;
    organizerCommission: number;
    winnerMemberName?: string | null;
    isAuctionClosed: boolean;
  }>;
}

/**
 * DATABASE CONTRACT - COLLECTION: /funds
 * - Document Identity: fundId is a randomized UUID.
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Root collection.
 * - Who Creates It: Managers via NewFundWizardView.
 * - Who Updates It: Managers (editing name, frequency, status, final reports).
 * - Who Deletes It: Managers (batch deletes fund and all its child shares/cycles/billings/payouts).
 * - Authoritative/Derived: Authoritative scheme identifier.
 * - Client Writes Permitted: Yes, restricted to the owning tenant.
 */
export interface Fund {
  fundId: string;
  displayId?: string; // 6-character human ID (e.g. A1B2C3)
  managerId: string;
  fundName: string;
  totalPool: number; // in Rupees
  totalPoolPaise?: number; // integer minor units (100 paise = 1 Rupee)
  numberOfShares: number;
  totalCycles: number;
  currentCycle: number;
  cycleFrequency: 'monthly' | 'bi-weekly' | 'weekly';
  commissionPercent: number;
  startDate: string;
  reminderSchedule?: string;
  notes?: string;
  status: FundStatus;
  endedAt?: string | null;
  endedByManagerId?: string | null;
  finalReportSnapshot?: FinalReportSnapshot | null;
  auctionRuleTemplate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DATABASE CONTRACT - COLLECTION: /shares
 * - Document Identity: shareId is a randomized UUID.
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Child of /funds/{fundId} (referenced via fundId).
 * - Who Creates It: Managers on adding a member allotment.
 * - Who Updates It: Rebuilt/recalculated dynamically by rebuildMaterializedState based on billings/payments.
 * - Who Deletes It: Managers on removing allotment or fund deletion.
 * - Authoritative/Derived: Derived/materialized financial state based on authoritative payments and billings.
 * - Client Writes Permitted: Yes, restricted to the owning tenant.
 */
export interface Share {
  shareId: string;
  displayId?: string; // 6-character human ID (e.g. A1B2C3)
  managerId: string;
  fundId: string;
  contactId: string; // Canonical +91XXXXXXXXXX contact identifier
  memberName: string;
  memberPhone: string;
  shareNumber: number;
  shareCount: number;
  hasClaimedPrize: boolean;
  wonCycleNumber?: number | null;
  status: ShareStatus;
  totalBilled: number;
  totalCredits: number;
  totalDebits: number;
  arrears: number;
  advance: number;
  portalToken?: string; // Cryptographic 128-bit unguessable UUID for self-service portal
  createdAt: string;
  updatedAt: string;
}

/**
 * DATABASE CONTRACT - COLLECTION: /cycles
 * - Document Identity: cycleId is a randomized UUID.
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Child of /funds/{fundId}.
 * - Who Creates It: Managers on cycle initialization or creation.
 * - Who Updates It: Managers (setting winning bid, finalizing cycle).
 * - Who Deletes It: Managers on cycle delete or fund deletion.
 * - Authoritative/Derived: Authoritative cycle and auction rotation specification.
 * - Client Writes Permitted: Yes, restricted to the owning tenant.
 */
export interface Cycle {
  cycleId: string;
  displayId?: string;
  managerId: string;
  fundId: string;
  cycleNumber: number;
  cycleName?: string;
  startDate?: string;
  endDate?: string | null;
  auctionDate: string;
  winningBidAmount: number;
  winnerShareId?: string | null;
  winnerContactId?: string | null;
  winnerMemberName?: string | null;
  organizerCommission: number;
  dividendPool: number;
  dividendPerShare: number;
  grossInstallment: number;
  netInstallmentDue: number;
  winnerNetPayout: number;
  isAuctionClosed: boolean;
  status: CycleStatus;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt?: string;
  finalizedAt?: string | null;
}

/**
 * DATABASE CONTRACT - COLLECTION: /payments
 * - Document Identity: paymentId is a randomized UUID.
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Child of /shares/{shareId} (referenced via shareId).
 * - Who Creates It: Managers on recording a payment.
 * - Who Updates It: NEVER (immutable trial once written, ensures idempotency).
 * - Who Deletes It: NEVER (immutable financial trail).
 * - Authoritative/Derived: Authoritative credit/debit transaction log.
 * - Client Writes Permitted: Yes (create-only), restricted to the owning tenant. Update/delete are blocked.
 */
export interface Payment {
  paymentId: string;
  displayId?: string; // 6-character human ID (e.g. A1B2C3)
  managerId: string;
  fundId: string;
  contactId?: string;
  memberName?: string;
  shareId: string;
  shareNumber?: number;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  receiptFileUrl?: string;
  verificationStatus: 'verified' | 'pending' | 'flagged';
  idempotencyKey?: string;
  createdAt: string;
}

/**
 * DATABASE CONTRACT - COLLECTION: /billings
 * - Document Identity: billingId is `${managerId}_${cycleId}_${shareId}`.
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Child of /cycles/{cycleId} and /shares/{shareId}.
 * - Who Creates It: Automatically created during cycle initialization (saveCycleBills).
 * - Who Updates It: Managers (adjusting cycle bill amounts on a share).
 * - Who Deletes It: Managers on cycle delete or fund deletion.
 * - Authoritative/Derived: Authoritative billing obligation record.
 * - Client Writes Permitted: Yes, restricted to the owning tenant.
 */
export interface Billing {
  billingId: string; // `${managerId}_${cycleId}_${shareId}`
  managerId: string;
  fundId: string;
  cycleId: string;
  shareId: string;
  billAmount: number; // in Rupees
  billAmountPaise: number; // in integer Paise
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  version?: number;
}

/**
 * DATABASE CONTRACT - COLLECTION: /payouts
 * - Document Identity: payoutId is a randomized UUID.
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Child of /cycles/{cycleId} (referenced via cycleId).
 * - Who Creates It: Managers on recording a winner payout.
 * - Who Updates It: Managers (updating status/paymentMethod/reference).
 * - Who Deletes It: Managers on cycle delete or fund deletion.
 * - Authoritative/Derived: Authoritative financial disbursement event.
 * - Client Writes Permitted: Yes, restricted to the owning tenant.
 */
export interface Payout {
  payoutId: string;
  managerId: string;
  fundId: string;
  cycleId: string;
  shareId: string;
  contactId?: string;
  amount: number; // in Rupees
  amountPaise: number; // in integer Paise
  payoutDate: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  notes?: string;
  status: 'disbursed' | 'cancelled';
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  idempotencyKey?: string;
}

/**
 * DATABASE CONTRACT - COLLECTION: /ledgers
 * - Document Identity: ledgerId is `ledger_${fundId}` (for FUND_LEDGER).
 * - Tenant Ownership: Isolated by managerId == request.auth.uid.
 * - Parent Relationship: Child of /funds/{fundId}.
 * - Who Creates It: Created automatically when a Fund scheme is initialized.
 * - Who Updates It: Updated only during state rebuilds (rebuildMaterializedState) after payments/payouts changes.
 * - Who Deletes It: Managers (deleted when Fund is deleted).
 * - Authoritative/Derived: Derived/materialized ledger positions.
 * - Client Writes Permitted: Yes, but client writes are highly restricted by firestore.rules to prevent arbitrary modifications.
 */
export interface MaterializedLedger {
  ledgerId: string;
  managerId: string;
  fundId?: string;
  ledgerType: 'FUND_LEDGER' | 'MANAGER_LEDGER'; // Canonical Fund & Manager Ledgers
  totalPool: number;
  totalCollected: number;
  totalDisbursed: number;
  totalArrears: number;
  activeFundCount?: number;
  totalShares?: number;
  updatedAt: string;
}

export interface PortalTokenRecord {
  token: string;
  managerId: string;
  fundId: string;
  shareId: string;
  memberName: string;
  shareNumber: number;
  createdAt: string;
  expiresAt?: string;
}

export type CampaignTargetAudience = 'ALL' | 'MEMBERS' | 'NON_MEMBERS';
export type CampaignChannel = 'WHATSAPP' | 'SMS' | 'EMAIL';

export interface Campaign {
  campaignId: string;
  displayId?: string;
  managerId: string;
  fundId?: string;
  title: string;
  message: string;
  channels: CampaignChannel[];
  channel?: string;
  targetGroupIds?: string[];
  targetAudience?: CampaignTargetAudience;
  recipientCount: number;
  status: CampaignStatus;
  createdAt: string;
}

export interface AuditRecord {
  auditId: string;
  managerId: string;
  actorUid: string;
  action: string;
  entityType: 'FUND' | 'CYCLE' | 'SHARE' | 'PAYMENT' | 'DRAW' | 'CONTACT';
  entityId: string;
  timestamp: string;
  createdAt?: any;
  reason?: string;
  beforeState?: string;
  afterState?: string;
  operationId?: string;
  
  // Draw Operation Specifics
  fundId?: string;
  shareId?: string;
  previousDrawStatus?: string;
  newDrawStatus?: string;
  previousDrawCycleId?: string | null;
  newDrawCycleId?: string | null;
  previousPayoutAmount?: number;
  newPayoutAmount?: number;
  billingChanges?: string;
  affectedCycles?: string;
  operationType?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursorDoc: any;
  hasMore: boolean;
}

export interface ImpactAnalysisResult {
  conflictingShare?: Share | null;
  affectedCycles: number[];
  grossInstallment: number;
  oldDividendPerShare: number;
  newDividendPerShare: number;
  oldNetPayable: number;
  newNetPayable: number;
  netVariancePerShare: number;
  affectedShareCount: number;
  canProceed: boolean;
  warnings: string[];
}

export * from './communication';
