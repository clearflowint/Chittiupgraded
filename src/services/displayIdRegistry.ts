/**
 * displayIdRegistry — Sequential/Deterministic 4-digit human-friendly ID generator
 */

export class DisplayIdRegistry {
  private static PREFIX_MAP: Record<string, number> = {
    CF: 1001,
    SH: 101,
    CYC: 1,
    PAY: 1001,
    PO: 1001,
    BILL: 1001,
    CMP: 101,
    GRP: 101,
  };

  static getNextDisplayId(prefix: string, existingCount: number = 0): string {
    const base = this.PREFIX_MAP[prefix] || 1001;
    const nextVal = base + existingCount;
    if (prefix === 'SH') {
      return `SH-${String(nextVal).padStart(4, '0')}`;
    }
    return `${prefix}-${nextVal}`;
  }
}
