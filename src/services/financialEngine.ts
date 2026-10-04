/**
 * FinancialEngine — Authoritative Universal Financial Core & Chitti Domain Mathematics
 */

export interface FinancialState {
  totalBilled: number;
  totalCredits: number;
  totalDebits: number;
  arrears: number;
  advance: number;
}

export type FinancialEvent = 
  | { type: 'BILLING'; amount: number; timestamp: string | number }
  | { type: 'CREDIT'; amount: number; timestamp: string | number }
  | { type: 'DEBIT'; amount: number; timestamp: string | number };

export class UniversalFinancialCore {
  static toPaise(rupees: number): number {
    if (typeof rupees !== 'number' || isNaN(rupees)) return 0;
    return Math.round(rupees * 100);
  }

  static toRupees(paise: number): number {
    if (typeof paise !== 'number' || isNaN(paise)) return 0;
    return Math.round(paise) / 100;
  }

  /**
   * Authoritative reconciliation logic for a single financial event.
   * Implements Phase 2B.2 rules:
   * 1. Billing NEVER consumes Advance.
   * 2. Credit reduces Arrears first, then increases Advance.
   * 3. Debit reduces Advance first, then increases Arrears.
   */
  static calculateNextState(
    currentState: FinancialState,
    event: { type: 'BILLING' | 'CREDIT' | 'DEBIT'; amount: number }
  ): FinancialState {
    const newState = { ...currentState };
    const amountPaise = this.toPaise(event.amount);
    
    if (event.type === 'BILLING') {
      newState.totalBilled = this.toRupees(this.toPaise(newState.totalBilled) + amountPaise);
      newState.arrears = this.toRupees(this.toPaise(newState.arrears) + amountPaise);
    } else if (event.type === 'CREDIT') {
      newState.totalCredits = this.toRupees(this.toPaise(newState.totalCredits) + amountPaise);
      const arrearsPaise = this.toPaise(newState.arrears);
      const appliedPaise = Math.min(amountPaise, arrearsPaise);
      const excessPaise = amountPaise - appliedPaise;
      
      newState.arrears = this.toRupees(arrearsPaise - appliedPaise);
      newState.advance = this.toRupees(this.toPaise(newState.advance) + excessPaise);
    } else if (event.type === 'DEBIT') {
      newState.totalDebits = this.toRupees(this.toPaise(newState.totalDebits) + amountPaise);
      const advancePaise = this.toPaise(newState.advance);
      const deductFromAdvancePaise = Math.min(amountPaise, advancePaise);
      const remainingDebitPaise = amountPaise - deductFromAdvancePaise;
      
      newState.advance = this.toRupees(advancePaise - deductFromAdvancePaise);
      newState.arrears = this.toRupees(this.toPaise(newState.arrears) + remainingDebitPaise);
    }
    
    return newState;
  }

