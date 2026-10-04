/**
 * impactEngine — Real-time Financial Metrics & Health Calculations
 */

import { Fund, Share, Cycle, Billing, Payment, Payout, ImpactAnalysisResult, AuditRecord } from '../types';
import { FinancialEngine, UniversalFinancialCore, FinancialEvent } from './financialEngine';

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

export interface AuthoritativeReconciliationPlan {
  updatedCycles: Cycle[];
  updatedShares: Share[];
  revertedWinnerShare: Share | null;
  newWinnerShare: Share | null;
  auditPayload: Omit<AuditRecord, 'auditId' | 'createdAt'>;
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
    // Net financial activity (Credits - Debits)
    const totalCollected = fundPayments.reduce((sum, p) => {
      const type = p.type || 'CREDIT';
      return type === 'CREDIT' ? sum + p.amount : sum - p.amount;
    }, 0);
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

  static analyzeDrawChange(
    fund: Fund,
    cycles: Cycle[],
    targetCycle: Cycle,
    targetShare: Share,
    allShares: Share[],
    proposedBidAmount: number
  ): ImpactAnalysisResult {
    const warnings: string[] = [];

    // 1. Conflict Detection
    let conflictingShare: Share | null = null;
    if (targetCycle.winnerShareId && targetCycle.winnerShareId !== targetShare.shareId) {
      conflictingShare = allShares.find((s) => s.shareId === targetCycle.winnerShareId) || null;
      if (conflictingShare) {
        warnings.push(
          `Conflict Detected: Share #${conflictingShare.shareNumber} (${conflictingShare.memberName}) is Winner for Cycle #${targetCycle.cycleNumber}. It will be reverted.`
        );
      }
    }

    // 2. Multi-win check
    const wonCycle = targetShare.wonCycleNumber;
    if (targetShare.hasClaimedPrize && wonCycle && wonCycle !== targetCycle.cycleNumber) {
      warnings.push(
        `Critical: Share #${targetShare.shareNumber} already won Cycle #${wonCycle}.`
      );
    }

    // 3. Calculation
    const fundTotalCycles = fund.totalCycles;
    const oldCalc = FinancialEngine.calculateCycle({
      totalPool: fund.totalPool,
      totalCycles: fundTotalCycles,
      numberOfShares: fund.numberOfShares,
      winningBidAmount: targetCycle.winningBidAmount || 0,
      commissionPercent: fund.commissionPercent,
    });

    const newCalc = FinancialEngine.calculateCycle({
      totalPool: fund.totalPool,
      totalCycles: fundTotalCycles,
      numberOfShares: fund.numberOfShares,
      winningBidAmount: proposedBidAmount,
      commissionPercent: fund.commissionPercent,
    });

    const affectedCycles = cycles
      .filter((c) => c.fundId === fund.fundId && c.cycleNumber >= targetCycle.cycleNumber)
      .map((c) => c.cycleNumber);

    const variance = newCalc.netInstallmentDue - oldCalc.netInstallmentDue;
    const canProceed = !targetShare.hasClaimedPrize || wonCycle === targetCycle.cycleNumber;

    return {
      conflictingShare,
      affectedCycles,
      grossInstallment: newCalc.grossInstallment,
      oldDividendPerShare: oldCalc.dividendPerShare,
      newDividendPerShare: newCalc.dividendPerShare,
      oldNetPayable: oldCalc.netInstallmentDue,
      newNetPayable: newCalc.netInstallmentDue,
      netVariancePerShare: variance,
      affectedShareCount: fund.numberOfShares,
      canProceed,
      warnings,
    };
  }

