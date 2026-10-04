import { Fund, Share, Cycle, Billing, Payment, Payout } from '../types';
import { FinancialEngine, UniversalFinancialCore, FinancialEvent } from './financialEngine';
import { WebhookStatement } from '../types/communication';

export interface ShareStatementData {
  fundName: string;
  fundStartDate: string | null;
  shareDisplayId: string;
  shareId: string;
  shareNumber: number;
  memberName: string;
  memberPhone: string;
  managerName: string;
  managerPhone: string;
  
  // Dynamic Cycle progress
  cyclesCompleted: number;
  currentCycle: number | null;
  totalCycles: number | null;
  cyclesLeft: number | null;
  
  // Current Financial Position
  totalBilled: number;
  totalPaid: number;
  totalCredits: number;
  totalDebits: number;
  pendingAmount: number;
  advanceAmount: number;
  currentStatus: 'Pending' | 'Advance' | 'Up to date';
  statusSummaryText: string;

  // Billing History
  billingHistory: Array<{
    billingId: string;
    cycleId: string;
    cycleNumber: number;
    cycleName: string | null;
    billAmount: number;
    createdAt: string;
  }>;

  // Financial Activity
  financialActivity: Array<{
    paymentId: string;
    displayId?: string;
    date: string;
    type: string;
    amount: number;
    paymentMethod: string;
    reference: string;
    notes: string;
    verificationStatus: string;
  }>;

  statementGeneratedAt: string;
  personalizedTextMessage: string;
}

export function generateShareStatement(params: {
  share: Share;
  fund: Fund;
  cycles: Cycle[];
  billings: Billing[];
  payments: Payment[];
  managerName?: string;
  managerPhone?: string;
}): ShareStatementData {
  const { share, fund, cycles, billings, payments, managerName = 'Operations Manager', managerPhone = '' } = params;

  const fundCycles = cycles
    .filter((c) => c.fundId === fund.fundId)
    .sort((a, b) => a.cycleNumber - b.cycleNumber);

  const highestCycleNum = fundCycles.length > 0 
    ? Math.max(...fundCycles.map((c) => c.cycleNumber)) 
    : null;

  const fundTotalCycles = fund.totalCycles;
  const totalCycles = typeof fundTotalCycles === 'number' && fundTotalCycles > 0 ? fundTotalCycles : null;

  const cyclesCompleted = fundCycles.filter(c => c.isAuctionClosed).length;
  const cyclesLeft = totalCycles !== null 
    ? Math.max(0, totalCycles - cyclesCompleted) 
    : null;

  // Filter billings for this share
  const shareBillings = billings
    .filter((b) => b.shareId === share.shareId && b.fundId === fund.fundId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const billingHistory = shareBillings.map((b) => {
    const matchedCycle = cycles.find((c) => c.cycleId === b.cycleId);
    return {
      billingId: b.billingId,
      cycleId: b.cycleId,
      cycleNumber: matchedCycle ? matchedCycle.cycleNumber : 0,
      cycleName: matchedCycle ? (matchedCycle.cycleName || `Cycle ${matchedCycle.cycleNumber}`) : 'Unknown',
      billAmount: b.billAmount,
      createdAt: b.createdAt,
    };
  });

  const sharePayments = payments
    .filter((p) => p.shareId === share.shareId && p.fundId === fund.fundId)
    .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

  const financialActivity = sharePayments.map((p) => ({
    paymentId: p.paymentId,
    displayId: p.displayId,
    date: p.paymentDate,
    type: p.type || 'CREDIT',
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    reference: p.reference || '',
    notes: p.notes || '',
    verificationStatus: p.verificationStatus,
  }));

  // Stateful Reconciliation (Phase 2B.2)
  const events: FinancialEvent[] = [
    ...shareBillings.map(b => ({ type: 'BILLING' as const, amount: b.billAmount, timestamp: b.createdAt })),
    ...sharePayments.map(p => ({ 
      type: (p.type || 'CREDIT') as 'CREDIT' | 'DEBIT', 
      amount: p.amount, 
      timestamp: p.paymentDate 
    }))
  ];

  const rebuiltState = UniversalFinancialCore.rebuildState(events);
  const pendingAmount = rebuiltState.arrears;
  const advanceAmount = rebuiltState.advance;

  let currentStatusText = 'Up to date';
  if (pendingAmount > 0) {
    currentStatusText = `Pending ₹${FinancialEngine.formatNumber(pendingAmount)}`;
  } else if (advanceAmount > 0) {
    currentStatusText = `Advance ₹${FinancialEngine.formatNumber(advanceAmount)}`;
  }

  const shareDisplayId = share.displayId || `SH-${String(share.shareNumber).padStart(4, '0')}`;
  const currentCycle = highestCycleNum;
  const statementGeneratedAt = new Date().toISOString();

  const statusSummaryText = currentStatusText;

  const cycleProgress = totalCycles ? `${cyclesCompleted} / ${totalCycles}` : `${cyclesCompleted}`;
  const personalizedTextMessage = `Hello ${share.memberName},\n\nShare ID: ${shareDisplayId}\nFund: ${fund.fundName}\nStatus: ${currentStatusText}\nCycle: ${cycleProgress}\n\nThank you for your continued association with us.`;

  return {
    fundName: fund.fundName,
    fundStartDate: fund.startDate,
    shareDisplayId,
    shareId: share.shareId,
    shareNumber: share.shareNumber,
    memberName: share.memberName,
    memberPhone: share.memberPhone,
    managerName,
    managerPhone,
    cyclesCompleted,
    currentCycle,
    totalCycles,
    cyclesLeft,
    totalBilled: rebuiltState.totalBilled,
    totalPaid: rebuiltState.totalCredits - rebuiltState.totalDebits,
    totalCredits: rebuiltState.totalCredits,
    totalDebits: rebuiltState.totalDebits,
    pendingAmount,
    advanceAmount,
    currentStatus: pendingAmount > 0 ? 'Pending' : advanceAmount > 0 ? 'Advance' : 'Up to date',
    statusSummaryText,
    billingHistory,
    financialActivity,
    statementGeneratedAt,
    personalizedTextMessage,
  };
}

export function buildWebhookStatementObject(data: ShareStatementData): WebhookStatement {
  return {
    available: true,
    shareId: data.shareId,
    memberName: data.memberName,
    fundName: data.fundName,
    managerName: data.managerName,
    currentStatus: data.currentStatus,
    pendingAmount: data.pendingAmount,
    advanceAmount: data.advanceAmount,
    currentCycle: data.currentCycle,
    totalCycles: data.totalCycles,
    statementGeneratedAt: data.statementGeneratedAt,
  };
}
