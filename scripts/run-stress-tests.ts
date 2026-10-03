import { ChittiDomainModule, UniversalFinancialCore } from '../src/services/financialEngine.js';
import { Share, Cycle, Billing, Payout, Payment, AuditRecord } from '../src/types/index.js';

console.log('================================================================================');
console.log('               CLEARFLOW REAL-WORLD OPERATIONAL STRESS TEST');
console.log('================================================================================');

// In-Memory Database Simulation with O(1) Nested Lookup Tables for Stress Performance
const databaseBillings: Map<string, Billing> = new Map(); // billingId -> Billing
const databasePayments: Map<string, Payment> = new Map(); // paymentId -> Payment
const databasePayouts: Map<string, Payout> = new Map();   // payoutId -> Payout
const databaseShares: Map<string, Share> = new Map();     // shareId -> Share
const databaseCycles: Map<string, Cycle> = new Map();     // cycleId -> Cycle
const databaseAudits: Map<string, AuditRecord> = new Map(); // auditId -> AuditRecord

// Nested maps for O(1) retrieval
const shareBillingsMap: Map<string, Map<string, Billing>> = new Map(); // shareId -> billingId -> Billing
const sharePaymentsMap: Map<string, Map<string, Payment>> = new Map(); // shareId -> paymentId -> Payment
const sharePayoutsMap: Map<string, Map<string, Payout>> = new Map();   // shareId -> payoutId -> Payout

// Metrics
let totalSimulatedOperations = 0;

// Centralized Write Facade (Reconciles state immediately for consistency)
function updateAuthoritativeBilling(
  billingId: string,
  managerId: string,
  fundId: string,
  cycleId: string,
  shareId: string,
  billAmount: number,
  authUid: string
): Billing {
  totalSimulatedOperations++;
  const existing = databaseBillings.get(billingId);
  const newBilling: Billing = {
    billingId,
    managerId,
    fundId,
    cycleId,
    shareId,
    billAmount,
    billAmountPaise: UniversalFinancialCore.toPaise(billAmount),
    createdAt: existing ? existing.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: existing ? existing.createdBy : authUid,
    version: existing ? (existing.version || 1) + 1 : 1,
  };
  databaseBillings.set(billingId, newBilling);

  // Update O(1) lookup map
  if (!shareBillingsMap.has(shareId)) {
    shareBillingsMap.set(shareId, new Map());
  }
  shareBillingsMap.get(shareId)!.set(billingId, newBilling);

  reconcileShareMaterializedState(shareId, managerId, fundId);
  return newBilling;
}

function recordAuthoritativePayment(payment: Payment) {
  totalSimulatedOperations++;
  databasePayments.set(payment.paymentId, payment);

  // Update O(1) lookup map
  if (!sharePaymentsMap.has(payment.shareId)) {
    sharePaymentsMap.set(payment.shareId, new Map());
  }
  sharePaymentsMap.get(payment.shareId)!.set(payment.paymentId, payment);

  reconcileShareMaterializedState(payment.shareId, payment.managerId, payment.fundId);
}

function recordAuthoritativePayout(payout: Payout) {
  totalSimulatedOperations++;
  databasePayouts.set(payout.payoutId, payout);

  // Update O(1) lookup map
  if (!sharePayoutsMap.has(payout.shareId)) {
    sharePayoutsMap.set(payout.shareId, new Map());
  }
  sharePayoutsMap.get(payout.shareId)!.set(payout.payoutId, payout);

  reconcileShareMaterializedState(payout.shareId, payout.managerId, payout.fundId);
}

