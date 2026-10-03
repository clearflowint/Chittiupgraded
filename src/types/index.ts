export type FundStatus = 'draft' | 'active' | 'auction_pending' | 'completed' | 'ended';
export type ShareStatus = 'undrawn' | 'drawn' | 'defaulted';
export type CycleStatus = 'upcoming' | 'bidding' | 'finalized';
export type PaymentMethod = 'UPI' | 'Bank' | 'Cash';
export type CampaignStatus = 'draft' | 'queued' | 'sent';

export interface Tenant {
  managerId: string;
  authUid: string;
  name: string;
  email: string;
  phone: string;
  currency: string;
  defaultCommissionPercent: number;
  createdAt: string;
  status: 'active' | 'suspended';
}

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

export interface Group {
  groupId: string;
  displayId?: string;
  managerId: string;
  name: string;
  description: string;
  memberIds?: string[];
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
    totalPaid: number;
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

export interface Fund {
  fundId: string;
  displayId?: string; // 4-digit human ID (e.g. CF-2041)
  managerId: string;
  fundName: string;
  totalPool: number; // in Rupees
  totalPoolPaise?: number; // integer minor units (100 paise = 1 Rupee)
  numberOfShares: number;
  totalMonths: number;
  currentMonth: number;
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
  totalCycles?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Share {
  shareId: string;
  displayId?: string; // 4-digit human ID (e.g. SH-0104)
  managerId: string;
  fundId: string;
  memberId: string; // references Contact
  contactId?: string; // Explicit reference to Contact for CRM linking
  memberName: string;
  memberPhone: string;
  shareNumber: number;
  shareCount: number;
  hasClaimedPrize: boolean;
  status: ShareStatus;
  wonMonth?: number | null;
  wonCycleId?: string | null;
  portalToken?: string;
  totalBilled: number;
  totalPaid: number;
  arrears: number;
  advance: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cycle {
  cycleId: string;
  fundId: string;
  managerId: string;
  cycleNumber: number;
  cycleName?: string;
  startDate?: string;
  endDate?: string | null;
  monthIndex: number;
  auctionDate: string;
  winningBidAmount: number;
  winnerShareId?: string | null;
  winnerMemberId?: string | null;
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
  finalizedAt?: string | null;
}

export interface Payment {
  paymentId: string;
  displayId?: string; // 4-digit human ID (e.g. PAY-9821)
  managerId: string;
  fundId: string;
  memberId: string;
  memberName?: string;
  shareId: string;
  shareNumber?: number;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  receiptFileUrl?: string;
  verificationStatus: 'verified' | 'pending' | 'flagged';
  idempotencyKey?: string;
  createdAt: string;
}

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

export interface Payout {
  payoutId: string;
  managerId: string;
  fundId: string;
  cycleId: string;
  shareId: string;
  memberId?: string;
  memberName?: string;
  amount: number;
  status: 'pending' | 'disbursed' | 'cancelled';
  payoutDate: string;
  paymentMethod: PaymentMethod;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface AuditLog {
  auditId: string;
  managerId: string;
  action: string;
  actorUid?: string;
  actorName?: string;
  entityType: 'fund' | 'share' | 'cycle' | 'billing' | 'payment' | 'payout' | 'campaign' | 'contact' | 'group' | 'auth';
  entityId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface Campaign {
  campaignId: string;
  displayId?: string;
  managerId: string;
  fundId?: string;
  title: string;
  message: string;
  channels: string[];
  channel?: string;
  targetGroupIds?: string[];
  targetAudience?: string;
  recipientCount: number;
  status: CampaignStatus;
  createdAt: string;
}

export interface AcknowledgementState {
  isOpen: boolean;
  isSuccess: boolean;
  title: string;
  message: string;
  operationType: string;
  referenceId: string;
  ackTime: string;
}