  /**
   * Authoritative rebuilder that reconstructs state from a chronological event stream.
   */
  static rebuildState(events: FinancialEvent[]): FinancialState {
    // Sort events by timestamp to ensure deterministic replay
    const sortedEvents = [...events].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      if (timeA !== timeB) return timeA - timeB;
      
      // Tie-breaker: Billing happens before Payment if timestamps are identical
      const priority = { 'BILLING': 1, 'CREDIT': 2, 'DEBIT': 3 };
      return priority[a.type] - priority[b.type];
    });

    let state: FinancialState = {
      totalBilled: 0,
      totalCredits: 0,
      totalDebits: 0,
      arrears: 0,
      advance: 0
    };

    for (const event of sortedEvents) {
      state = this.calculateNextState(state, event);
    }

    return state;
  }

  /**
   * Verify double-entry and mathematical integrity across a Fund's shares, billings, payments, and payouts.
   */
  static verifyFundIntegrity(params: {
    fundTotalPool: number;
    shares: Array<{ totalCredits: number; totalDebits: number; arrears: number; advance: number; totalBilled: number }>;
    billings: Array<{ billAmount: number }>;
    payments: Array<{ amount: number; type?: string }>;
    payouts: Array<{ amount: number; status: string }>;
  }): {
    isValid: boolean;
    discrepancies: string[];
    reconciledCollected: number;
    reconciledDisbursed: number;
    reconciledBilled: number;
    reconciledArrears: number;
    reconciledAdvance: number;
    netLiquidity: number;
  } {
    const discrepancies: string[] = [];

    // Sum payments
    const totalPaymentsCollected = params.payments.reduce((sum, p) => {
      const type = (p.type || 'CREDIT').toUpperCase();
      return type === 'CREDIT' ? sum + p.amount : sum - p.amount;
    }, 0);

    // Sum share credits - debits
    const totalShareNetPaid = params.shares.reduce(
      (sum, s) => sum + (s.totalCredits - s.totalDebits),
      0
    );

    if (Math.abs(this.toPaise(totalPaymentsCollected) - this.toPaise(totalShareNetPaid)) > 1) {
      discrepancies.push(
        `Discrepancy in collections: payments sum to ₹${totalPaymentsCollected}, but shares sum to ₹${totalShareNetPaid}`
      );
    }

    // Sum billings
    const totalBillingsAmount = params.billings.reduce((sum, b) => sum + b.billAmount, 0);
    const totalShareBilled = params.shares.reduce((sum, s) => sum + s.totalBilled, 0);

    if (Math.abs(this.toPaise(totalBillingsAmount) - this.toPaise(totalShareBilled)) > 1) {
      discrepancies.push(
        `Discrepancy in billing: billing docs sum to ₹${totalBillingsAmount}, but shares sum to ₹${totalShareBilled}`
      );
    }

    // Sum payouts
    const totalDisbursed = params.payouts
      .filter((p) => p.status === 'disbursed')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalArrears = params.shares.reduce((sum, s) => sum + (s.arrears || 0), 0);
    const totalAdvance = params.shares.reduce((sum, s) => sum + (s.advance || 0), 0);
    const netLiquidity = totalPaymentsCollected - totalDisbursed;

    return {
      isValid: discrepancies.length === 0,
      discrepancies,
      reconciledCollected: totalPaymentsCollected,
      reconciledDisbursed: totalDisbursed,
      reconciledBilled: totalBillingsAmount,
      reconciledArrears: totalArrears,
      reconciledAdvance: totalAdvance,
      netLiquidity,
    };
  }
}

export class ChittiDomainModule {
  static calculateCycleAuction(params: {
    totalPool: number;
    numberOfShares: number;
    winningBidAmount: number;
    commissionPercent?: number;
  }): {
    grossInstallment: number;
    organizerCommission: number;
    dividendPool: number;
    dividendPerShare: number;
    netInstallmentDue: number;
    winnerNetPayout: number;
  } {
    const { totalPool, numberOfShares, winningBidAmount, commissionPercent = 5 } = params;
    const grossInstallment = numberOfShares > 0 ? Math.round(totalPool / numberOfShares) : 0;
    const organizerCommission = Math.round((totalPool * commissionPercent) / 100);
    const dividendPool = Math.max(0, winningBidAmount - organizerCommission);
    const dividendPerShare = numberOfShares > 0 ? Math.floor(dividendPool / numberOfShares) : 0;
    const netInstallmentDue = Math.max(0, grossInstallment - dividendPerShare);
    const winnerNetPayout = Math.max(0, totalPool - winningBidAmount);

    return {
      grossInstallment,
      organizerCommission,
      dividendPool,
      dividendPerShare,
      netInstallmentDue,
      winnerNetPayout,
    };
  }
}

export class FinancialEngine {
  static toPaise(rupees: number): number {
    return UniversalFinancialCore.toPaise(rupees);
  }

  static toRupees(paise: number): number {
    return UniversalFinancialCore.toRupees(paise);
  }

