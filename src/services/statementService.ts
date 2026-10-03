import { Fund, Share, Cycle, Billing, Payment } from '../types';
import { FinancialEngine } from './financialEngine';
import { WebhookStatement } from '../types/communication';

export interface ShareStatementData {
  fundName: string;
  fundStartDate: string;
  shareDisplayId: string;
  shareNumber: number;
  memberName: string;
  memberPhone: string;
  managerName: string;
  managerPhone: string;
  currentCycle: number | null;
  totalCycles: number | null;
  currentStatus: string;
  pendingAmount: number;
  advanceAmount: number;
  totalBilled: number;
  totalPaid: number;
  billingHistory: Array<{
    cycleNumber: number;
    billAmount: number;
    billingDate: string;
  }>;
  paymentHistory: Array<{
    paymentId: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    reference?: string;
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
  const {
    share,
    fund,
    cycles,
    billings,
    payments,
    managerName = 'Operations Manager',
    managerPhone = '',
  } = params;

  // Filter billings for this share and fund
  const shareBillings = billings
    .filter((b) => b.shareId === share.shareId && b.fundId === fund.fundId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const billingHistory = shareBillings.map((b) => {
    const matchedCycle = cycles.find((c) => c.cycleId === b.cycleId);
    return {
      cycleNumber: matchedCycle ? matchedCycle.cycleNumber : 0,
      billAmount: b.billAmount,
      billingDate: b.createdAt,
    };
  });

  // Filter payments for this share (payments are strictly share-level)
  const sharePayments = payments
    .filter((p) => p.shareId === share.shareId && p.fundId === fund.fundId)
    .sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime());

  const paymentHistory = sharePayments.map((p) => ({
    paymentId: p.displayId || p.paymentId,
    amount: p.amount,
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate,
    reference: p.reference,
  }));

  const totalBilled = shareBillings.reduce((sum, b) => sum + b.billAmount, 0);
  const totalPaid = sharePayments.reduce((sum, p) => sum + p.amount, 0);

  const balance = FinancialEngine.resolveBalance(totalBilled, totalPaid);
  const pendingAmount = balance.arrears;
  const advanceAmount = balance.advance;

  let currentStatus = 'Up to date';
  if (pendingAmount > 0) {
    currentStatus = `Pending ${FinancialEngine.formatCurrency(pendingAmount)}`;
  } else if (advanceAmount > 0) {
    currentStatus = `Advance ${FinancialEngine.formatCurrency(advanceAmount)}`;
  }

  const shareDisplayId = share.displayId || `SH-${String(share.shareNumber).padStart(4, '0')}`;
  const currentCycle = fund.currentMonth || null;
  const totalCycles = fund.totalMonths > 0 ? fund.totalMonths : null;
  const statementGeneratedAt = new Date().toISOString();

  const cycleProgress = totalCycles ? `${currentCycle || 1} / ${totalCycles}` : `${currentCycle || 1}`;

  const personalizedTextMessage = `Hello ${share.memberName},\n\nShare ID: ${shareDisplayId}\nMember: ${share.memberName}\nChitti: ${fund.fundName}\nManager: ${managerName}\n\nCurrent Status: ${currentStatus}\nCycle: ${cycleProgress}\n\nThank you for your continued association with us.`;

  return {
    fundName: fund.fundName,
    fundStartDate: fund.startDate,
    shareDisplayId,
    shareNumber: share.shareNumber,
    memberName: share.memberName,
    memberPhone: share.memberPhone,
    managerName,
    managerPhone,
    currentCycle,
    totalCycles,
    currentStatus: pendingAmount > 0 ? 'Pending' : advanceAmount > 0 ? 'Advance' : 'Up to date',
    pendingAmount,
    advanceAmount,
    totalBilled,
    totalPaid,
    billingHistory,
    paymentHistory,
    statementGeneratedAt,
    personalizedTextMessage,
  };
}

export function buildWebhookStatementObject(data: ShareStatementData): WebhookStatement {
  return {
    available: true,
    shareId: data.shareDisplayId,
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