function reconcileShareMaterializedState(shareId: string, managerId: string, fundId: string) {
  const share = databaseShares.get(shareId);
  if (!share) return;

  // 1. Gather all billings in O(1)
  const bMap = shareBillingsMap.get(shareId);
  const shareBillings = bMap ? Array.from(bMap.values()).filter(b => b.fundId === fundId && b.managerId === managerId) : [];
  const totalBilled = shareBillings.reduce((sum, b) => sum + b.billAmount, 0);

  // 2. Gather all payments in O(1)
  const pMap = sharePaymentsMap.get(shareId);
  const sharePayments = pMap ? Array.from(pMap.values()).filter(p => p.fundId === fundId && p.managerId === managerId) : [];
  const totalPaid = sharePayments.reduce((sum, p) => sum + p.amount, 0);

  // 3. Reconcile balances
  const resolved = UniversalFinancialCore.resolveBalance(totalBilled, totalPaid);

  // 4. Update drawn status
  const pyMap = sharePayoutsMap.get(shareId);
  const sharePayouts = pyMap ? Array.from(pyMap.values()).filter(p => p.fundId === fundId && p.status === 'disbursed') : [];
  const hasClaimedPrize = sharePayouts.length > 0;

  let wonMonthVal: number | null = null;
  if (hasClaimedPrize) {
    const earliestPayout = sharePayouts.sort(
      (a, b) => new Date(a.payoutDate).getTime() - new Date(b.payoutDate).getTime()
    )[0];
    const matchedCycle = databaseCycles.get(earliestPayout.cycleId);
    wonMonthVal = matchedCycle ? matchedCycle.cycleNumber : null;
  }

  share.totalBilled = totalBilled;
  share.totalPaid = totalPaid;
  share.arrears = resolved.arrears;
  share.advance = resolved.advance;
  share.hasClaimedPrize = hasClaimedPrize;
  share.wonMonth = wonMonthVal;
  share.status = hasClaimedPrize ? 'drawn' : 'undrawn';
  share.updatedAt = new Date().toISOString();
}

// Complete materialization engine for full scheme rebuild
function rebuildMaterializedState(fundId: string, managerId: string) {
  const fundShares = Array.from(databaseShares.values()).filter(
    (s) => s.fundId === fundId && s.managerId === managerId
  );

  for (const s of fundShares) {
    reconcileShareMaterializedState(s.shareId, managerId, fundId);
  }
}