  static buildReconciliationPlan(params: {
    fund: Fund;
    cycles: Cycle[];
    targetCycle: Cycle;
    targetShare: Share;
    allShares: Share[];
    billings: Billing[];
    payments: Payment[]; // Added payments to support stateful rebuild
    action: 'SET_DRAWN' | 'SET_UNDRAWN';
    proposedBidAmount: number;
    reason: string;
    actorUid: string;
  }): AuthoritativeReconciliationPlan & { updatedBillings: Billing[] } {
    const { fund, cycles, targetCycle, targetShare, allShares, billings, payments, action, proposedBidAmount, reason, actorUid } = params;

    const updatedCycles: Cycle[] = [];
    const updatedShares: Share[] = [];
    const updatedBillings: Billing[] = [];

    // 1. Determine Reversions and New Statuses
    let revertedWinnerShare: Share | null = null;
    let newWinnerShare: Share | null = null;

    if (action === 'SET_UNDRAWN') {
      revertedWinnerShare = {
        ...targetShare,
        hasClaimedPrize: false,
        wonCycleNumber: null,
        status: 'undrawn',
        updatedAt: new Date().toISOString()
      };
    } else {
      // SET_DRAWN
      // If there was a previous winner for this cycle, revert them
      if (targetCycle.winnerShareId && targetCycle.winnerShareId !== targetShare.shareId) {
        const conflicting = allShares.find(s => s.shareId === targetCycle.winnerShareId);
        if (conflicting) {
          revertedWinnerShare = {
            ...conflicting,
            hasClaimedPrize: false,
            wonCycleNumber: null,
            status: 'undrawn',
            updatedAt: new Date().toISOString()
          };
        }
      }

      newWinnerShare = {
        ...targetShare,
        hasClaimedPrize: true,
        wonCycleNumber: targetCycle.cycleNumber,
        status: 'drawn',
        updatedAt: new Date().toISOString()
      };
    }

    // 2. Affected Cycles & Billings Reconciliation
    const fundCycles = cycles
      .filter(c => c.fundId === fund.fundId)
      .sort((a, b) => a.cycleNumber - b.cycleNumber);

    const affectedCycleNumbers = fundCycles
      .filter(c => c.cycleNumber >= targetCycle.cycleNumber)
      .map(c => c.cycleNumber);

    for (const c of fundCycles) {
      const isTarget = c.cycleId === targetCycle.cycleId;
      const bid = isTarget ? (action === 'SET_UNDRAWN' ? 0 : proposedBidAmount) : (c.winningBidAmount || 0);
      const isClosed = isTarget ? (action === 'SET_DRAWN') : c.isAuctionClosed;
      
      const calc = FinancialEngine.calculateCycle({
        totalPool: fund.totalPool,
        totalCycles: fund.totalCycles,
        numberOfShares: fund.numberOfShares,
        winningBidAmount: bid,
        commissionPercent: fund.commissionPercent
      });

      if (affectedCycleNumbers.includes(c.cycleNumber)) {
        const updatedCycle: Cycle = {
          ...c,
          winningBidAmount: bid,
          winnerShareId: isTarget ? (action === 'SET_UNDRAWN' ? '' : targetShare.shareId) : c.winnerShareId,
          winnerContactId: isTarget ? (action === 'SET_UNDRAWN' ? '' : targetShare.contactId) : c.winnerContactId,
          winnerMemberName: isTarget ? (action === 'SET_UNDRAWN' ? '' : targetShare.memberName) : c.winnerMemberName,
          isAuctionClosed: isClosed,
          status: isClosed ? 'finalized' : (c.cycleNumber <= fund.currentCycle ? 'bidding' : 'upcoming'),
          ...calc,
          updatedAt: new Date().toISOString()
        };
        updatedCycles.push(updatedCycle);

        // Update authoritative Billing records for this cycle
        const existingBillings = billings.filter(b => b.cycleId === c.cycleId);
        for (const b of existingBillings) {
          updatedBillings.push({
            ...b,
            billAmount: calc.netInstallmentDue,
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    // 3. Global Share Reconciliation (Source of Truth: Authoritative Event Stream)
    const fundShares = allShares.filter(s => s.fundId === fund.fundId);
    
    for (const s of fundShares) {
      let baseShare = s;
      if (newWinnerShare && s.shareId === newWinnerShare.shareId) {
        baseShare = newWinnerShare;
      } else if (revertedWinnerShare && s.shareId === revertedWinnerShare.shareId) {
        baseShare = revertedWinnerShare;
      }

      const shareBillings = billings.filter(b => b.shareId === s.shareId);
      const sharePayments = payments.filter(p => p.shareId === s.shareId);

      const events: FinancialEvent[] = [
        ...shareBillings.map(b => {
          const updatedB = updatedBillings.find(ub => ub.billingId === b.billingId);
          return { type: 'BILLING' as const, amount: updatedB ? updatedB.billAmount : b.billAmount, timestamp: b.createdAt };
        }),
        ...sharePayments.map(p => ({
          type: (p.type || 'CREDIT') as 'CREDIT' | 'DEBIT',
          amount: p.amount,
          timestamp: p.paymentDate
        }))
      ];

      const rebuiltState = UniversalFinancialCore.rebuildState(events);

      updatedShares.push({
        ...baseShare,
        ...rebuiltState,
        updatedAt: new Date().toISOString()
      });
    }

    return {
      updatedCycles,
      updatedShares,
      updatedBillings,
      revertedWinnerShare,
      newWinnerShare,
      auditPayload: {
        managerId: fund.managerId,
        actorUid,
        action: 'DRAW_RECONCILIATION',
        entityType: 'DRAW',
        entityId: targetCycle.cycleId,
        timestamp: new Date().toISOString(),
        reason
      }
    };
  }
}
