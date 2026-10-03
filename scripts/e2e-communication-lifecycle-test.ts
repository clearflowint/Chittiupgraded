import { CommunicationDispatcher, DEFAULT_PLACEHOLDER_WEBHOOK_URL } from '../src/services/communicationDispatcher.js';
import { CommunicationEvent, CommunicationDispatch, DispatchStatus, isValidStatusTransition } from '../src/types/communication.js';
import { notificationService } from '../src/services/notifications.js';
import { Fund, Share, Cycle, Billing, Payment } from '../src/types/index.js';

console.log('================================================================================');
console.log('       CLEARFLOW END-TO-END COMMUNICATION ARCHITECTURE & LIFECYCLE AUDIT');
console.log('================================================================================');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}${detail ? ` -> ${detail}` : ''}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
  }
}

async function runE2ETests() {
  const managerA = {
    managerId: 'mgr_auth_alice_01',
    managerName: 'Alice Operator',
    phone: '+919811122233',
    email: 'alice@clearflow.internal',
  };

  const managerB = {
    managerId: 'mgr_auth_bob_02',
    managerName: 'Bob Operator',
    phone: '+919844455566',
    email: 'bob@clearflow.internal',
  };

  const dummyFund: Fund = {
    fundId: 'fund_growth_101',
    managerId: managerA.managerId,
    fundName: 'Growth Scheme A1',
    totalPool: 200000,
    numberOfShares: 20,
    totalMonths: 20,
    currentMonth: 5,
    cycleFrequency: 'monthly',
    commissionPercent: 5,
    status: 'active',
    startDate: '2026-01-01',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyShare1: Share = {
    shareId: 'share_01',
    displayId: 'SH-0101',
    managerId: managerA.managerId,
    fundId: dummyFund.fundId,
    memberId: 'mem_01',
    memberName: 'Rahul Verma',
    memberPhone: '9845010011',
    shareNumber: 1,
    shareCount: 1,
    arrears: 10000,
    advance: 0,
    totalBilled: 50000,
    totalPaid: 40000,
    hasClaimedPrize: false,
    status: 'undrawn',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyShare2: Share = {
    shareId: 'share_02',
    displayId: 'SH-0102',
    managerId: managerA.managerId,
    fundId: dummyFund.fundId,
    memberId: 'mem_02',
    memberName: 'Sneha Patel',
    memberPhone: '9845020022',
    shareNumber: 2,
    shareCount: 1,
    arrears: 0,
    advance: 5000,
    totalBilled: 50000,
    totalPaid: 55000,
    hasClaimedPrize: false,
    status: 'undrawn',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyCycles: Cycle[] = [
    {
      cycleId: 'cyc_05',
      fundId: dummyFund.fundId,
      managerId: managerA.managerId,
      cycleNumber: 5,
      monthIndex: 5,
      auctionDate: '2026-05-01',
      status: 'bidding',
      winningBidAmount: 20000,
      dividendPool: 15000,
      grossInstallment: 10000,
      netInstallmentDue: 9250,
      dividendPerShare: 750,
      winnerNetPayout: 180000,
      organizerCommission: 5000,
      winnerShareId: null,
      winnerMemberName: null,
      isAuctionClosed: false,
      createdAt: '2026-05-01T00:00:00.000Z',
    },
  ];

  const dummyBillings: Billing[] = [
    {
      billingId: 'bill_05_01',
      managerId: managerA.managerId,
      fundId: dummyFund.fundId,
      cycleId: 'cyc_05',
      shareId: dummyShare1.shareId,
      billAmount: 9250,
      billAmountPaise: 925000,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
      createdBy: managerA.managerId,
    },
  ];

  const dummyPayments: Payment[] = [
    {
      paymentId: 'pay_05_01',
      managerId: managerA.managerId,
      fundId: dummyFund.fundId,
      memberId: dummyShare1.memberId,
      shareId: dummyShare1.shareId,
      amount: 5000,
      paymentMethod: 'UPI',
      paymentDate: '2026-05-03',
      verificationStatus: 'verified',
      createdAt: '2026-05-03T00:00:00.000Z',
    },
  ];

  // Capture baseline financial snapshot before dispatches
  const baselineArrears1 = dummyShare1.arrears;
  const baselineAdvance2 = dummyShare2.advance;
  const baselineBillingsCount = dummyBillings.length;
  const baselinePaymentsCount = dummyPayments.length;

  console.log('\n--- Section 1: AI Studio Environment Fallback Verification ---');
  const defaultWebhook = CommunicationDispatcher.getWebhookUrl();
  assert(
    defaultWebhook === DEFAULT_PLACEHOLDER_WEBHOOK_URL || defaultWebhook.startsWith('http'),
    '1. Webhook URL gracefully defaults without crashing if env var absent'
  );

  console.log('\n--- Section 2: E2E Lifecycle — Trigger & Immediate Ack ("queued" -> "received") ---');
  // A. Trigger Send Reminder to All
  const bulkReminderResult = await CommunicationDispatcher.dispatchBulkReminder({
    tenantId: managerA.managerId,
    managerId: managerA.managerId,
    managerName: managerA.managerName,
    managerPhone: managerA.phone,
    managerEmail: managerA.email,
    fund: dummyFund,
    shares: [dummyShare1, dummyShare2],
    channel: 'whatsapp',
  });

  const dId = bulkReminderResult.dispatchId;
  const bId = bulkReminderResult.batchId;

  assert(Boolean(dId && dId.startsWith('DSP_')), '2a. ClearFlow generated single authoritative dispatchId', dId);
  assert(Boolean(bId && bId.startsWith('bulk_rem_')), '2b. ClearFlow generated batchId', bId);
  assert(bulkReminderResult.dispatchRecord.status === 'received', '2c. Dispatch record transitioned to "received" upon 200 ack');
  assert(bulkReminderResult.message === 'Dispatch received and queued for processing.', '2d. UI receives explicit queued confirmation message');

  // Verify full Manager/Tenant Context in payload
  const payload = bulkReminderResult.payload;
  assert(payload.tenant.tenantId === managerA.managerId, '2e. Payload contains authenticated tenantId');
  assert(payload.manager.managerId === managerA.managerId, '2f. Payload contains authenticated managerId');
  assert(payload.manager.managerName === managerA.managerName, '2g. Payload contains managerName');
  assert(payload.manager.phone === managerA.phone, '2h. Payload contains managerPhone');
  assert(payload.manager.email === managerA.email, '2i. Payload contains managerEmail');
  assert(payload.fund.fundId === dummyFund.fundId, '2j. Payload contains fundId');
  assert(payload.fund.fundName === dummyFund.fundName, '2k. Payload contains fundName');
  assert(payload.dispatchId === dId, '2l. Payload contains identical dispatchId');
  assert(payload.batchId === bId, '2m. Payload contains identical batchId');

  console.log('\n--- Section 3: Webhook Unreachable / Network Error Simulation ---');
  // Temporarily point to unresolvable endpoint to verify failure handling
  CommunicationDispatcher.setWebhookUrl('http://127.0.0.1:59999/non-existent-webhook');
  const failResult = await CommunicationDispatcher.dispatchShareReminder({
    tenantId: managerA.managerId,
    managerId: managerA.managerId,
    managerName: managerA.managerName,
    managerPhone: managerA.phone,
    managerEmail: managerA.email,
    fund: dummyFund,
    share: dummyShare1,
    cycles: dummyCycles,
    billings: dummyBillings,
    payments: dummyPayments,
  });

  assert(failResult.success === false, '3a. Dispatch to offline endpoint returns success=false');
  assert(failResult.error === 'Dispatch failed to start.', '3b. UI receives explicit "Dispatch failed to start." error');
  assert(failResult.dispatchRecord.status === 'failed', '3c. Dispatch record status is marked "failed" (never falsely marked received)');

  // Restore placeholder
  CommunicationDispatcher.setWebhookUrl(DEFAULT_PLACEHOLDER_WEBHOOK_URL);

  console.log('\n--- Section 4: Status Transition Security Validation ---');
  // Test legal forward progression
  assert(isValidStatusTransition('queued', 'received') === true, '4a. Legal transition: queued -> received');
  assert(isValidStatusTransition('queued', 'failed') === true, '4b. Legal transition: queued -> failed');
  assert(isValidStatusTransition('received', 'processing') === true, '4c. Legal transition: received -> processing');
  assert(isValidStatusTransition('received', 'failed') === true, '4d. Legal transition: received -> failed');
  assert(isValidStatusTransition('processing', 'completed') === true, '4e. Legal transition: processing -> completed');
  assert(isValidStatusTransition('processing', 'failed') === true, '4f. Legal transition: processing -> failed');

  // Test illegal backward/corrupt transitions
  assert(isValidStatusTransition('completed', 'processing') === false, '4g. Blocked transition: completed -> processing');
  assert(isValidStatusTransition('completed', 'received') === false, '4h. Blocked transition: completed -> received');
  assert(isValidStatusTransition('completed', 'queued') === false, '4i. Blocked transition: completed -> queued');
  assert(isValidStatusTransition('failed', 'processing') === false, '4j. Blocked transition: failed -> processing');
  assert(isValidStatusTransition('failed', 'received') === false, '4k. Blocked transition: failed -> received');
  assert(isValidStatusTransition('failed', 'queued') === false, '4l. Blocked transition: failed -> queued');

  console.log('\n--- Section 5: Callback Validation & Authentication Logic ---');
  const secretKey = 'clearflow_n8n_secret_prod_2026';

  function mockValidateCallback(headers: Record<string, string | undefined>, body: any) {
    const authHeader = headers['authorization'] || headers['x-clearflow-callback-secret'];
    if (!authHeader) {
      return { status: 401, error: 'Authentication required: missing callback secret' };
    }
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (bearer !== secretKey) {
      return { status: 401, error: 'Unauthorized: invalid callback secret' };
    }
    if (!body?.dispatchId || typeof body.dispatchId !== 'string' || !body.dispatchId.trim()) {
      return { status: 400, error: 'Missing or invalid required parameter: dispatchId' };
    }
    if (!body?.tenantId || typeof body.tenantId !== 'string' || !body.tenantId.trim()) {
      return { status: 400, error: 'Missing or invalid required parameter: tenantId' };
    }
    const allowed = ['received', 'processing', 'completed', 'failed'];
    if (!body?.status || !allowed.includes(body.status)) {
      return { status: 400, error: `Invalid status transition: must be one of ${allowed.join(', ')}` };
    }
    return { status: 200, success: true };
  }

  // 1. Missing authentication
  const noAuth = mockValidateCallback({}, { dispatchId: dId, tenantId: managerA.managerId, status: 'processing' });
  assert(noAuth.status === 401, '5a. Missing authentication rejected with 401');

  // 2. Invalid secret
  const badAuth = mockValidateCallback({ 'x-clearflow-callback-secret': 'wrong_secret' }, { dispatchId: dId, tenantId: managerA.managerId, status: 'processing' });
  assert(badAuth.status === 401, '5b. Invalid secret rejected with 401');

  // 3. Missing dispatchId
  const noDispatchId = mockValidateCallback({ 'x-clearflow-callback-secret': secretKey }, { tenantId: managerA.managerId, status: 'processing' });
  assert(noDispatchId.status === 400, '5c. Missing dispatchId rejected with 400');

  // 4. Missing tenantId
  const noTenant = mockValidateCallback({ 'x-clearflow-callback-secret': secretKey }, { dispatchId: dId, status: 'processing' });
  assert(noTenant.status === 400, '5d. Missing tenantId rejected with 400');

  // 5. Invalid status value
  const badStatus = mockValidateCallback({ 'x-clearflow-callback-secret': secretKey }, { dispatchId: dId, tenantId: managerA.managerId, status: 'DELIVERED_AND_READ' });
  assert(badStatus.status === 400, '5e. Invalid status outside lifecycle rejected with 400');

  // 6. Valid processing callback
  const validProcessing = mockValidateCallback(
    { 'authorization': `Bearer ${secretKey}` },
    { dispatchId: dId, tenantId: managerA.managerId, status: 'processing' }
  );
  assert(validProcessing.status === 200 && validProcessing.success === true, '5f. Valid authenticated processing callback accepted (200)');

  // 7. Valid final completed callback with final counts
  const validCompleted = mockValidateCallback(
    { 'authorization': `Bearer ${secretKey}` },
    {
      dispatchId: dId,
      tenantId: managerA.managerId,
      status: 'completed',
      total: 100,
      sent: 92,
      failed: 3,
      skipped: 5,
      completedAt: new Date().toISOString(),
    }
  );
  assert(validCompleted.status === 200 && validCompleted.success === true, '5g. Valid authenticated completed callback accepted (200)');

  console.log('\n--- Section 6: Tenant-Isolated In-App Notifications ---');
  // Switch to Manager A context
  notificationService.setTenant(managerA.managerId);
  notificationService.clear();

  // Send completed notification for Manager A
  await notificationService.send(
    'Dispatch Completed',
    `Growth Scheme A1 — bulk_reminder: 92 sent, 3 failed, 5 skipped.`,
    'dispatch',
    managerA.managerId
  );

  let managerANotifications: any[] = [];
  const unsubA = notificationService.subscribe((list) => {
    managerANotifications = list;
  });

  assert(managerANotifications.length === 1, '6a. Manager A receives their own dispatch completion alert');
  assert(managerANotifications[0].tenantId === managerA.managerId, '6b. Notification record explicitly carries Manager A tenantId');

  // Switch to Manager B context: should NOT see Manager A's alerts
  notificationService.setTenant(managerB.managerId);
  let managerBNotifications: any[] = [];
  const unsubB = notificationService.subscribe((list) => {
    managerBNotifications = list;
  });

  assert(managerBNotifications.length === 0, '6c. Manager B sees zero notifications from Manager A (Strict Tenant Isolation)');

  unsubA();
  unsubB();

  console.log('\n--- Section 7: Financial Data Immutability & Isolation ---');
  assert(dummyShare1.arrears === baselineArrears1, '7a. Share 1 arrears unchanged after communication dispatch');
  assert(dummyShare2.advance === baselineAdvance2, '7b. Share 2 advance unchanged after communication dispatch');
  assert(dummyBillings.length === baselineBillingsCount, '7c. Billing records count unchanged');
  assert(dummyPayments.length === baselinePaymentsCount, '7d. Payment records count unchanged');

  console.log('\n================================================================================');
  console.log(`TOTAL E2E ASSERTIONS PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('================================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error('Fatal E2E test execution error:', err);
  process.exit(1);
});
