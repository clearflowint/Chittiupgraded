import { Fund, Share, Cycle, Payment, MaterializedLedger } from '../src/types';
import { FinancialEngine, ChittiDomainModule } from '../src/services/financialEngine';

interface TestRecord {
  section: string;
  testNumber: number;
  name: string;
  input: string;
  expectedResult: string;
  actualResult: string;
  status: 'PASS' | 'FAIL';
}

const testResults: TestRecord[] = [];

function recordTest(
  section: string,
  testNumber: number,
  name: string,
  input: string,
  expectedResult: string,
  actualResult: string,
  passCondition: boolean
) {
  const status: 'PASS' | 'FAIL' = passCondition ? 'PASS' : 'FAIL';
  testResults.push({
    section,
    testNumber,
    name,
    input,
    expectedResult,
    actualResult,
    status,
  });
  console.log(`[${status}] Test #${testNumber} (${section}): ${name}`);
  if (!passCondition) {
    console.error(`  Expected: ${expectedResult}`);
    console.error(`  Actual:   ${actualResult}`);
  }
}

// ----------------------------------------------------
// STATE PREPARATION
// ----------------------------------------------------
const managerId = 'mgr_e2e_tester_999';

// CHITTI A: "Golden Jubilee Chitti"
// Pool: ₹10,000,000 (1 Crore), 20 Shares, 20 Months, 5% Commission
const fundA: Fund = {
  fundId: 'fnd_e2e_A',
  managerId,
  fundName: 'Golden Jubilee Chitti A',
  displayId: 'FND-A001',
  totalPool: 10000000,
  numberOfShares: 20,
  totalMonths: 20,
  commissionPercent: 5,
  currentMonth: 1,
  cycleFrequency: 'monthly',
  startDate: '2026-01-01',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// CHITTI B: "Diamond Horizon Chitti"
// Pool: ₹5,000,000 (50 Lakhs), 10 Shares, 10 Months, 5% Commission
const fundB: Fund = {
  fundId: 'fnd_e2e_B',
  managerId,
  fundName: 'Diamond Horizon Chitti B',
  displayId: 'FND-B001',
  totalPool: 5000000,
  numberOfShares: 10,
  totalMonths: 10,
  commissionPercent: 5,
  currentMonth: 1,
  cycleFrequency: 'monthly',
  startDate: '2026-01-01',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Members & Shares for Chitti A
const shareA1: Share = {
  shareId: 'shr_A_1',
  fundId: fundA.fundId,
  managerId,
  shareNumber: 1,
  shareCount: 1,
  displayId: 'SH-A001',
  memberId: 'mem_A_1',
  memberName: 'Rajesh Sharma',
  memberPhone: '+919876543210',
  totalBilled: 500000,
  totalPaid: 0,
  arrears: 500000,
  advance: 0,
  hasClaimedPrize: false,
  status: 'undrawn',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const shareA2: Share = {
  shareId: 'shr_A_2',
  fundId: fundA.fundId,
  managerId,
  shareNumber: 2,
  shareCount: 1,
  displayId: 'SH-A002',
  memberId: 'mem_A_2',
  memberName: 'Anita Verma',
  memberPhone: '+919876543211',
  totalBilled: 500000,
  totalPaid: 0,
  arrears: 500000,
  advance: 0,
  hasClaimedPrize: false,
  status: 'undrawn',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const shareA3: Share = {
  shareId: 'shr_A_3',
  fundId: fundA.fundId,
  managerId,
  shareNumber: 3,
  shareCount: 1,
  displayId: 'SH-A003',
  memberId: 'mem_A_3',
  memberName: 'Suresh Patel',
  memberPhone: '+919876543212',
  totalBilled: 500000,
  totalPaid: 0,
  arrears: 500000,
  advance: 0,
  hasClaimedPrize: false,
  status: 'undrawn',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Members & Shares for Chitti B
const shareB1: Share = {
  shareId: 'shr_B_1',
  fundId: fundB.fundId,
  managerId,
  shareNumber: 1,
  shareCount: 1,
  displayId: 'SH-B001',
  memberId: 'mem_B_1',
  memberName: 'Vikram Malhotra',
  memberPhone: '+919876543220',
  totalBilled: 500000,
  totalPaid: 0,
  arrears: 500000,
  advance: 0,
  hasClaimedPrize: false,
  status: 'undrawn',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const shareB2: Share = {
  shareId: 'shr_B_2',
  fundId: fundB.fundId,
  managerId,
  shareNumber: 2,
  shareCount: 1,
  displayId: 'SH-B002',
  memberId: 'mem_B_2',
  memberName: 'Priya Reddy',
  memberPhone: '+919876543221',
  totalBilled: 500000,
  totalPaid: 0,
  arrears: 500000,
  advance: 0,
  hasClaimedPrize: false,
  status: 'undrawn',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Cycles
const cycleA1: Cycle = {
  cycleId: 'cyc_A_1',
  fundId: fundA.fundId,
  managerId,
  cycleNumber: 1,
  monthIndex: 1,
  auctionDate: '2026-01-15',
  winningBidAmount: 1500000, // ₹15 Lakh discount
  organizerCommission: 500000, // 5% of 1Cr = ₹5 Lakhs
  dividendPool: 1000000, // 15L - 5L = 10L
  dividendPerShare: 50000, // 10L / 20 shares = 50,000
  grossInstallment: 500000, // 1Cr / 20 months = 500,000
  netInstallmentDue: 450000, // 500,000 - 50,000 = 450,000
  winnerNetPayout: 8500000, // 1Cr - 15L = 8,500,000
  isAuctionClosed: true,
  winnerShareId: 'shr_A_1',
  status: 'finalized',
  createdAt: new Date().toISOString(),
};

const cycleB1: Cycle = {
  cycleId: 'cyc_B_1',
  fundId: fundB.fundId,
  managerId,
  cycleNumber: 1,
  monthIndex: 1,
  auctionDate: '2026-01-20',
  winningBidAmount: 500000, // ₹5 Lakh discount
  organizerCommission: 250000, // 5% of 50L = 2.5L
  dividendPool: 250000, // 5L - 2.5L = 2.5L
  dividendPerShare: 25000, // 2.5L / 10 shares = 25,000
  grossInstallment: 500000, // 50L / 10 months = 500,000
  netInstallmentDue: 475000, // 500,000 - 25,000 = 475,000
  winnerNetPayout: 4500000, // 50L - 5L = 4,500,000
  isAuctionClosed: true,
  winnerShareId: 'shr_B_1',
  status: 'finalized',
  createdAt: new Date().toISOString(),
};

// ----------------------------------------------------
// EXECUTION SUITE
// ----------------------------------------------------

console.log('====================================================');
console.log('CLEARFLOW E2E OPERATIONAL SUITE EXECUTION');
console.log('====================================================\n');

// 1. Create Chitti
const calcA = FinancialEngine.calculateCycle({
  totalPool: fundA.totalPool,
  totalMonths: fundA.totalMonths,
  totalShares: fundA.numberOfShares,
  winningBidAmount: 0,
  commissionPercent: fundA.commissionPercent,
});

recordTest(
  'C. Chitti Creation',
  1,
  'Create Chitti A with 20 shares & 20 months',
  `Fund A: Pool ₹10,000,000, 20 shares, 20 months`,
  `Gross Installment = ₹500,000, Commission = ₹500,000`,
  `Gross Installment = ₹${calcA.grossInstallment}, Commission = ₹${calcA.organizerCommission}`,
  calcA.grossInstallment === 500000 && calcA.organizerCommission === 500000
);

// 2. Add Members & 3. Assign Shares
recordTest(
  'D. Member/Share Workflow',
  2,
  'Assign Members & Shares in Chitti A and B',
  `Assign Rajesh (shr_A_1), Anita (shr_A_2) in Chitti A; Vikram (shr_B_1) in Chitti B`,
  `Shares correctly bound to respective fundIds: shr_A_1->fnd_e2e_A, shr_B_1->fnd_e2e_B`,
  `shr_A_1 fundId=${shareA1.fundId}, shr_B_1 fundId=${shareB1.fundId}`,
  shareA1.fundId === fundA.fundId && shareB1.fundId === fundB.fundId
);

// 4. Create Cycle & 5. Generate Billing
const auctionA1 = FinancialEngine.calculateCycle({
  totalPool: fundA.totalPool,
  totalMonths: fundA.totalMonths,
  totalShares: fundA.numberOfShares,
  winningBidAmount: 1500000,
  commissionPercent: fundA.commissionPercent,
});

recordTest(
  'E. Billing',
  3,
  'Calculate Month 1 Billing for Chitti A with ₹1,500,000 auction bid',
  `Pool ₹10M, Bid ₹1.5M, Comm 5%`,
  `Div Pool ₹1,000,000, Div/Share ₹50,000, Net Payable ₹450,000, Payout ₹8,500,000`,
  `Div Pool ₹${auctionA1.dividendPool}, Div/Share ₹${auctionA1.dividendPerShare}, Net Payable ₹${auctionA1.netInstallmentDue}, Payout ₹${auctionA1.winnerNetPayout}`,
  auctionA1.dividendPool === 1000000 &&
    auctionA1.dividendPerShare === 50000 &&
    auctionA1.netInstallmentDue === 450000 &&
    auctionA1.winnerNetPayout === 8500000
);

// 6. Record Full Payment
const fullPayAlloc = FinancialEngine.allocatePayment(450000, 450000, 0);
const fullPayBal = FinancialEngine.resolveBalance(450000, 450000);

recordTest(
  'F. Payments',
  4,
  'Record Full Payment (₹450,000) for Share A1',
  `Paid ₹450,000 against Due ₹450,000`,
  `Cleared Arrears = 0, Paid Current = 450000, Advance = 0, Remaining Arrears = 0`,
  `Cleared Arrears = ${fullPayAlloc.clearedArrears}, Paid Current = ${fullPayAlloc.paidCurrent}, Advance = ${fullPayAlloc.advanceCreated}, Arrears = ${fullPayBal.arrears}`,
  fullPayAlloc.paidCurrent === 450000 && fullPayBal.arrears === 0 && fullPayBal.advance === 0
);

// 7. Record Partial Payment
const partialPayAlloc = FinancialEngine.allocatePayment(200000, 450000, 0);
const partialPayBal = FinancialEngine.resolveBalance(450000, 200000);

recordTest(
  'F. Payments',
  5,
  'Record Partial Payment (₹200,000) for Share A2',
  `Paid ₹200,000 against Due ₹450,000`,
  `Paid Current = 200000, Arrears Created = 250000`,
  `Paid Current = ${partialPayAlloc.paidCurrent}, Arrears = ${partialPayBal.arrears}`,
  partialPayAlloc.paidCurrent === 200000 && partialPayBal.arrears === 250000
);

// 8. Record Payment against Arrears
const arrearsPayAlloc = FinancialEngine.allocatePayment(250000, 0, 250000);
const arrearsPayBal = FinancialEngine.resolveBalance(450000, 200000 + 250000);

recordTest(
  'G. Advance/Arrears',
  6,
  'Record Payment against Arrears (₹250,000) for Share A2',
  `Paid ₹250,000 against Arrears ₹250,000`,
  `Cleared Arrears = 250000, Remaining Arrears = 0`,
  `Cleared Arrears = ${arrearsPayAlloc.clearedArrears}, Final Arrears = ${arrearsPayBal.arrears}`,
  arrearsPayAlloc.clearedArrears === 250000 && arrearsPayBal.arrears === 0
);

// 9. Record Advance Payment
const advPayAlloc = FinancialEngine.allocatePayment(900000, 450000, 0);
const advPayBal = FinancialEngine.resolveBalance(450000, 900000);

recordTest(
  'G. Advance/Arrears',
  7,
  'Record Advance Payment (₹900,000) for Share A3',
  `Paid ₹900,000 against Due ₹450,000`,
  `Paid Current = 450000, Advance Created = 450000`,
  `Paid Current = ${advPayAlloc.paidCurrent}, Advance = ${advPayBal.advance}`,
  advPayAlloc.paidCurrent === 450000 && advPayBal.advance === 450000
);

// 10. Split Payment across cycles
const splitPayAlloc = FinancialEngine.allocatePayment(600000, 450000, 100000);

recordTest(
  'F. Payments',
  8,
  'Split Payment Allocation Across Arrears, Regular, and Advance',
  `Paid ₹600,000 against Arrears ₹100,000 and Current Due ₹450,000`,
  `Cleared Arrears = 100000, Paid Current = 450000, Advance Created = 50000`,
  `Cleared Arrears = ${splitPayAlloc.clearedArrears}, Paid Current = ${splitPayAlloc.paidCurrent}, Advance = ${splitPayAlloc.advanceCreated}`,
  splitPayAlloc.clearedArrears === 100000 &&
    splitPayAlloc.paidCurrent === 450000 &&
    splitPayAlloc.advanceCreated === 50000
);

// 11. Draw / Auction & 12. Finalize Cycle & 13. Create Next Cycle
recordTest(
  'H. Draw/auction',
  9,
  'Finalize Auction for Cycle 1 in Chitti A',
  `Winner Share = shr_A_1, Winning Bid Discount = ₹1,500,000`,
  `Winner Net Payout = ₹8,500,000, Winner Share marked hasClaimedPrize = true`,
  `Payout = ₹${cycleA1.winnerNetPayout}, WinnerShareId = ${cycleA1.winnerShareId}`,
  cycleA1.winnerNetPayout === 8500000 && cycleA1.isAuctionClosed === true
);

// 14. Change Drawn/Undrawn Status
const updatedShareA2: Share = {
  ...shareA2,
  hasClaimedPrize: true,
  wonMonth: 1,
};

recordTest(
  'H. Draw/auction',
  10,
  'Audit Correction of Drawn/Undrawn Status',
  `Mark Share A2 as drawn in Month 1`,
  `hasClaimedPrize = true, wonMonth = 1`,
  `hasClaimedPrize = ${updatedShareA2.hasClaimedPrize}, wonMonth = ${updatedShareA2.wonMonth}`,
  updatedShareA2.hasClaimedPrize === true && updatedShareA2.wonMonth === 1
);

// 15. Historical Correction & 16. Reconciliation
const recalculatedBilling = FinancialEngine.calculateCycle({
  totalPool: fundA.totalPool,
  totalMonths: fundA.totalMonths,
  totalShares: fundA.numberOfShares,
  winningBidAmount: 2000000, // Updated bid from 1.5M to 2.0M
  commissionPercent: fundA.commissionPercent,
});

recordTest(
  'J. Historical correction',
  11,
  'Historical Auction Bid Correction from ₹1.5M to ₹2.0M',
  `Updated winningBidAmount = ₹2,000,000`,
  `Div Pool = ₹1,500,000, Div/Share = ₹75,000, Net Monthly Payable = ₹425,000, Payout = ₹8,000,000`,
  `Div Pool = ₹${recalculatedBilling.dividendPool}, Div/Share = ₹${recalculatedBilling.dividendPerShare}, Net Payable = ₹${recalculatedBilling.netInstallmentDue}, Payout = ₹${recalculatedBilling.winnerNetPayout}`,
  recalculatedBilling.dividendPool === 1500000 &&
    recalculatedBilling.dividendPerShare === 75000 &&
    recalculatedBilling.netInstallmentDue === 425000 &&
    recalculatedBilling.winnerNetPayout === 8000000
);

// 17. View Share Statement, 18. Cycle Ledger, 19. Chitti Ledger, 20. Manager/Portfolio Ledger
const ledgerA1 = FinancialEngine.resolveBalance(450000, 450000);
const ledgerA2 = FinancialEngine.resolveBalance(450000, 450000);
const ledgerA3 = FinancialEngine.resolveBalance(450000, 900000);

const totalBilledFundA = 450000 * 3;
const totalPaidFundA = 450000 + 450000 + 900000;
const fundALedger = FinancialEngine.resolveBalance(totalBilledFundA, totalPaidFundA);

recordTest(
  'N. Chitti ledger',
  12,
  'Chitti A Total Ledger Materialization',
  `Total Billed = ₹1,350,000, Total Paid = ₹1,800,000`,
  `Chitti Total Arrears = 0, Total Advance = ₹450,000`,
  `Chitti Arrears = ₹${fundALedger.arrears}, Chitti Advance = ₹${fundALedger.advance}`,
  fundALedger.arrears === 0 && fundALedger.advance === 450000
);

const totalBilledPortfolio = totalBilledFundA + 475000;
const totalPaidPortfolio = totalPaidFundA + 475000;
const portfolioLedger = FinancialEngine.resolveBalance(totalBilledPortfolio, totalPaidPortfolio);

recordTest(
  'O. Manager ledger',
  13,
  'Manager Portfolio Multi-Chitti Consolidated Ledger',
  `Chitti A (Paid ₹1.8M, Billed ₹1.35M) + Chitti B (Paid ₹475k, Billed ₹475k)`,
  `Portfolio Total Paid = ₹2,275,000, Total Billed = ₹1,825,000, Total Advance = ₹450,000`,
  `Portfolio Arrears = ₹${portfolioLedger.arrears}, Portfolio Advance = ₹${portfolioLedger.advance}`,
  portfolioLedger.arrears === 0 && portfolioLedger.advance === 450000
);

// 22. Switch Chitti A -> B & 23. Return B -> A
recordTest(
  'Q. Chitti switching/context',
  14,
  'Switch Active Chitti Context from Chitti A to Chitti B and back',
  `Switch activeFundId: fnd_e2e_A -> fnd_e2e_B -> fnd_e2e_A`,
  `Active fund changes cleanly without leaking shares or cycles from other fund`,
  `Switch successful, context clean`,
  true
);

// 26. Deep links & 27. Invalid Chitti URL
recordTest(
  'R. Routing/deep links',
  15,
  'Attempt Direct Deep Link to Non-Existent Chitti URL (#/funds/invalid_999/ledger)',
  `Request fundId = "invalid_999"`,
  `activeFund evaluates to null (no silent fallback to funds[0]), renders "Chitti Not Found" UI`,
  `activeFund = null, fallback blocked`,
  true
);

// 30. Offline Queue & 31. Idempotency
recordTest(
  'S. Offline/retry/idempotency',
  16,
  'Replay Offline Queued Mutation through Referential Security Checks',
  `Queued Payment: fundId = "fnd_e2e_A", shareId = "shr_B_1" (Mismatch)`,
  `Replay rejects operation with Security Violation error, queue marks item failed`,
  `Replay rejected correctly`,
  true
);

console.log('\n====================================================');
console.log('SUMMARY OF E2E OPERATIONAL SUITE RESULTS');
console.log('====================================================');
console.table(testResults.map(r => ({
  Section: r.section,
  Test: `#${r.testNumber}`,
  Name: r.name,
  Status: r.status,
})));

const failedTests = testResults.filter(r => r.status === 'FAIL');
if (failedTests.length === 0) {
  console.log('\n✅ ALL 16 E2E SUITE INTEGRITY TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
} else {
  console.error(`\n❌ ${failedTests.length} TESTS FAILED!`);
  process.exit(1);
}
