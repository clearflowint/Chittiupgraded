/**
 * FinancialEngine — Authoritative Universal Financial Core & Chitti Domain Mathematics
 */

export class UniversalFinancialCore {
  static toPaise(rupees: number): number {
    if (typeof rupees !== 'number' || isNaN(rupees)) return 0;
    return Math.round(rupees * 100);
  }

  static toRupees(paise: number): number {
    if (typeof paise !== 'number' || isNaN(paise)) return 0;
    return Math.round(paise) / 100;
  }

  static resolveBalance(
    totalBilled: number,
    totalPaid: number
  ): { arrears: number; advance: number; balanceRupees: number; balancePaise: number } {
    const billedPaise = this.toPaise(totalBilled);
    const paidPaise = this.toPaise(totalPaid);
    const diffPaise = paidPaise - billedPaise;

    if (diffPaise >= 0) {
      return {
        arrears: 0,
        advance: this.toRupees(diffPaise),
        balanceRupees: this.toRupees(diffPaise),
        balancePaise: diffPaise,
      };
    } else {
      return {
        arrears: this.toRupees(Math.abs(diffPaise)),
        advance: 0,
        balanceRupees: this.toRupees(diffPaise),
        balancePaise: diffPaise,
      };
    }
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

  static generateCryptoToken(bytes: number = 8): string {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(bytes);
      window.crypto.getRandomValues(array);
      return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  static generateDisplayId(prefix: string): string {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomNum}`;
  }

  static calculateCycle(params: {
    totalPool: number;
    numberOfShares: number;
    winningBidAmount: number;
    commissionPercent?: number;
  }) {
    return ChittiDomainModule.calculateCycleAuction(params);
  }

  static resolveBalance(totalBilled: number, totalPaid: number) {
    return UniversalFinancialCore.resolveBalance(totalBilled, totalPaid);
  }
}
