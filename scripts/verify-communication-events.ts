import { CommunicationDispatcher, DEFAULT_PLACEHOLDER_WEBHOOK_URL } from '../src/services/communicationDispatcher.js';
import { CommunicationEvent, CommunicationWebhookPayload } from '../src/types/communication.js';
import { Fund, Share, Cycle, Billing, Payment } from '../src/types/index.js';

console.log('================================================================================');
console.log('       CLEARFLOW COMMUNICATION & WEBHOOK EVENT ARCHITECTURE VERIFICATION');
console.log('================================================================================');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${msg}`);
  } else {
    failedCount++;
    console.log(`[FAIL] ${msg}`);
  }
}

async function runCommunicationTests() {
  const dummyFund: Fund = {
    fundId: 'fund_apex_01',
    managerId: 'mgr_ravi_01',
    fundName: 'Apex Wealth Scheme',
    totalPool: 120000,
    numberOfShares: 12,
    totalMonths: 12,
    currentMonth: 8,
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
    managerId: 'mgr_ravi_01',
    fundId: 'fund_apex_01',
    memberId: 'mem_01',
    memberName: 'Mahesh Kumar',
    memberPhone: '9845010011',
    shareNumber: 1,
    shareCount: 1,
    arrears: 5000,
    advance: 0,
    totalBilled: 40000,
    totalPaid: 35000,
    hasClaimedPrize: false,
    status: 'undrawn',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyShare2: Share = {
    shareId: 'share_02',
    displayId: 'SH-0102',
    managerId: 'mgr_ravi_01',
    fundId: 'fund_apex_01',
    memberId: 'mem_02',
    memberName: 'Priya Sharma',
    memberPhone: '9845020022',
    shareNumber: 2,
    shareCount: 1,
    arrears: 0,
    advance: 2000,
    totalBilled: 40000,
    totalPaid: 42000,
    hasClaimedPrize: false,
    status: 'undrawn',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const dummyCycles: Cycle[] = [
    {
      cycleId: 'cyc_01',
      fundId: 'fund_apex_01',
      managerId: 'mgr_ravi_01',
      cycleNumber: 8,
      monthIndex: 8,
      auctionDate: '2026-08-01',
      status: 'bidding',
      winningBidAmount: 15000,
      dividendPool: 10000,
      grossInstallment: 10000,
      netInstallmentDue: 8750,
      dividendPerShare: 1250,
      winnerNetPayout: 100000,
      organizerCommission: 5000,
      winnerShareId: null,
      winnerMemberName: null,
      isAuctionClosed: false,
      createdAt: '2026-08-01T00:00:00.000Z',
    },
  ];

  const dummyBillings: Billing[] = [
    {
      billingId: 'bill_01',
      managerId: 'mgr_ravi_01',
      fundId: 'fund_apex_01',
      cycleId: 'cyc_01',
      shareId: 'share_01',
      billAmount: 8750,
      billAmountPaise: 875000,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
      createdBy: 'mgr_ravi_01',
    },
  ];

  const dummyPayments: Payment[] = [
    {
      paymentId: 'pay_01',
      managerId: 'mgr_ravi_01',
      fundId: 'fund_apex_01',
      memberId: 'mem_01',
      shareId: 'share_01',
      amount: 3750,
      paymentMethod: 'UPI',
      paymentDate: '2026-08-05',
      verificationStatus: 'verified',
      createdAt: '2026-08-05T00:00:00.000Z',
    },
  ];

  // 1. Test Individual Reminder -> share_reminder
  const res1 = await CommunicationDispatcher.dispatchShareReminder({
    tenantId: 'tenant_ravi_01',
    managerId: 'mgr_ravi_01',
    managerName: 'Ravi Kumar',
    managerPhone: '+919876543210',
    fund: dummyFund,
    share: dummyShare1,
    cycles: dummyCycles,
    billings: dummyBillings,
    payments: dummyPayments,
  });

  assert(res1.event === 'share_reminder', '1. Individual Reminder dispatches event="share_reminder"');
  assert(res1.payload.event === 'share_reminder', '1b. Payload event is "share_reminder"');
  assert(res1.payload.recipient.memberId === 'mem_01', '1c. Recipient memberId mapped correctly');
  assert(res1.payload.recipient.phone.startsWith('+91'), '1d. Normalized recipient phone used');
  assert(res1.payload.options.sendReminder === true, '1e. Options sendReminder is true');
  assert(Boolean(res1.dispatchId && res1.batchId), '1f. Unique dispatchId and batchId present');
  assert(res1.dispatchRecord.status === 'received', '1g. Initial successful dispatch status is "received"');
  assert(Boolean(res1.payload.tenant.tenantId && res1.payload.manager.managerId && res1.payload.manager.managerName), '1h. Tenant and Manager variables present in payload');

  // 2. Test Reminder to All -> bulk_reminder
  const res2 = await CommunicationDispatcher.dispatchBulkReminder({
    tenantId: 'tenant_ravi_01',
    managerId: 'mgr_ravi_01',
    managerName: 'Ravi Kumar',
    managerPhone: '+919876543210',
    fund: dummyFund,
    shares: [dummyShare1, dummyShare2],
  });

  assert(res2.event === 'bulk_reminder', '2. Reminder to All dispatches event="bulk_reminder"');
  assert(res2.payload.event === 'bulk_reminder', '2b. Payload event is "bulk_reminder"');
  assert(Array.isArray(res2.payload.recipients), '2c. Bulk recipients is an array');
  assert(res2.payload.recipients?.length === 2, '2d. Both valid shares included in bulk recipients');
  assert(res2.payload.recipients?.[0].memberId === 'mem_01', '2e. Recipient 1 has correct memberId');
  assert(res2.payload.recipients?.[0].phone === '+919845010011', '2f. Recipient 1 has normalized phone');
  assert(res2.payload.recipients?.[0].shareId === 'SH-0101', '2g. Recipient 1 has shareId');
  assert(res2.payload.recipients?.[0].fundName === 'Apex Wealth Scheme', '2h. Recipient 1 has fundName');
  assert(Boolean(res2.payload.recipients?.[0].message), '2i. Recipient 1 has message');
  assert(res2.payload.options.sendReminder === true, '2j. Bulk reminder options.sendReminder is true');
  assert(res2.payload.campaign.targetType === 'PENDING_MEMBERS', '2k. Campaign targetType is PENDING_MEMBERS');

  // 3. Test Individual Statement -> share_statement
  const res3 = await CommunicationDispatcher.dispatchShareStatement({
    tenantId: 'tenant_ravi_01',
    managerId: 'mgr_ravi_01',
    managerName: 'Ravi Kumar',
    managerPhone: '+919876543210',
    fund: dummyFund,
    share: dummyShare1,
    cycles: dummyCycles,
    billings: dummyBillings,
    payments: dummyPayments,
  });

  assert(res3.event === 'share_statement', '3. Individual Statement dispatches event="share_statement"');
  assert(res3.payload.event === 'share_statement', '3b. Payload event is "share_statement"');
  assert(res3.payload.statement.available === true, '3c. Statement available is true');
  assert(res3.payload.options.sendStatement === true, '3d. Options sendStatement is true');

  // 4. Test Statement to All -> bulk_statement
  const res4 = await CommunicationDispatcher.dispatchBulkStatement({
    tenantId: 'tenant_ravi_01',
    managerId: 'mgr_ravi_01',
    managerName: 'Ravi Kumar',
    managerPhone: '+919876543210',
    fund: dummyFund,
    shares: [dummyShare1, dummyShare2],
    cycles: dummyCycles,
    billings: dummyBillings,
    payments: dummyPayments,
  });

  assert(res4.event === 'bulk_statement', '4. Statement to All dispatches event="bulk_statement"');
  assert(res4.payload.event === 'bulk_statement', '4b. Payload event is "bulk_statement"');
  assert(Array.isArray(res4.payload.recipients) && res4.payload.recipients.length === 2, '4c. Bulk statement recipients count matches');
  assert(res4.payload.options.sendStatement === true, '4d. Options sendStatement is true');

  // 5. Test CRM Campaign -> campaign_launch
  const res5 = await CommunicationDispatcher.dispatchCampaignLaunch({
    tenantId: 'tenant_ravi_01',
    managerId: 'mgr_ravi_01',
    managerName: 'Ravi Kumar',
    campaignId: 'cmp_festive_01',
    title: 'Festive Scheme 2026',
    message: 'Join new chit group today!',
    channels: ['WHATSAPP', 'SMS'],
    targetType: 'MEMBERS',
    targetId: 'ALL',
    fundId: dummyFund.fundId,
    fundName: dummyFund.fundName,
    recipientCount: 50,
  });

  assert(res5.event === 'campaign_launch', '5. CRM Campaign dispatches event="campaign_launch"');
  assert(res5.payload.event === 'campaign_launch', '5b. Payload event is "campaign_launch"');
  assert(res5.payload.campaign.campaignId === 'cmp_festive_01', '5c. Campaign ID mapped correctly');

  // 6. Test Sample Payloads contract
  const events: CommunicationEvent[] = [
    'share_reminder',
    'bulk_reminder',
    'share_statement',
    'bulk_statement',
    'campaign_launch',
  ];

  for (const ev of events) {
    const sample = CommunicationDispatcher.getSamplePayload(ev);
    assert(sample.event === ev, `6. getSamplePayload("${ev}") returns event="${ev}"`);
    assert(Boolean(sample.batchId && sample.dispatchId && sample.timestamp), `6b. Sample "${ev}" has batchId, dispatchId, timestamp`);
    assert(Boolean(sample.tenant && sample.fund && sample.manager), `6c. Sample "${ev}" has tenant, fund, manager`);
  }

  console.log('================================================================================');
  console.log(`TOTAL PASSED: ${passedCount} | TOTAL FAILED: ${failedCount}`);
  console.log('================================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runCommunicationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
