/**
 * impactEngine — Real-time Financial Metrics & Health Calculations
 */

import { Fund, Share, Cycle, Billing, Payment, Payout } from '../types';
import { FinancialEngine } from './financialEngine';

export interface FundImpactMetrics {
  totalPool: number;
  totalCollected: number;
  totalBilled: number;
  totalDisbursed: number;
  totalArrears: number;
  totalAdvance: number;
  collectionRate: number; // percentage
  activeMembersCount: number;
  completedCyclesCount: number;
  estimatedCommission: number;
}

export class ImpactEngine {
  static calculateFundMetrics(params: {
    fund: Fund;
    shares: Share[];
    cycles: Cycle[];
    billings: Billing[];
    payments: Payment[];
    payouts: Payout[];
  }): FundImpactMetrics {
    const { fund, shares, cycles, billings, payments, payouts } = params;

    const fundShares = shares.filter((s) => s.fundId === fund.fundId);
    const fundBillings = billings.filter((b) => b.fundId === fund.fundId);
    const fundPayments = payments.filter((p) => p.fundId === fund.fundId);
    const fundPayouts = payouts.filter((p) => p.fundId === fund.fundId && p.status === 'disbursed');

    const totalBilled = fundBillings.reduce((sum, b) => sum + b.billAmount, 0);
    const totalCollected = fundPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalDisbursed = fundPayouts.reduce((sum, p) => sum + p.amount, 0);

    const totalArrears = fundShares.reduce((sum, s) => sum + (s.arrears || 0), 0);
    const totalAdvance = fundShares.reduce((sum, s) => sum + (s.advance || 0), 0);

    const collectionRate = totalBilled > 0 ? Math.min(100, Math.round((totalCollected / totalBilled) * 100)) : 100;
    const completedCyclesCount = cycles.filter((c) => c.fundId === fund.fundId && c.isAuctionClosed).length;
    const estimatedCommission = Math.round((fund.totalPool * fund.commissionPercent) / 100) * completedCyclesCount;

    return {
      totalPool: fund.totalPool,
      totalCollected,
      totalBilled,
      totalDisbursed,
      totalArrears,
      totalAdvance,
      collectionRate,
      activeMembersCount: fundShares.length,
      completedCyclesCount,
      estimatedCommission,
    };
  }
}
