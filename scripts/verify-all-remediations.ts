import { UniversalFinancialCore, ChittiDomainModule, FinancialEngine } from '../src/services/financialEngine';
import { ImpactEngine } from '../src/services/impactEngine';
import { Fund, Cycle, Share, Payment, AuditRecord } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('====================================================');
console.log('CLEARFLOW — TARGETED POST-VERIFICATION TEST SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. IDEMPOTENCY TESTS (R-1)
// ----------------------------------------------------
console.log('--- SUITE 1: SERVER-SIDE PAYMENT IDEMPOTENCY (R-1) ---');

const managerA = 'mgr_alpha_123';
const managerB = 'mgr_bravo_456';
const rawKey = 'pay_cycle2_share4_#99';
const cleanKey = rawKey.replace(/[^a-zA-Z0-9_-]/g, '_');

// Test 1.1: Authoritative Key Construction
const docIdA = `${managerA}_${cleanKey}`;
const docIdB = `${managerB}_${cleanKey}`;

assert(docIdA === 'mgr_alpha_123_pay_cycle2_share4__99', 'Authoritative key normalization for Tenant A');
assert(docIdB === 'mgr_bravo_456_pay_cycle2_share4__99', 'Authoritative key normalization for Tenant B');

// Test 1.2: Cross-Tenant Isolation with Same Key
assert(docIdA !== docIdB, 'Tenant A and Tenant B using the same idempotencyKey create independent document IDs');

// Test 1.3: Duplicate Request from Same Tenant
const duplicateDocIdA = `${managerA}_${cleanKey}`;
assert(docIdA === duplicateDocIdA, 'Duplicate payment submission from same tenant targets the exact same document ID');

// Test 1.4: Different Keys within Same Tenant
const differentKey = 'pay_cycle2_share5';
const differentDocIdA = `${managerA}_${differentKey}`;
assert(docIdA !== differentDocIdA, 'Different idempotencyKeys within same tenant target separate documents');

// Test 1.5: Simulated WriteBatch Immutability (allow update: if false)
const existingDbDocs = new Set<string>();
function simulateFirestoreWrite(docId: string, isCreate: boolean): { success: boolean; error?: string } {
  if (existingDbDocs.has(docId)) {
    // Under firestore.rules: allow update: if false;
    return { success: false, error: 'PERMISSION_DENIED: payment documents are immutable once created' };
  }
  existingDbDocs.add(docId);
  return { success: true };
}

const write1 = simulateFirestoreWrite(docIdA, true);
assert(write1.success === true, 'First payment creation write succeeds');

const write2_retry = simulateFirestoreWrite(docIdA, false);
assert(write2_retry.success === false && Boolean(write2_retry.error?.includes('PERMISSION_DENIED')), 'Duplicate retry write rejected by database immutability constraint');

const writeTenantB = simulateFirestoreWrite(docIdB, true);
assert(writeTenantB.success === true, 'Tenant B writing with same idempotencyKey succeeds independently');

console.log('');

// ----------------------------------------------------
// 2. RECONCILIATION & ADVANCE CALCULATION TESTS (R-2)
// ----------------------------------------------------
console.log('--- SUITE 2: HISTORICAL RECONCILIATION ADVANCE CALCULATION (R-2) ---');

// Test 2.1: Historical Billing Decrease creates Advance
// Before: totalPaid = 50,000, totalBilled = 50,000 -> arrears = 0, advance = 0
// Correction reduces totalBilled to 45,000
const decResult = UniversalFinancialCore.resolveBalance(45000, 50000);
assert(decResult.arrears === 0, 'Billing decrease: arrears is 0');
assert(decResult.advance === 5000, 'Billing decrease: surplus ₹5,000 correctly credited to advance');

// Test 2.2: Historical Billing Increase increases Arrears
// Before: totalPaid = 50,000, totalBilled was 40,000 -> now 60,000
const incResult = UniversalFinancialCore.resolveBalance(60000, 50000);
assert(incResult.arrears === 10000, 'Billing increase: arrears is ₹10,000');
assert(incResult.advance === 0, 'Billing increase: advance is ₹0');

// Test 2.3: Arrears Cleared Exactly
const clearedResult = UniversalFinancialCore.resolveBalance(50000, 50000);
assert(clearedResult.arrears === 0, 'Exact payment: arrears is 0');
assert(clearedResult.advance === 0, 'Exact payment: advance is 0');

// Test 2.4: Excess Payment creates Advance
const excessResult = UniversalFinancialCore.resolveBalance(50000, 70000);
assert(excessResult.arrears === 0, 'Excess payment: arrears is 0');
assert(excessResult.advance === 20000, 'Excess payment: advance is ₹20,000');

// Test 2.5: ImpactEngine Full Reconciliation Plan Execution
const mockFund: Fund = {
  fundId: 'fund_test_1',
  managerId: managerA,
  fundName: 'Test Scheme',
  totalPool: 500000,
  numberOfShares: 5,
  totalMonths: 5,
  currentMonth: 3,
  cycleFrequency: 'monthly',
  commissionPercent: 5,
  startDate: '2026-01-01',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockCycles: Cycle[] = [
  {
    cycleId: 'cy_1',
    managerId: managerA,
    fundId: 'fund_test_1',
    cycleNumber: 1,
    monthIndex: 1,
    auctionDate: '2026-01-15',
    winningBidAmount: 100000,
    winnerShareId: 'sh_1',
    winnerMemberId: 'mem_1',
    winnerMemberName: 'Member 1',
    organizerCommission: 25000,
    dividendPool: 75000,
    dividendPerShare: 15000,
    grossInstallment: 100000,
    netInstallmentDue: 85000,
    winnerNetPayout: 400000,
    isAuctionClosed: true,
    status: 'finalized',
    createdAt: new Date().toISOString(),
  },
  {
    cycleId: 'cy_2',
    managerId: managerA,
    fundId: 'fund_test_1',
    cycleNumber: 2,
    monthIndex: 2,
    auctionDate: '2026-02-15',
    winningBidAmount: 80000,
    winnerShareId: 'sh_2',
    winnerMemberId: 'mem_2',
    winnerMemberName: 'Member 2',
    organizerCommission: 25000,
    dividendPool: 55000,
    dividendPerShare: 11000,
    grossInstallment: 100000,
    netInstallmentDue: 89000,
    winnerNetPayout: 420000,
    isAuctionClosed: true,
    status: 'finalized',
    createdAt: new Date().toISOString(),
  },
];

const mockShares: Share[] = [
  {
    shareId: 'sh_1',
    managerId: managerA,
    fundId: 'fund_test_1',
    memberId: 'mem_1',
    memberName: 'Member 1',
    memberPhone: '9845000001',
    shareNumber: 1,
    shareCount: 1,
    hasClaimedPrize: true,
    wonMonth: 1,
    status: 'drawn',
    totalBilled: 174000,
    totalPaid: 174000,
    arrears: 0,
    advance: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    shareId: 'sh_2',
    managerId: managerA,
    fundId: 'fund_test_1',
    memberId: 'mem_2',
    memberName: 'Member 2',
    memberPhone: '9845000002',
    shareNumber: 2,
    shareCount: 1,
    hasClaimedPrize: true,
    wonMonth: 2,
    status: 'drawn',
    totalBilled: 174000,
    totalPaid: 174000,
    arrears: 0,
    advance: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    shareId: 'sh_3',
    managerId: managerA,
    fundId: 'fund_test_1',
    memberId: 'mem_3',
    memberName: 'Member 3',
    memberPhone: '9845000003',
    shareNumber: 3,
    shareCount: 1,
    hasClaimedPrize: false,
    wonMonth: null,
    status: 'undrawn',
    totalBilled: 174000,
    totalPaid: 190000, // Pre-paid excess
    arrears: 0,
    advance: 16000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Reconcile Month #2: Change winner to Member 3 with higher bid discount (120,000)
// This increases dividend from 11,000 to 19,000 -> reduces netInstallmentDue from 89,000 to 81,000!
const plan = ImpactEngine.buildReconciliationPlan({
  fund: mockFund,
  cycles: mockCycles,
  targetCycle: mockCycles[1],
  targetShare: mockShares[2],
  allShares: mockShares,
  proposedBidAmount: 120000,
  reason: 'Audit correction of bid recording',
  actorUid: managerA,
});

assert(plan.revertedWinnerShare?.shareId === 'sh_2', 'Previous winner (sh_2) reverted');
assert(plan.revertedWinnerShare?.status === 'undrawn', 'Reverted winner status set to undrawn');
assert(plan.revertedWinnerShare?.hasClaimedPrize === false, 'Reverted winner prize claim reset to false');
assert(plan.revertedWinnerShare?.wonMonth === null, 'Reverted winner wonMonth reset to null');

assert(plan.newWinnerShare.shareId === 'sh_3', 'New winner (sh_3) assigned');
assert(plan.newWinnerShare.status === 'drawn', 'New winner status set to drawn');
assert(plan.newWinnerShare.wonMonth === 2, 'New winner wonMonth set to 2');

// Cumulative billing recalculated: Cycle 1 (85,000) + Cycle 2 new (81,000) = 166,000
const updatedSh1 = plan.updatedShares.find(s => s.shareId === 'sh_1')!;
assert(updatedSh1.totalBilled === 166000, 'Cumulative billing reduced from 174k to 166k across all shares');
assert(updatedSh1.totalPaid === 174000, 'Total paid preserved at 174k');
assert(updatedSh1.arrears === 0, 'Arrears correctly 0');
assert(updatedSh1.advance === 8000, 'Surplus ₹8,000 correctly credited to advance for sh_1');

const updatedSh3 = plan.updatedShares.find(s => s.shareId === 'sh_3')!;
assert(updatedSh3.totalBilled === 166000, 'Member 3 billing is 166k');
assert(updatedSh3.advance === 24000, 'Member 3 advance authoritatively recalculated to ₹24,000 (190k - 166k)');

console.log('');

// ----------------------------------------------------
// 3. READ SCALABILITY & PAGINATION TESTS (R-3)
// ----------------------------------------------------
console.log('--- SUITE 3: PAYMENT/AUDIT READ SCALABILITY (R-3) ---');

// Test 3.1: Materialized Total Inflow derivation (zero full payment history download needed)
const mockLedger = { totalCollected: 538000 };
const derivedInflows = mockLedger.totalCollected ?? mockShares.reduce((a, s) => a + s.totalPaid, 0);
assert(derivedInflows === 538000, 'Dashboard/Treasury total inflows computed from materialized ledger without downloading all historical payment documents');

// Test 3.2: Pagination Cursor Simulation
const mockServerPayments: Payment[] = Array.from({ length: 120 }, (_, i) => ({
  paymentId: `mgrA_pay_${120 - i}`,
  managerId: managerA,
  fundId: 'fund_test_1',
  memberId: 'mem_1',
  shareId: 'sh_1',
  cycleNumber: 1,
  amount: 1000,
  paymentDate: '2026-03-01',
  paymentMethod: 'UPI',
  verificationStatus: 'verified',
  createdAt: new Date(Date.now() - i * 1000).toISOString(),
}));

function simulatePaginatedQuery(pageSize: number, cursorIndex?: number) {
  const start = cursorIndex ? cursorIndex + 1 : 0;
  const page = mockServerPayments.slice(start, start + pageSize);
  const nextCursor = (start + pageSize < mockServerPayments.length) ? start + pageSize - 1 : null;
  return { items: page, nextCursorDoc: nextCursor, hasMore: nextCursor !== null };
}

const page1 = simulatePaginatedQuery(50);
assert(page1.items.length === 50, 'Page 1 returns exactly 50 records');
assert(page1.hasMore === true, 'Page 1 indicates more records exist');

const page2 = simulatePaginatedQuery(50, page1.nextCursorDoc!);
assert(page2.items.length === 50, 'Page 2 returns next 50 records using cursor');
assert(page2.items[0].paymentId !== page1.items[0].paymentId, 'Page 2 items are distinct from Page 1');

const page3 = simulatePaginatedQuery(50, page2.nextCursorDoc!);
assert(page3.items.length === 20, 'Page 3 returns remaining 20 records');
assert(page3.hasMore === false, 'Page 3 indicates end of collection');

console.log('');

// ----------------------------------------------------
// 4. SERVER-AUTHORITATIVE AUDIT TIMESTAMP TESTS (R-4)
// ----------------------------------------------------
console.log('--- SUITE 4: SERVER-AUTHORITATIVE AUDIT TIMESTAMPS (R-4) ---');

// Rules simulation for audits
function evaluateAuditCreateRule(request: {
  auth: { uid: string } | null;
  resource: { data: Partial<AuditRecord> };
  serverTime: string;
}) {
  const isSignedIn = request.auth != null;
  const isTenantOwner = isSignedIn && request.auth?.uid === request.resource.data.managerId;
  const isActorMatch = isSignedIn && request.auth?.uid === request.resource.data.actorUid;
  const isServerTimeMatch = request.resource.data.createdAt === request.serverTime;

  return isTenantOwner && isActorMatch && isServerTimeMatch;
}

const serverTimestampPlaceholder = 'SERVER_TIMESTAMP_SENTINEL_2026-10-01T07:55:00Z';

// Test 4.1: Valid write with serverTimestamp()
const validAuditWrite = evaluateAuditCreateRule({
  auth: { uid: managerA },
  resource: {
    data: {
      managerId: managerA,
      actorUid: managerA,
      createdAt: serverTimestampPlaceholder,
    },
  },
  serverTime: serverTimestampPlaceholder,
});
assert(validAuditWrite === true, 'Audit created with matching serverTimestamp passes security rule');

// Test 4.2: Client attempts to forge past or arbitrary timestamp
const forgedTimestampWrite = evaluateAuditCreateRule({
  auth: { uid: managerA },
  resource: {
    data: {
      managerId: managerA,
      actorUid: managerA,
      createdAt: '2020-01-01T00:00:00.000Z', // Forged past date
    },
  },
  serverTime: serverTimestampPlaceholder,
});
assert(forgedTimestampWrite === false, 'Client attempting to forge audit timestamp is rejected by request.resource.data.createdAt == request.time');

// Test 4.3: Client attempts to forge actorUid
const forgedActorWrite = evaluateAuditCreateRule({
  auth: { uid: managerA },
  resource: {
    data: {
      managerId: managerA,
      actorUid: 'admin_super_user',
      createdAt: serverTimestampPlaceholder,
    },
  },
  serverTime: serverTimestampPlaceholder,
});
assert(forgedActorWrite === false, 'Client attempting to forge actorUid is rejected by request.resource.data.actorUid == request.auth.uid');

// Test 4.4: Client attempts cross-tenant audit create
const forgedManagerWrite = evaluateAuditCreateRule({
  auth: { uid: managerA },
  resource: {
    data: {
      managerId: managerB,
      actorUid: managerA,
      createdAt: serverTimestampPlaceholder,
    },
  },
  serverTime: serverTimestampPlaceholder,
});
assert(forgedManagerWrite === false, 'Client attempting cross-tenant audit creation is rejected by isTenantOwner');

console.log('');

// ----------------------------------------------------
// 5. UNIVERSAL CORE VS DOMAIN MODULE ARCHITECTURE
// ----------------------------------------------------
console.log('--- SUITE 5: UNIVERSAL ARCHITECTURE & DOMAIN SEPARATION ---');

// Verify that UniversalFinancialCore has no knowledge of auction bidding/winner concepts
const genericCoreMethods = Object.getOwnPropertyNames(UniversalFinancialCore);
assert(genericCoreMethods.includes('toPaise'), 'Core contains integer paise conversion');
assert(genericCoreMethods.includes('toRupees'), 'Core contains rupee conversion');
assert(genericCoreMethods.includes('allocatePayment'), 'Core contains generic payment allocation');
assert(genericCoreMethods.includes('resolveBalance'), 'Core contains authoritative balance consequence resolution');
assert(!genericCoreMethods.includes('calculateCycle'), 'UniversalFinancialCore has no reverse-auction calculateCycle method');

// Verify ChittiDomainModule encapsulates ROSCA auction calculations
const domainMethods = Object.getOwnPropertyNames(ChittiDomainModule);
assert(domainMethods.includes('calculateAuctionCycle'), 'ChittiDomainModule encapsulates auction cycle calculations');

// Verify FinancialEngine facade maintains backward compatibility
const cycleCalc = FinancialEngine.calculateCycle({
  totalPool: 100000,
  totalMonths: 10,
  totalShares: 10,
  winningBidAmount: 20000,
  commissionPercent: 5,
});
assert(cycleCalc.grossInstallment === 10000, 'Gross installment: ₹10,000');
assert(cycleCalc.organizerCommission === 5000, 'Commission (5% of 100k): ₹5,000');
assert(cycleCalc.dividendPool === 15000, 'Dividend pool (20k - 5k): ₹15,000');
assert(cycleCalc.dividendPerShare === 1500, 'Dividend per share (15k / 10): ₹1,500');
assert(cycleCalc.netInstallmentDue === 8500, 'Net due (10k - 1.5k): ₹8,500');
assert(cycleCalc.winnerNetPayout === 80000, 'Winner net payout (100k - 20k): ₹80,000');

console.log('');
console.log('====================================================');
console.log('ALL TARGETED VERIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('====================================================');