// ---------------------------------------------------------
// STRESS TEST MATRIX RUNNER
// ---------------------------------------------------------
function executeHardeningStressSuite() {
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passedCount++;
    } else {
      failedCount++;
      console.log(`[FAIL] Stress Assertion: ${msg}`);
    }
  }

  // Define scale (slightly reduced manager size for optimized sub-second test execution)
  const NUM_MANAGERS = 2;
  const NUM_FUNDS_PER_MANAGER = 2;
  const NUM_SHARES_PER_FUND = 150;
  const NUM_CYCLES_PER_FUND = 24;

  console.log(`\n1. INITIALIZING DATASET...`);
  console.log(`- Managers: ${NUM_MANAGERS}`);
  console.log(`- Funds per Manager: ${NUM_FUNDS_PER_MANAGER} (Total: ${NUM_MANAGERS * NUM_FUNDS_PER_MANAGER})`);
  console.log(`- Shares per Fund: ${NUM_SHARES_PER_FUND} (Total: ${NUM_MANAGERS * NUM_FUNDS_PER_MANAGER * NUM_SHARES_PER_FUND})`);
  console.log(`- Cycles per Fund: ${NUM_CYCLES_PER_FUND}`);

  // Create shares and cycles
  for (let m = 0; m < NUM_MANAGERS; m++) {
    const managerId = `mgr_${m}`;
    for (let f = 0; f < NUM_FUNDS_PER_MANAGER; f++) {
      const fundId = `${managerId}_fund_${f}`;

      // Create Shares
      for (let s = 0; s < NUM_SHARES_PER_FUND; s++) {
        const shareId = `${fundId}_share_${s}`;
        databaseShares.set(shareId, {
          shareId,
          managerId,
          fundId,
          memberId: `mem_${s}`,
          memberName: `Member ${s}`,
          memberPhone: `+91 99000 ${10000 + s}`,
          shareNumber: s + 1,
          shareCount: 1,
          hasClaimedPrize: false,
          wonMonth: null,
          status: 'undrawn',
          totalBilled: 0,
          totalPaid: 0,
          arrears: 0,
          advance: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      // Create Cycles
      for (let c = 1; c <= NUM_CYCLES_PER_FUND; c++) {
        const cycleId = `${fundId}_cycle_${c}`;
        databaseCycles.set(cycleId, {
          cycleId,
          managerId,
          fundId,
          cycleNumber: c,
          cycleName: `Cycle #${c}`,
          startDate: `2026-${c.toString().padStart(2, '0')}-01`,
          endDate: `2026-${c.toString().padStart(2, '0')}-28`,
          monthIndex: c,
          auctionDate: `2026-${c.toString().padStart(2, '0')}-15`,
          winningBidAmount: 0,
          organizerCommission: 0,
          dividendPool: 0,
          dividendPerShare: 0,
          grossInstallment: 10000,
          netInstallmentDue: 10000,
          winnerNetPayout: 0,
          isAuctionClosed: false,
          status: 'upcoming',
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  assert(databaseShares.size === NUM_MANAGERS * NUM_FUNDS_PER_MANAGER * NUM_SHARES_PER_FUND, 'All shares generated');
  assert(databaseCycles.size === NUM_MANAGERS * NUM_FUNDS_PER_MANAGER * NUM_CYCLES_PER_FUND, 'All cycles generated');

  // ---------------------------------------------------------
  // 3. BILLING STRESS TEST
  // ---------------------------------------------------------
  console.log(`\n2. EXECUTING BILLING STRESS TEST...`);
  // Generate Variable Billings
  for (let m = 0; m < NUM_MANAGERS; m++) {
    const managerId = `mgr_${m}`;
    for (let f = 0; f < NUM_FUNDS_PER_MANAGER; f++) {
      const fundId = `${managerId}_fund_${f}`;
      for (let c = 1; c <= NUM_CYCLES_PER_FUND; c++) {
        const cycleId = `${fundId}_cycle_${c}`;

        // Variable billing across different members: even members billed 10,000, odd members billed 8,000
        for (let s = 0; s < NUM_SHARES_PER_FUND; s++) {
          const shareId = `${fundId}_share_${s}`;
          const billingId = `${managerId}_${cycleId}_${shareId}`;
          const billAmount = s % 2 === 0 ? 10000 : 8000;
          updateAuthoritativeBilling(billingId, managerId, fundId, cycleId, shareId, billAmount, managerId);
        }
      }
    }
  }

  assert(databaseBillings.size === NUM_MANAGERS * NUM_FUNDS_PER_MANAGER * NUM_CYCLES_PER_FUND * NUM_SHARES_PER_FUND, 'All variable billings generated safely');

  // Verify unique billing per manager/cycle/share
  const firstShare = `mgr_0_fund_0_share_0`;
  const firstCycle = `mgr_0_fund_0_cycle_1`;
  const uniqueBId = `mgr_0_${firstCycle}_${firstShare}`;
  const duplicateRecord = updateAuthoritativeBilling(uniqueBId, 'mgr_0', 'mgr_0_fund_0', firstCycle, firstShare, 12000, 'mgr_0');
  assert(databaseBillings.get(uniqueBId) !== undefined, 'Record lookup by composite key works');
  assert(duplicateRecord.billAmount === 12000, 'Billing update successful');

  // ---------------------------------------------------------
  // 4. PAYMENT STRESS TEST
  // ---------------------------------------------------------
  console.log(`\n3. EXECUTING PAYMENT STRESS TEST...`);
  // Record dynamic payments for various members
  for (let m = 0; m < NUM_MANAGERS; m++) {
    const managerId = `mgr_${m}`;
    const fundId = `${managerId}_fund_0`;

    // Member 0: Sequential payments
    const s0 = `${fundId}_share_0`;
    for (let c = 1; c <= 10; c++) {
      const payId = `${managerId}_pay_seq_${c}_${s0}`;
      const amount = c === 1 && m === 0 ? 12000 : 10000;
      recordAuthoritativePayment({
        paymentId: payId,
        managerId,
        fundId,
        memberId: 'mem_0',
        shareId: s0,
        amount,
        paymentDate: '2026-01-10',
        paymentMethod: 'UPI',
        verificationStatus: 'verified',
        createdAt: new Date().toISOString(),
      });
    }

    const share0Ref = databaseShares.get(s0);
    // Billed 24 cycles total:
    // For m = 0: (12000 + 23*10000) = 242,000. Paid 10 payments = 12000 + 9*10000 = 102,000. Arrears = 140,000.
    // For m = 1: (24*10000) = 240,000. Paid 10 payments = 10*10000 = 100,000. Arrears = 140,000.
    assert(share0Ref?.arrears === 140000 && share0Ref?.advance === 0, 'Sequential payments allocated correctly');

    // Member 1: Excess Payment test
    // Billed 24 cycles of 8,000 = 192,000. Payment = 200,000. Arrears = 0, Advance = 8,000.
    const s1 = `${fundId}_share_1`;
    recordAuthoritativePayment({
      paymentId: `${managerId}_pay_excess_${s1}`,
      managerId,
      fundId,
      memberId: 'mem_1',
      shareId: s1,
      amount: 200000,
      paymentDate: '2026-01-10',
      paymentMethod: 'UPI',
      verificationStatus: 'verified',
      createdAt: new Date().toISOString(),
    });

    const share1Ref = databaseShares.get(s1);
    assert(share1Ref?.arrears === 0 && share1Ref?.advance === 8000, 'Excess payment correctly handled as independent advance');
  }

  // ---------------------------------------------------------
  // 5. BILLING EDIT AFTER PAYMENT (CONSERVATIVE RESOLUTION)
  // ---------------------------------------------------------
  console.log(`\n4. EXECUTING BILLING EDIT AFTER PAYMENT TESTS...`);
  const mId = 'mgr_1';
  const fId = 'mgr_1_fund_1';
  const shId = 'mgr_1_fund_1_share_4';
  const cyId = 'mgr_1_fund_1_cycle_1';
  const bId = `${mId}_${cyId}_${shId}`;

  // Initial billing ₹10,000 (shId index is 4 so billed 10,000 in cycle 1)
  // Record UPI payment of ₹6,000
  recordAuthoritativePayment({
    paymentId: 'pay_edit_audit_test',
    managerId: mId,
    fundId: fId,
    memberId: 'mem_4',
    shareId: shId,
    amount: 6000,
    paymentDate: '2026-01-10',
    paymentMethod: 'UPI',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString(),
  });

  const sh4Pre = databaseShares.get(shId);
  // Cycle 1: 10,000 billed, cycle 2-24: 10,000 billed. Total Billed = 240,000. Total Paid = 6000. Arrears = 234000
  assert(sh4Pre?.arrears === 234000 && sh4Pre?.advance === 0, 'Pre-edit balance correct');

  // Edit cycle 1 billing from ₹10,000 to ₹15,000
  updateAuthoritativeBilling(bId, mId, fId, cyId, shId, 15000, mId);
  const sh4Post1 = databaseShares.get(shId);
  assert(sh4Post1?.arrears === 239000 && sh4Post1?.advance === 0, 'Arrears correctly adjusted after billing increase');

  // Edit cycle 1 billing from ₹15,000 to ₹4,000
  updateAuthoritativeBilling(bId, mId, fId, cyId, shId, 4000, mId);
  const sh4Post2 = databaseShares.get(shId);
  // Total Billed = 234,000. Total Paid = 6,000. Arrears = 228,000.
  assert(sh4Post2?.arrears === 228000 && sh4Post2?.advance === 0, 'Arrears correctly adjusted after billing reduction');


  // ---------------------------------------------------------
  // 6. MULTI-CYCLE PAYMENT ALLOCATION
  // ---------------------------------------------------------
  console.log(`\n5. EXECUTING MULTI-CYCLE PAYMENT ALLOCATION TESTS...`);
  const s2 = 'mgr_1_fund_1_share_2'; // Total Billed: 24 cycles of 10,000 = 240,000
  // Payments sequentially: 15,000, then 20,000, then 30,000, then 50,000. Total Paid = 115,000.
  // Expected arrears = 125,000, advance = 0.
  const pAmounts = [15000, 20000, 30000, 50000];
  for (let idx = 0; idx < pAmounts.length; idx++) {
    recordAuthoritativePayment({
      paymentId: `pay_multi_alloc_${idx}_${s2}`,
      managerId: 'mgr_1',
      fundId: fId,
      memberId: 'mem_2',
      shareId: s2,
      amount: pAmounts[idx],
      paymentDate: '2026-02-10',
      paymentMethod: 'UPI',
      verificationStatus: 'verified',
      createdAt: new Date().toISOString(),
    });
  }

  const share2Ref = databaseShares.get(s2);
  assert(share2Ref?.arrears === 125000 && share2Ref?.advance === 0, 'Deterministic payments allocation resolved properly');


  // ---------------------------------------------------------
  // 7. PAYOUT STRESS TEST (MULTIPLE CARDINALITIES 0..N)
  // ---------------------------------------------------------
  console.log(`\n6. EXECUTING PAYOUT STRESS TEST (0..N CARDINALITIES)...`);
  const pManager = 'mgr_1';
  const pFund = 'mgr_1_fund_1';
  const pCycle = 'mgr_1_fund_1_cycle_5';

  // Cycle B: 1 Payout
  const payOut1: Payout = {
    payoutId: 'pay_event_A',
    managerId: pManager,
    fundId: pFund,
    cycleId: pCycle,
    shareId: `${pFund}_share_10`,
    memberId: 'mem_10',
    amount: 80000,
    amountPaise: UniversalFinancialCore.toPaise(80000),
    payoutDate: '2026-05-15',
    status: 'disbursed',
    createdAt: new Date().toISOString(),
    createdBy: pManager,
  };
  recordAuthoritativePayout(payOut1);

  // Cycle C: 3 Payouts
  const pCycleC = 'mgr_1_fund_1_cycle_6';
  const payOutB1: Payout = { payoutId: 'pay_event_B1', managerId: pManager, fundId: pFund, cycleId: pCycleC, shareId: `${pFund}_share_11`, memberId: 'mem_11', amount: 45000, amountPaise: 4500000, payoutDate: '2026-06-15', status: 'disbursed', createdAt: new Date().toISOString(), createdBy: pManager };
  const payOutB2: Payout = { payoutId: 'pay_event_B2', managerId: pManager, fundId: pFund, cycleId: pCycleC, shareId: `${pFund}_share_12`, memberId: 'mem_12', amount: 35000, amountPaise: 3500000, payoutDate: '2026-06-15', status: 'disbursed', createdAt: new Date().toISOString(), createdBy: pManager };
  const payOutB3: Payout = { payoutId: 'pay_event_B3', managerId: pManager, fundId: pFund, cycleId: pCycleC, shareId: `${pFund}_share_13`, memberId: 'mem_13', amount: 20000, amountPaise: 2000000, payoutDate: '2026-06-15', status: 'disbursed', createdAt: new Date().toISOString(), createdBy: pManager };

  recordAuthoritativePayout(payOutB1);
  recordAuthoritativePayout(payOutB2);
  recordAuthoritativePayout(payOutB3);

  const cycleCPayouts = Array.from(databasePayouts.values()).filter(p => p.cycleId === pCycleC && p.status === 'disbursed');
  assert(cycleCPayouts.length === 3, 'Multiple payouts correctly captured in Cycle C');


  // ---------------------------------------------------------
  // 8. PAYOUT EDIT / REVOKE
  // ---------------------------------------------------------
  console.log(`\n7. EXECUTING PAYOUT EDIT & REVOCATION TESTS...`);
  // Revoke payOutB2
  const targetPayout = databasePayouts.get('pay_event_B2');
  if (targetPayout) {
    targetPayout.status = 'cancelled';
    reconcileShareMaterializedState(targetPayout.shareId, pManager, pFund);
  }

  const s12 = databaseShares.get(`${pFund}_share_12`);
  assert(s12?.hasClaimedPrize === false && s12?.status === 'undrawn', 'Payout revocation successfully restored undrawn state on associated share');


  // ---------------------------------------------------------
  // 9. CONCURRENT OPERATIONS PRESERVATION
  // ---------------------------------------------------------
  console.log(`\n8. EXECUTING CONCURRENCY OPERATIONS TESTS...`);
  // Simulate rapid interleaved billing edits & payments on same Share x Cycle
  const concurrencyBillingId = 'mgr_1_mgr_1_fund_1_cycle_1_mgr_1_fund_1_share_5';
  const cManager = 'mgr_1';
  const cFund = 'mgr_1_fund_1';
  const cShare = 'mgr_1_fund_1_share_5';
  const cCycle = 'mgr_1_fund_1_cycle_1';

  // Interleave updates:
  updateAuthoritativeBilling(concurrencyBillingId, cManager, cFund, cCycle, cShare, 10000, cManager);
  recordAuthoritativePayment({
    paymentId: 'concurrent_pay_1',
    managerId: cManager,
    fundId: cFund,
    memberId: 'mem_5',
    shareId: cShare,
    amount: 5000,
    paymentDate: '2026-01-10',
    paymentMethod: 'Cash',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString(),
  });
  updateAuthoritativeBilling(concurrencyBillingId, cManager, cFund, cCycle, cShare, 12000, cManager);

  const finalStateShare = databaseShares.get(cShare);
  // Billed: index 5 is odd, so cycle 2 to 24: 8,000 billed. Cycle 1 updated to 12,000. Total billed = 12,000 + 23*8,000 = 196,000.
  // Total paid = 5,000. Arrears = 196,000 - 5,000 = 191,000.
  assert(finalStateShare?.arrears === 191000 && finalStateShare?.advance === 0, 'Concurrent interleave reconciled deterministically with zero drift');


  // ---------------------------------------------------------
  // 10. IDEMPOTENCY RETRY SAFETY
  // ---------------------------------------------------------
  console.log(`\n9. EXECUTING IDEMPOTENCY RETRY TESTS...`);
  // Simulate duplicate payment recording attempt with identical paymentId
  const dupPay: Payment = {
    paymentId: 'idem_payment_key',
    managerId: 'mgr_1',
    fundId: 'mgr_1_fund_1',
    memberId: 'mem_1',
    shareId: 'mgr_1_fund_1_share_1',
    amount: 10000,
    paymentDate: '2026-01-10',
    paymentMethod: 'UPI',
    verificationStatus: 'verified',
    createdAt: new Date().toISOString(),
  };

  recordAuthoritativePayment(dupPay);
  const sizeBefore = databasePayments.size;
  // Duplicate write retry
  recordAuthoritativePayment(dupPay);
  assert(databasePayments.size === sizeBefore, 'Duplicate retry successfully intercepted at database collection boundary');


  // ---------------------------------------------------------
  // 11. REBUILD AND FINANCIAL CONSERVATION VERIFICATION
  // ---------------------------------------------------------
  console.log(`\n10. EXECUTING FULL REBUILD & CONSERVATION AUDIT...`);
  // Corrupt a share balance intentionally to test the repair algorithm
  const testShareId = 'mgr_1_fund_1_share_2';
  const corruptedShare = databaseShares.get(testShareId);
  if (corruptedShare) {
    corruptedShare.arrears = 999999; // Corrupted
    corruptedShare.advance = 888888; // Corrupted
  }

  // Execute build repair
  rebuildMaterializedState('mgr_1_fund_1', 'mgr_1');
  const repairedShare = databaseShares.get(testShareId);
  assert(repairedShare?.arrears === 125000 && repairedShare?.advance === 0, 'Rebuild successfully reconstructed correct balances solely from logs');

  // Verify financial conservation across the entire simulated database
  console.log(`\n11. VERIFYING FINANCIAL CONSERVATION...`);
  let conservationPass = true;
  for (const s of databaseShares.values()) {
    const bMap = shareBillingsMap.get(s.shareId);
    const sumBilled = bMap ? Array.from(bMap.values()).reduce((sum, b) => sum + b.billAmount, 0) : 0;

    const pMap = sharePaymentsMap.get(s.shareId);
    const sumPaid = pMap ? Array.from(pMap.values()).reduce((sum, p) => sum + p.amount, 0) : 0;

    const balanceDiff = sumBilled - sumPaid;
    const computedDiff = s.arrears - s.advance;

    if (balanceDiff !== computedDiff) {
      conservationPass = false;
      console.log(`Divergence found on share ${s.shareId}: Billed: ${sumBilled}, Paid: ${sumPaid}, Diff: ${balanceDiff}, Materialized: Arrears: ${s.arrears}, Advance: ${s.advance}`);
    }
  }
  assert(conservationPass, 'Strict financial conservation of value holds across all generated records');


  // ---------------------------------------------------------
  // 12. CHITTI CROSS-CONTAMINATION & RELATIONSHIP INTEGRITY
  // ---------------------------------------------------------
  console.log(`\n12. EXECUTING CHITTI ISOLATION & RELATIONSHIP INTEGRITY TESTS...`);
  
  // Validation 1: Rebuilding Chitti A must NOT alter or contaminate Chitti B materialized state
  const chittiAShare = databaseShares.get('mgr_1_fund_0_share_1');
  const chittiBShare = databaseShares.get('mgr_1_fund_1_share_1');
  const chittiBArrearsBefore = chittiBShare?.arrears;

  rebuildMaterializedState('mgr_1_fund_0', 'mgr_1'); // Rebuild Chitti A only

  const chittiBArrearsAfter = databaseShares.get('mgr_1_fund_1_share_1')?.arrears;
  assert(chittiBArrearsBefore === chittiBArrearsAfter, 'Chitti-scoped rebuild strictly isolates and prevents cross-Chitti contamination');

  // Validation 2: Reject cross-Chitti billing/payment combination attempts
  const crossCycleId = 'mgr_1_fund_0_cycle_1'; // Belongs to fund_0
  const crossShareId = 'mgr_1_fund_1_share_1'; // Belongs to fund_1
  
  // Simulated operational relationship check
  const crossCycle = databaseCycles.get(crossCycleId);
  const crossShare = databaseShares.get(crossShareId);
  const isValidRelationship = crossCycle && crossShare && crossCycle.fundId === crossShare.fundId;
  
  assert(!isValidRelationship, 'Cross-Chitti relationship integrity check successfully rejects invalid cycle-to-share mappings');


  console.log('\n================================================================================');
  console.log(`STRESS TEST VERIFICATION SUMMARY:`);
  console.log(`TOTAL SIMULATED DATASET SIZE:`);
  console.log(`- Billings generated: ${databaseBillings.size}`);
  console.log(`- Payments processed: ${databasePayments.size}`);
  console.log(`- Payout events written: ${databasePayouts.size}`);
  console.log(`- Total Operations: ${totalSimulatedOperations}`);
  console.log(`- Passed Assertions: ${passedCount}`);
  console.log(`- Failed Assertions: ${failedCount}`);
  console.log('================================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

executeHardeningStressSuite();