  static formatCurrency(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || isNaN(amount)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  static formatNumber(amount: number | undefined | null): string {
    if (amount === undefined || amount === null || isNaN(amount)) return '0';
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0,
    }).format(amount);
  }

  static generateCryptoToken(bytes: number = 8): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(bytes);
      window.crypto.getRandomValues(array);
      return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  static generateRandomHumanDisplayId(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buffer = new Uint8Array(6);
      crypto.getRandomValues(buffer);
      const l1 = letters.charAt(buffer[0] % letters.length);
      const n1 = numbers.charAt(buffer[1] % numbers.length);
      const l2 = letters.charAt(buffer[2] % letters.length);
      const n2 = numbers.charAt(buffer[3] % numbers.length);
      const l3 = letters.charAt(buffer[4] % letters.length);
      const n3 = numbers.charAt(buffer[5] % numbers.length);
      return `${l1}${n1}${l2}${n2}${l3}${n3}`;
    }

    const l1 = letters.charAt(Math.floor(Math.random() * letters.length));
    const n1 = numbers.charAt(Math.floor(Math.random() * numbers.length));
    const l2 = letters.charAt(Math.floor(Math.random() * letters.length));
    const n2 = numbers.charAt(Math.floor(Math.random() * numbers.length));
    const l3 = letters.charAt(Math.floor(Math.random() * letters.length));
    const n3 = numbers.charAt(Math.floor(Math.random() * numbers.length));
    return `${l1}${n1}${l2}${n2}${l3}${n3}`;
  }

  static generateHumanId(): string {
    return this.generateRandomHumanDisplayId();
  }

  static generateDisplayId(prefix: string): string {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomNum}`;
  }

  static calculateCycle(params: {
    totalPool: number;
    numberOfShares?: number;
    winningBidAmount: number;
    commissionPercent?: number;
    totalCycles?: number;
    totalShares?: number;
  }) {
    // Some calls might use totalShares as alias for numberOfShares
    const finalNumberOfShares = params.totalShares !== undefined ? params.totalShares : params.numberOfShares;
    
    // If totalCycles is provided, it's used for gross installment calculation
    // otherwise fallback to numberOfShares (standard for ROSCA where cycles == shares)
    const cycleCount = params.totalCycles;
    const divisor = cycleCount && cycleCount > 0 ? cycleCount : finalNumberOfShares;
    
    const result = ChittiDomainModule.calculateCycleAuction({
      totalPool: params.totalPool,
      numberOfShares: divisor,
      winningBidAmount: params.winningBidAmount,
      commissionPercent: params.commissionPercent
    });

    return {
      ...result,
      // Ensure we use the correct divisor for dividend per share which IS always numberOfShares
      dividendPerShare: finalNumberOfShares > 0 ? Math.floor(result.dividendPool / finalNumberOfShares) : 0
    };
  }

  static getLatestCycleReminder(fund: any, cycles: any[]) {
     const isEnded = fund.status === 'ended';
     const fundCycles = cycles.filter(c => c.fundId === fund.fundId).sort((a, b) => a.cycleNumber - b.cycleNumber);
     
     if (isEnded) {
       return { 
         reminderSourceCycleNumber: fundCycles.length, 
         reminderSourceCycleName: fundCycles.length > 0 ? fundCycles[fundCycles.length-1].cycleName : 'Finalized',
         endDate: null, 
         isEnded: true, 
         message: 'Chitti Ended' 
       };
     }
     
     if (fundCycles.length === 0) {
       return { 
         reminderSourceCycleNumber: 0, 
         reminderSourceCycleName: 'Initial State',
         endDate: fund.startDate, 
         isEnded: false, 
         message: 'Awaiting first auction' 
       };
     }
     
     const latest = fundCycles[fundCycles.length - 1];
     return {
       reminderSourceCycleNumber: latest.cycleNumber,
       reminderSourceCycleName: latest.cycleName,
       endDate: latest.endDate || latest.auctionDate,
       isEnded: false,
       message: null
     };
  }
}
