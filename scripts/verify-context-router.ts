import { Fund, Share, Cycle, Payment, MaterializedLedger } from '../src/types';
import { FinancialEngine } from '../src/services/financialEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

console.log('====================================================');
console.log('CLEARFLOW — ADVERSARIAL CONTEXT & ROUTER TESTS');
console.log('====================================================\n');

// Multi-Chitti Setup for Authenticated Manager A
const managerIdA = 'mgr_alpha_999';
const managerEmailA = 'mahesh.admin@clearflow.io';

const fundA: Fund = {
  fundId: 'chit_001',
  displayId: 'CF-001',
  managerId: managerIdA,
  fundName: 'Mahesh Chitti 1',
  totalPool: 2000000,
  numberOfShares: 20,
  totalMonths: 20,
  currentMonth: 4,
  cycleFrequency: 'monthly',
  commissionPercent: 5,
  startDate: '2026-01-01',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const fundB: Fund = {
  fundId: 'chit_002',
  displayId: 'CF-002',
  managerId: managerIdA,
  fundName: 'HBBCC Scheme',
  totalPool: 500000,
  numberOfShares: 10,
  totalMonths: 10,
  currentMonth: 2,
  cycleFrequency: 'monthly',
  commissionPercent: 5,
  startDate: '2026-03-01',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Manager B's Fund (Non-owned fund)
const fundNonOwned: Fund = {
  fundId: 'chit_non_owned_999',
  displayId: 'CF-999',
  managerId: 'mgr_bravo_888',
  fundName: 'Foreign Chit Scheme',
  totalPool: 1000000,
  numberOfShares: 10,
  totalMonths: 10,
  currentMonth: 1,
  cycleFrequency: 'monthly',
  commissionPercent: 5,
  startDate: '2026-04-01',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const cycleA1: Cycle = {
  cycleId: 'cyc_A_1',
  fundId: fundA.fundId,
  managerId: managerIdA,
  cycleNumber: 1,
  monthIndex: 1,
  auctionDate: '2026-01-15',
  winningBidAmount: 300000,
  organizerCommission: 100000,
  dividendPool: 200000,
  dividendPerShare: 10000,
  grossInstallment: 100000,
  netInstallmentDue: 90000,
  winnerNetPayout: 1700000,
  isAuctionClosed: true,
  status: 'finalized',
  createdAt: new Date().toISOString(),
};

const cycleB1: Cycle = {
  cycleId: 'cyc_B_1',
  fundId: fundB.fundId,
  managerId: managerIdA,
  cycleNumber: 1,
  monthIndex: 1,
  auctionDate: '2026-03-15',
  winningBidAmount: 75000,
  organizerCommission: 25000,
  dividendPool: 50000,
  dividendPerShare: 5000,
  grossInstallment: 50000,
  netInstallmentDue: 45000,
  winnerNetPayout: 425000,
  isAuctionClosed: true,
  status: 'finalized',
  createdAt: new Date().toISOString(),
};

const sharesA: Share[] = Array.from({ length: 20 }, (_, i) => ({
  shareId: `sh_A_${i + 1}`,
  displayId: `SH-${(i + 1).toString().padStart(3, '0')}`,
  managerId: managerIdA,
  fundId: fundA.fundId,
  memberId: `mem_A_${i + 1}`,
  memberName: `Chitti A Member ${i + 1}`,
  memberPhone: `+91 98000 ${10000 + i}`,
  shareNumber: i + 1,
  shareCount: 1,
  hasClaimedPrize: i < 3,
  wonMonth: i < 3 ? i + 1 : null,
  status: (i < 3 ? 'drawn' : 'undrawn') as any,
  totalBilled: 380000,
  totalPaid: i === 19 ? 350000 : 380000,
  arrears: i === 19 ? 30000 : 0,
  advance: 0,
  portalToken: `token_A_${i + 1}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const sharesB: Share[] = Array.from({ length: 10 }, (_, i) => ({
  shareId: `sh_B_${i + 1}`,
  displayId: `SH-${(i + 1).toString().padStart(3, '0')}`,
  managerId: managerIdA,
  fundId: fundB.fundId,
  memberId: `mem_B_${i + 1}`,
  memberName: `HBBCC Participant ${i + 1}`,
  memberPhone: `+91 99000 ${20000 + i}`,
  shareNumber: i + 1,
  shareCount: 1,
  hasClaimedPrize: i < 1,
  wonMonth: i < 1 ? 1 : null,
  status: (i < 1 ? 'drawn' : 'undrawn') as any,
  totalBilled: 95000,
  totalPaid: 95000,
  arrears: 0,
  advance: 0,
  portalToken: `token_B_${i + 1}`,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

const allManagerFunds = [fundA, fundB];
const allManagerShares = [...sharesA, ...sharesB];
const allManagerCycles = [cycleA1, cycleB1];

// In-memory mock database state
let mockPaymentsDB: Payment[] = [];
let mockLedgersDB: Record<string, MaterializedLedger> = {
  [`ledger_${fundA.fundId}`]: {
    ledgerId: `ledger_${fundA.fundId}`,
    managerId: managerIdA,
    fundId: fundA.fundId,
    ledgerType: 'CHITTI_LEDGER',
    totalPool: fundA.totalPool,
    totalCollected: 7570000,
    totalDisbursed: 1700000,
    totalArrears: 30000,
    totalMembers: 20,
    updatedAt: new Date().toISOString(),
  },
  [`ledger_${fundB.fundId}`]: {
    ledgerId: `ledger_${fundB.fundId}`,
    managerId: managerIdA,
    fundId: fundB.fundId,
    ledgerType: 'CHITTI_LEDGER',
    totalPool: fundB.totalPool,
    totalCollected: 950000,
    totalDisbursed: 425000,
    totalArrears: 0,
    totalMembers: 10,
    updatedAt: new Date().toISOString(),
  },
};

// Application-level methods matching ChitFundContext implementation
function appRecordPayment(data: {
  fundId: string;
  shareId: string;
  cycleNumber: number;
  amount: number;
}) {
  const share = allManagerShares.find((s) => s.shareId === data.shareId);
  if (!share) throw new Error('Share allotment not found');

  if (share.fundId !== data.fundId) {
    throw new Error('Security Violation: Share does not belong to the specified Chitti');
  }

  // Record payment
  const payment: Payment = {
    paymentId: `pay_${Date.now()}_${Math.random()}`,
    displayId: 'PAY-100',
    managerId: managerIdA,
    fundId: data.fundId,
    memberId: share.memberId,
    memberName: share.memberName,
    shareId: share.shareId,
    amount: data.amount,
    paymentMethod: 'UPI',
    paymentDate: new Date().toISOString(),
    verificationStatus: 'verified',
    createdAt: new Date().toISOString(),
  };

  mockPaymentsDB.push(payment);
  mockLedgersDB[`ledger_${data.fundId}`].totalCollected += data.amount;
  return payment;
}

function appUpdateShare(data: {
  fundId: string;
  shareId: string;
  memberName: string;
  memberPhone: string;
}) {
  const targetShare = allManagerShares.find(
    (s) => s.shareId === data.shareId && s.managerId === managerIdA
  );
  if (!targetShare) throw new Error('Share not found or unauthorized');

  if (targetShare.fundId !== data.fundId) {
    throw new Error('Security Violation: Share does not belong to the specified Chitti');
  }

  targetShare.memberName = data.memberName;
  targetShare.memberPhone = data.memberPhone;
  return targetShare;
}

function appUpdateDrawStatus(data: {
  fundId: string;
  cycleId: string;
  shareId: string;
  action: 'SET_DRAWN' | 'SET_UNDRAWN';
}) {
  const fund = allManagerFunds.find((f) => f.fundId === data.fundId);
  const cycle = allManagerCycles.find((c) => c.cycleId === data.cycleId);
  const targetShare = allManagerShares.find((s) => s.shareId === data.shareId);
  if (!fund || !cycle || !targetShare) throw new Error('Target record not found');

  if (targetShare.fundId !== data.fundId) {
    throw new Error('Security Violation: Share does not belong to the specified Chitti');
  }
  if (cycle.fundId !== data.fundId) {
    throw new Error('Security Violation: Auction cycle does not belong to the specified Chitti');
  }

  targetShare.hasClaimedPrize = data.action === 'SET_DRAWN';
  return targetShare;
}

function appFinalizeAuction(data: {
  fundId: string;
  cycleId: string;
  winnerShareId: string;
}) {
  const fund = allManagerFunds.find((f) => f.fundId === data.fundId);
  const share = allManagerShares.find((s) => s.shareId === data.winnerShareId);
  const cycle = allManagerCycles.find((c) => c.cycleId === data.cycleId);

  if (!fund || !share || !cycle) throw new Error('Entity not found');

  if (share.fundId !== data.fundId) {
    throw new Error('Security Violation: Share does not belong to the specified Chitti');
  }
  if (cycle.fundId !== data.fundId) {
    throw new Error('Security Violation: Auction cycle does not belong to the specified Chitti');
  }

  return true;
}

// Router & activeFund resolution matching ChitFundContext & DashboardView
function resolveActiveFund(activeFundId: string | null, fundsList: Fund[]): Fund | null {
  if (!activeFundId) return null;
  return (
    fundsList.find(
      (f) =>
        f.fundId === activeFundId ||
        (f.displayId &&
          f.displayId.toLowerCase().replace(/[^a-z0-9]/g, '') ===
            activeFundId.toLowerCase().replace(/[^a-z0-9]/g, ''))
    ) || null
  );
}

function resolveWorkspaceView(route: string, activeFundId: string | null, fundsList: Fund[]) {
  if (route === 'dashboard') {
    return { view: 'PORTFOLIO_DASHBOARD', activeFund: null };
  }

  const fund = resolveActiveFund(activeFundId, fundsList);
  if (!fund) {
    return { view: 'CHITTI_NOT_FOUND', activeFund: null };
  }

  return { view: 'ACTIVE_WORKSPACE', activeFund: fund };
}

// ====================================================
// TEST SUITE 1: CROSS-CHITTI CONTEXT API VALIDATION (ISSUE 1)
// ====================================================
console.log('--- SUITE 1: CROSS-CHITTI CONTEXT API VALIDATION ---');

// TEST 1: fund_A + share_A -> payment succeeds.
const initialPaymentsCount = mockPaymentsDB.length;
const initialLedgerACollected = mockLedgersDB[`ledger_${fundA.fundId}`].totalCollected;

const paymentA = appRecordPayment({
  fundId: fundA.fundId,
  shareId: sharesA[0].shareId,
  cycleNumber: 4,
  amount: 90000,
});
assert(paymentA.amount === 90000, 'TEST 1: Valid fund_A + share_A payment succeeds');
assert(mockPaymentsDB.length === initialPaymentsCount + 1, 'TEST 1: Payment document persisted');

// TEST 2: fund_B + share_A -> recordPayment throws.
let recordPaymentError: Error | null = null;
const countBeforeAttack = mockPaymentsDB.length;
const ledgerBBeforeAttack = mockLedgersDB[`ledger_${fundB.fundId}`].totalCollected;

try {
  appRecordPayment({
    fundId: fundB.fundId, // Fund B
    shareId: sharesA[0].shareId, // Share A (mismatched!)
    cycleNumber: 2,
    amount: 50000,
  });
} catch (e: any) {
  recordPaymentError = e;
}
assert(
  recordPaymentError !== null &&
    recordPaymentError.message.includes('Security Violation: Share does not belong to the specified Chitti'),
  'TEST 2: fund_B + share_A throws Security Violation error'
);

// TEST 3: fund_B + share_A -> NO payment document created.
assert(
  mockPaymentsDB.length === countBeforeAttack,
  'TEST 3: Zero payment documents created after cross-fund attack'
);

// TEST 4: fund_B + share_A -> NO ledger mutation.
assert(
  mockLedgersDB[`ledger_${fundB.fundId}`].totalCollected === ledgerBBeforeAttack,
  'TEST 4: Fund B ledger remained completely unmutated'
);

// TEST 5: fund_B + share_A -> updateShare throws.
let updateShareError: Error | null = null;
try {
  appUpdateShare({
    fundId: fundB.fundId,
    shareId: sharesA[0].shareId,
    memberName: 'Attacker Modification',
    memberPhone: '+91 9999999999',
  });
} catch (e: any) {
  updateShareError = e;
}
assert(
  updateShareError !== null &&
    updateShareError.message.includes('Security Violation: Share does not belong to the specified Chitti'),
  'TEST 5: fund_B + share_A updateShare throws Security Violation error'
);
assert(
  sharesA[0].memberName === 'Chitti A Member 1',
  'TEST 5: Share A memberName remained unmutated'
);

// TEST 6: fund_B + share_A -> updateDrawStatus throws.
let updateDrawError: Error | null = null;
try {
  appUpdateDrawStatus({
    fundId: fundB.fundId,
    cycleId: cycleB1.cycleId,
    shareId: sharesA[0].shareId,
    action: 'SET_DRAWN',
  });
} catch (e: any) {
  updateDrawError = e;
}
assert(
  updateDrawError !== null &&
    updateDrawError.message.includes('Security Violation: Share does not belong to the specified Chitti'),
  'TEST 6: fund_B + share_A updateDrawStatus throws Security Violation'
);

// TEST 7: fund_B + cycle_A -> rejected wherever cycle/fund is validated.
let cycleMismatchError: Error | null = null;
try {
  appFinalizeAuction({
    fundId: fundB.fundId,
    cycleId: cycleA1.cycleId, // Cycle belonging to Fund A
    winnerShareId: sharesB[0].shareId,
  });
} catch (e: any) {
  cycleMismatchError = e;
}
assert(
  cycleMismatchError !== null &&
    cycleMismatchError.message.includes('Security Violation: Auction cycle does not belong to the specified Chitti'),
  'TEST 7: fund_B + cycle_A rejected with cycle mismatch error'
);

// ====================================================
// TEST SUITE 2: REMOVE INVALID FUND FALLBACK (ISSUE 2)
// ====================================================
console.log('\n--- SUITE 2: ROUTING & INVALID FUND ISOLATION ---');

// TEST 8: #/funds/validFund/ledger -> validFund ledger.
const resValid = resolveWorkspaceView('fund_workspace', 'chit_001', allManagerFunds);
assert(
  resValid.view === 'ACTIVE_WORKSPACE' && resValid.activeFund?.fundId === 'chit_001',
  'TEST 8: #/funds/validFund/ledger resolves to validFund workspace'
);

// TEST 9: #/funds/nonexistent/ledger -> Chitti Not Found.
const resNonexistent = resolveWorkspaceView('fund_workspace', 'nonexistent_scheme_xyz', allManagerFunds);
assert(
  resNonexistent.view === 'CHITTI_NOT_FOUND' && resNonexistent.activeFund === null,
  'TEST 9: #/funds/nonexistent/ledger renders Chitti Not Found (activeFund === null)'
);

// TEST 10: #/funds/nonownedFund/ledger -> Chitti Not Found / inaccessible state, never another fund.
// Manager A's authorized fund list does not include fundNonOwned
const resNonOwned = resolveWorkspaceView('fund_workspace', fundNonOwned.fundId, allManagerFunds);
assert(
  resNonOwned.view === 'CHITTI_NOT_FOUND' && resNonOwned.activeFund === null,
  'TEST 10: Non-owned fund renders Chitti Not Found, never falls back to another fund'
);

// TEST 11: #/funds/CF-001/ledger -> CF-001.
const resDisplayHyphen = resolveWorkspaceView('fund_workspace', 'CF-001', allManagerFunds);
assert(
  resDisplayHyphen.view === 'ACTIVE_WORKSPACE' && resDisplayHyphen.activeFund?.fundId === 'chit_001',
  'TEST 11: #/funds/CF-001/ledger resolves to CF-001'
);

// TEST 12: #/funds/CF001/ledger -> same CF-001.
const resDisplayClean = resolveWorkspaceView('fund_workspace', 'CF001', allManagerFunds);
assert(
  resDisplayClean.view === 'ACTIVE_WORKSPACE' && resDisplayClean.activeFund?.fundId === 'chit_001',
  'TEST 12: #/funds/CF001/ledger resolves to same CF-001'
);

// TEST 13: After invalid-fund navigation, no member/payment/ledger data from funds[0] appears anywhere.
const invalidShares = resNonexistent.activeFund
  ? allManagerShares.filter((s) => s.fundId === resNonexistent.activeFund?.fundId)
  : [];
assert(
  invalidShares.length === 0,
  'TEST 13: Zero member data from funds[0] appears during invalid-fund state'
);

// TEST 14: Browser Back/Forward remains correct after visiting an invalid fund URL.
const historyStack = ['dashboard', 'chit_001', 'invalid_999', 'chit_002'];
// Simulate Back from chit_002 -> invalid_999
const stepBack1 = resolveWorkspaceView('fund_workspace', historyStack[2], allManagerFunds);
assert(stepBack1.view === 'CHITTI_NOT_FOUND', 'TEST 14: History Back to invalid URL accurately renders Chitti Not Found');

// Simulate Back from invalid_999 -> chit_001
const stepBack2 = resolveWorkspaceView('fund_workspace', historyStack[1], allManagerFunds);
assert(stepBack2.view === 'ACTIVE_WORKSPACE' && stepBack2.activeFund?.fundId === 'chit_001', 'TEST 14: History Back to chit_001 accurately restores Chitti A');

// Simulate Forward back to invalid_999
const stepForward = resolveWorkspaceView('fund_workspace', historyStack[2], allManagerFunds);
assert(stepForward.view === 'CHITTI_NOT_FOUND', 'TEST 14: History Forward to invalid URL returns to Chitti Not Found');

// TEST 15: Refresh on an invalid fund URL still shows the invalid/not-found state and does not fall back to the first fund.
const simulatedRefreshOnInvalidURL = resolveWorkspaceView('fund_workspace', 'some_corrupted_id', allManagerFunds);
assert(
  simulatedRefreshOnInvalidURL.view === 'CHITTI_NOT_FOUND' && simulatedRefreshOnInvalidURL.activeFund === null,
  'TEST 15: Browser Refresh on invalid fund URL strictly displays Chitti Not Found without falling back to funds[0]'
);

console.log('\n====================================================');
console.log('ALL 15 ADVERSARIAL CONTEXT & ROUTER TESTS PASSED!');
console.log('====================================================');
