import {
  CommunicationEvent,
  CommunicationWebhookPayload,
  DispatchResult,
  WebhookBulkRecipient,
  CommunicationDispatch,
  DispatchStatus,
} from '../types/communication';
import { Share, Fund, Cycle, Billing, Payment } from '../types';
import { generateShareStatement, buildWebhookStatementObject } from './statementService';
import { FinancialEngine } from './financialEngine';

const STORAGE_KEY_WEBHOOK_URL = 'clearflow_communication_webhook_url';
export const DEFAULT_PLACEHOLDER_WEBHOOK_URL = 'https://YOUR-N8N-WEBHOOK-URL-HERE';
let inMemoryWebhookUrl: string | null = null;

/**
 * Normalizes phone numbers to standard 10-digit / E.164-compatible format
 */
export function normalizeRecipientPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return digits ? `+${digits}` : '';
}

/**
 * Validates whether a phone number is usable for outbound automation
 */
export function isUsablePhone(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 10;
}

/**
 * Centralized Outbound Communication Dispatcher for ClearFlow
 *
 * ARCHITECTURAL BOUNDARY:
 * - ClearFlow is strictly a trigger/handoff point.
 * - ClearFlow prepares authorized data and dispatches to ONE outbound webhook.
 * - n8n receives the structured payload and handles queues, loops, delays, rate-limits, retries, and provider delivery.
 * - Read-only with respect to all ClearFlow financial domains (Billing, Payments, Payouts, Arrears, Advance).
 */
export class CommunicationDispatcher {
  /**
   * Retrieves the configured webhook URL.
   * Order of precedence:
   * 1. localStorage override
   * 2. import.meta.env.VITE_COMMUNICATION_WEBHOOK_URL
   * 3. Placeholder default
   */
  static getWebhookUrl(): string {
    if (inMemoryWebhookUrl && inMemoryWebhookUrl.trim()) {
      return inMemoryWebhookUrl.trim();
    }
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(STORAGE_KEY_WEBHOOK_URL);
      if (stored && stored.trim()) return stored.trim();
    }
    const envUrl = import.meta.env?.VITE_COMMUNICATION_WEBHOOK_URL;
    if (typeof envUrl === 'string' && envUrl.trim()) {
      return envUrl.trim();
    }
    return DEFAULT_PLACEHOLDER_WEBHOOK_URL;
  }

  /**
   * Sets the configured webhook URL in localStorage
   */
  static setWebhookUrl(url: string): void {
    if (!url || url.trim() === '' || url === DEFAULT_PLACEHOLDER_WEBHOOK_URL) {
      inMemoryWebhookUrl = null;
    } else {
      inMemoryWebhookUrl = url.trim();
    }
    if (typeof window !== 'undefined') {
      if (!url || url.trim() === '' || url === DEFAULT_PLACEHOLDER_WEBHOOK_URL) {
        window.localStorage.removeItem(STORAGE_KEY_WEBHOOK_URL);
      } else {
        window.localStorage.setItem(STORAGE_KEY_WEBHOOK_URL, url.trim());
      }
    }
  }

  /**
   * Returns true if a live custom webhook endpoint has been configured
   */
  static isLiveConfigured(): boolean {
    const url = this.getWebhookUrl();
    return Boolean(url && url !== DEFAULT_PLACEHOLDER_WEBHOOK_URL && url.startsWith('http'));
  }

  /**
   * Generates a unified, consistent dispatchId
   */
  static generateDispatchId(): string {
    return `DSP_${Date.now()}_${FinancialEngine.generateCryptoToken().slice(0, 6)}`;
  }

  /**
   * Creates a standardized initial CommunicationDispatch record
   */
  static createDispatchRecord(params: {
    dispatchId: string;
    batchId: string;
    tenantId: string;
    managerId: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    fundId: string;
    fundName: string;
    event: CommunicationEvent;
    channel: string;
    recipientCount: number;
    status?: DispatchStatus;
    total?: number;
  }): CommunicationDispatch {
    const now = new Date().toISOString();
    return {
      dispatchId: params.dispatchId,
      batchId: params.batchId,
      tenantId: params.tenantId,
      managerId: params.managerId,
      managerName: params.managerName || 'Operations Manager',
      managerPhone: params.managerPhone || '',
      managerEmail: params.managerEmail || '',
      fundId: params.fundId,
      fundName: params.fundName,
      event: params.event,
      channel: params.channel,
      recipientCount: params.recipientCount,
      status: params.status || 'queued',
      total: params.total ?? params.recipientCount,
      sent: 0,
      failed: 0,
      skipped: 0,
      createdAt: now,
      completedAt: null,
      updatedAt: now,
    };
  }

  /**
   * Dispatches any structured payload to the ONE centralized webhook
   */
  static async dispatch(payload: CommunicationWebhookPayload): Promise<DispatchResult> {
    const endpointUrl = this.getWebhookUrl();
    const isPlaceholder = endpointUrl === DEFAULT_PLACEHOLDER_WEBHOOK_URL || !endpointUrl.startsWith('http');

    console.log(`[ClearFlow Webhook] Outbound event: "${payload.event}" to: ${endpointUrl}`);
    console.log(`[ClearFlow Webhook] Payload:`, payload);

    if (isPlaceholder) {
      // Development mode simulation: immediate acknowledgement returned
      return {
        success: true,
        event: payload.event,
        dispatchId: payload.dispatchId,
        batchId: payload.batchId,
        status: 200,
        simulated: true,
        endpointUrl,
        message: 'Dispatch received and queued for processing.',
        payload,
      };
    }

    try {
      const res = await fetch(endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ClearFlow-Event': payload.event,
          'X-ClearFlow-Batch-Id': payload.batchId,
          'X-ClearFlow-Dispatch-Id': payload.dispatchId,
          'X-ClearFlow-Tenant-Id': payload.tenant.tenantId,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => 'No response body');
        console.warn(`[ClearFlow Webhook] Server responded with status ${res.status}:`, errorText);
        return {
          success: false,
          event: payload.event,
          dispatchId: payload.dispatchId,
          batchId: payload.batchId,
          status: res.status,
          error: 'Dispatch failed to start.',
          endpointUrl,
          payload,
        };
      }

      let ackData: any = null;
      try {
        ackData = await res.json();
      } catch (e) {
        // Not all webhooks return JSON bodies
      }

      if (ackData && ackData.accepted === false) {
        return {
          success: false,
          event: payload.event,
          dispatchId: payload.dispatchId,
          batchId: payload.batchId,
          status: res.status,
          error: ackData.message || 'Dispatch failed to start.',
          endpointUrl,
          payload,
        };
      }

      return {
        success: true,
        event: payload.event,
        dispatchId: payload.dispatchId,
        batchId: payload.batchId,
        status: res.status,
        message: 'Dispatch received and queued for processing.',
        endpointUrl,
        payload,
      };
    } catch (err: any) {
      console.error(`[ClearFlow Webhook] Network exception:`, err);
      return {
        success: false,
        event: payload.event,
        dispatchId: payload.dispatchId,
        batchId: payload.batchId,
        error: 'Dispatch failed to start.',
        endpointUrl,
        payload,
      };
    }
  }

  /**
   * Dispatches an Individual Share Reminder (`share_reminder`)
   */
  static async dispatchShareReminder(params: {
    tenantId: string;
    managerId: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    fund: Fund;
    share: Share;
    cycles: Cycle[];
    billings: Billing[];
    payments: Payment[];
    customMessage?: string;
    channel?: string;
  }): Promise<DispatchResult & { dispatchRecord: CommunicationDispatch }> {
    const {
      tenantId,
      managerId,
      managerName = 'Operations Manager',
      managerPhone = '',
      managerEmail = '',
      fund,
      share,
      cycles,
      billings,
      payments,
      customMessage,
      channel = 'whatsapp',
    } = params;

    const statementData = generateShareStatement({
      share,
      fund,
      cycles,
      billings,
      payments,
      managerName,
      managerPhone,
    });

    const now = new Date().toISOString();
    const batchId = `rem_batch_${Date.now()}_${FinancialEngine.generateCryptoToken().slice(0, 6)}`;
    const dispatchId = this.generateDispatchId();
    const normalizedPhone = normalizeRecipientPhone(share.memberPhone);

    const message = customMessage || statementData.personalizedTextMessage;

    const payload: CommunicationWebhookPayload = {
      event: 'share_reminder',
      batchId,
      dispatchId,
      timestamp: now,
      tenant: { tenantId },
      fund: { fundId: fund.fundId, fundName: fund.fundName },
      manager: { managerId, managerName, phone: managerPhone, email: managerEmail },
      recipient: {
        memberId: share.memberId,
        memberName: share.memberName,
        phone: normalizedPhone,
        shareId: statementData.shareDisplayId,
      },
      communication: {
        channel,
        message,
        subject: `Chitti Reminder: ${fund.fundName}`,
        mediaUrl: '',
        documentUrl: '',
      },
      statement: buildWebhookStatementObject(statementData),
      campaign: {
        campaignId: '',
        targetType: '',
        targetId: '',
        channels: [channel],
      },
      options: {
        sendStatement: false,
        sendReminder: true,
        generateDocument: false,
      },
    };

    const res = await this.dispatch(payload);
    const dispatchRecord = this.createDispatchRecord({
      dispatchId,
      batchId,
      tenantId,
      managerId,
      managerName,
      managerPhone,
      managerEmail,
      fundId: fund.fundId,
      fundName: fund.fundName,
      event: 'share_reminder',
      channel,
      recipientCount: 1,
      status: res.success ? 'received' : 'failed',
    });

    return {
      ...res,
      dispatchRecord,
    };
  }

  /**
   * Dispatches Bulk Reminders (`bulk_reminder`) for pending members in the active Chitti in ONE single trigger
   */
  static async dispatchBulkReminder(params: {
    tenantId: string;
    managerId: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    fund: Fund;
    shares: Share[];
    customMessage?: string;
    channel?: string;
  }): Promise<DispatchResult & { eligibleCount: number; skippedCount: number; dispatchRecord: CommunicationDispatch }> {
    const {
      tenantId,
      managerId,
      managerName = 'Operations Manager',
      managerPhone = '',
      managerEmail = '',
      fund,
      shares,
      customMessage,
      channel = 'whatsapp',
    } = params;

    // Filter strictly to current authenticated tenant and active fund
    const fundShares = shares.filter((s) => s.fundId === fund.fundId && s.managerId === managerId);

    const eligibleRecipients: WebhookBulkRecipient[] = [];
    let skippedCount = 0;

    const currentMonthNum = fund.currentMonth;
    const dueInstallment = fund.totalMonths > 0 ? Math.round(fund.totalPool / fund.totalMonths) : 0;

    for (const share of fundShares) {
      if (!isUsablePhone(share.memberPhone)) {
        skippedCount++;
        continue;
      }

      const singleAmountDue = Math.max(dueInstallment, share.arrears || dueInstallment);
      const shareMessage = customMessage
        ? customMessage
        : `Dear ${share.memberName},\n\nThis is a friendly reminder from ${managerName} for "${fund.fundName}" (Month #${currentMonthNum}).\n\nOutstanding Due: ${FinancialEngine.formatCurrency(singleAmountDue)}\nStatus: Share #${share.shareNumber} (${share.status.toUpperCase()})\n\nPlease remit via UPI or bank wire at your earliest convenience to maintain your scheme allocation.\n\nThank you!`;

      const normalizedPhone = normalizeRecipientPhone(share.memberPhone);

      eligibleRecipients.push({
        memberId: share.memberId,
        memberName: share.memberName,
        phone: normalizedPhone,
        shareId: share.displayId || share.shareId,
        fundId: fund.fundId,
        fundName: fund.fundName,
        message: shareMessage,
      });
    }

    const now = new Date().toISOString();
    const batchId = `bulk_rem_${fund.fundId}_${Date.now()}`;
    const dispatchId = this.generateDispatchId();

    const payload: CommunicationWebhookPayload = {
      event: 'bulk_reminder',
      batchId,
      dispatchId,
      timestamp: now,
      tenant: { tenantId },
      fund: { fundId: fund.fundId, fundName: fund.fundName },
      manager: { managerId, managerName, phone: managerPhone, email: managerEmail },
      recipient: {
        memberId: '',
        memberName: '',
        phone: '',
        shareId: '',
      },
      communication: {
        channel,
        message: customMessage || `Bulk Reminders for ${fund.fundName} (${eligibleRecipients.length} recipients)`,
        subject: `Chitti Reminder: ${fund.fundName}`,
        mediaUrl: '',
        documentUrl: '',
      },
      statement: {
        available: false,
        shareId: '',
        memberName: '',
        fundName: fund.fundName,
        managerName,
        currentStatus: '',
        pendingAmount: 0,
        advanceAmount: 0,
        currentCycle: null,
        totalCycles: null,
        statementGeneratedAt: now,
      },
      campaign: {
        campaignId: '',
        targetType: 'PENDING_MEMBERS',
        targetId: fund.fundId,
        channels: [channel],
      },
      options: {
        sendStatement: false,
        sendReminder: true,
        generateDocument: false,
      },
      recipients: eligibleRecipients,
    };

    const result = await this.dispatch(payload);
    const dispatchRecord = this.createDispatchRecord({
      dispatchId,
      batchId,
      tenantId,
      managerId,
      managerName,
      managerPhone,
      managerEmail,
      fundId: fund.fundId,
      fundName: fund.fundName,
      event: 'bulk_reminder',
      channel,
      recipientCount: eligibleRecipients.length,
      status: result.success ? 'received' : 'failed',
    });

    return {
      ...result,
      eligibleCount: eligibleRecipients.length,
      skippedCount,
      dispatchRecord,
    };
  }

  /**
   * Dispatches an Individual Share Statement (`share_statement`)
   */
  static async dispatchShareStatement(params: {
    tenantId: string;
    managerId: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    fund: Fund;
    share: Share;
    cycles: Cycle[];
    billings: Billing[];
    payments: Payment[];
    customMessage?: string;
    channel?: string;
    generateDocument?: boolean;
  }): Promise<DispatchResult & { dispatchRecord: CommunicationDispatch }> {
    const {
      tenantId,
      managerId,
      managerName = 'Operations Manager',
      managerPhone = '',
      managerEmail = '',
      fund,
      share,
      cycles,
      billings,
      payments,
      customMessage,
      channel = 'whatsapp',
      generateDocument = false,
    } = params;

    const statementData = generateShareStatement({
      share,
      fund,
      cycles,
      billings,
      payments,
      managerName,
      managerPhone,
    });

    const now = new Date().toISOString();
    const batchId = `stmt_batch_${Date.now()}_${FinancialEngine.generateCryptoToken().slice(0, 6)}`;
    const dispatchId = this.generateDispatchId();
    const normalizedPhone = normalizeRecipientPhone(share.memberPhone);

    const message = customMessage || statementData.personalizedTextMessage;

    const payload: CommunicationWebhookPayload = {
      event: 'share_statement',
      batchId,
      dispatchId,
      timestamp: now,
      tenant: { tenantId },
      fund: { fundId: fund.fundId, fundName: fund.fundName },
      manager: { managerId, managerName, phone: managerPhone, email: managerEmail },
      recipient: {
        memberId: share.memberId,
        memberName: share.memberName,
        phone: normalizedPhone,
        shareId: statementData.shareDisplayId,
      },
      communication: {
        channel,
        message,
        subject: `Account Statement: ${fund.fundName}`,
        mediaUrl: '',
        documentUrl: '',
      },
      statement: buildWebhookStatementObject(statementData),
      campaign: {
        campaignId: '',
        targetType: '',
        targetId: '',
        channels: [channel],
      },
      options: {
        sendStatement: true,
        sendReminder: false,
        generateDocument,
      },
    };

    const res = await this.dispatch(payload);
    const dispatchRecord = this.createDispatchRecord({
      dispatchId,
      batchId,
      tenantId,
      managerId,
      managerName,
      managerPhone,
      managerEmail,
      fundId: fund.fundId,
      fundName: fund.fundName,
      event: 'share_statement',
      channel,
      recipientCount: 1,
      status: res.success ? 'received' : 'failed',
    });

    return {
      ...res,
      dispatchRecord,
    };
  }

  /**
   * Dispatches Bulk Statements (`bulk_statement`) for an entire active Chitti in ONE single trigger
   */
  static async dispatchBulkStatement(params: {
    tenantId: string;
    managerId: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    fund: Fund;
    shares: Share[];
    cycles: Cycle[];
    billings: Billing[];
    payments: Payment[];
    channel?: string;
  }): Promise<DispatchResult & { eligibleCount: number; skippedCount: number; dispatchRecord: CommunicationDispatch }> {
    const {
      tenantId,
      managerId,
      managerName = 'Operations Manager',
      managerPhone = '',
      managerEmail = '',
      fund,
      shares,
      cycles,
      billings,
      payments,
      channel = 'whatsapp',
    } = params;

    // Filter strictly to current authenticated tenant and active fund
    const fundShares = shares.filter((s) => s.fundId === fund.fundId && s.managerId === managerId);

    const eligibleRecipients: WebhookBulkRecipient[] = [];
    let skippedCount = 0;

    for (const share of fundShares) {
      if (!isUsablePhone(share.memberPhone)) {
        skippedCount++;
        continue;
      }

      const statementData = generateShareStatement({
        share,
        fund,
        cycles,
        billings,
        payments,
        managerName,
        managerPhone,
      });

      const normalizedPhone = normalizeRecipientPhone(share.memberPhone);

      eligibleRecipients.push({
        memberId: share.memberId,
        memberName: share.memberName,
        phone: normalizedPhone,
        shareId: statementData.shareDisplayId,
        fundId: fund.fundId,
        fundName: fund.fundName,
        statement: buildWebhookStatementObject(statementData),
        message: statementData.personalizedTextMessage,
      });
    }

    const now = new Date().toISOString();
    const batchId = `bulk_stmt_${fund.fundId}_${Date.now()}`;
    const dispatchId = this.generateDispatchId();

    const payload: CommunicationWebhookPayload = {
      event: 'bulk_statement',
      batchId,
      dispatchId,
      timestamp: now,
      tenant: { tenantId },
      fund: { fundId: fund.fundId, fundName: fund.fundName },
      manager: { managerId, managerName, phone: managerPhone, email: managerEmail },
      recipient: {
        memberId: '',
        memberName: '',
        phone: '',
        shareId: '',
      },
      communication: {
        channel,
        message: `Bulk Account Statements for ${fund.fundName} (${eligibleRecipients.length} recipients)`,
        subject: `Monthly Statements - ${fund.fundName}`,
        mediaUrl: '',
        documentUrl: '',
      },
      statement: {
        available: false,
        shareId: '',
        memberName: '',
        fundName: fund.fundName,
        managerName,
        currentStatus: '',
        pendingAmount: 0,
        advanceAmount: 0,
        currentCycle: null,
        totalCycles: null,
        statementGeneratedAt: now,
      },
      campaign: {
        campaignId: '',
        targetType: '',
        targetId: '',
        channels: [channel],
      },
      options: {
        sendStatement: true,
        sendReminder: false,
        generateDocument: false,
      },
      recipients: eligibleRecipients,
    };

    const result = await this.dispatch(payload);
    const dispatchRecord = this.createDispatchRecord({
      dispatchId,
      batchId,
      tenantId,
      managerId,
      managerName,
      managerPhone,
      managerEmail,
      fundId: fund.fundId,
      fundName: fund.fundName,
      event: 'bulk_statement',
      channel,
      recipientCount: eligibleRecipients.length,
      status: result.success ? 'received' : 'failed',
    });

    return {
      ...result,
      eligibleCount: eligibleRecipients.length,
      skippedCount,
      dispatchRecord,
    };
  }

  /**
   * Dispatches a Campaign Launch event (`campaign_launch`) to the centralized webhook
   */
  static async dispatchCampaignLaunch(params: {
    tenantId: string;
    managerId: string;
    managerName?: string;
    managerPhone?: string;
    managerEmail?: string;
    campaignId: string;
    title: string;
    message: string;
    channels: string[];
    targetType: string;
    targetId: string;
    fundId?: string;
    fundName?: string;
    recipientCount: number;
    recipients?: WebhookBulkRecipient[];
  }): Promise<DispatchResult & { dispatchRecord: CommunicationDispatch }> {
    const {
      tenantId,
      managerId,
      managerName = 'Operations Manager',
      managerPhone = '',
      managerEmail = '',
      campaignId,
      title,
      message,
      channels,
      targetType,
      targetId,
      fundId = '',
      fundName = '',
      recipientCount,
      recipients,
    } = params;

    const now = new Date().toISOString();
    const batchId = `cmp_batch_${campaignId}`;
    const dispatchId = this.generateDispatchId();

    const payload: CommunicationWebhookPayload = {
      event: 'campaign_launch',
      batchId,
      dispatchId,
      timestamp: now,
      tenant: { tenantId },
      fund: { fundId, fundName },
      manager: { managerId, managerName, phone: managerPhone, email: managerEmail },
      recipient: {
        memberId: '',
        memberName: '',
        phone: '',
        shareId: '',
      },
      communication: {
        channel: channels.join(', '),
        message,
        subject: title,
        mediaUrl: '',
        documentUrl: '',
      },
      statement: {
        available: false,
        shareId: '',
        memberName: '',
        fundName,
        managerName,
        currentStatus: '',
        pendingAmount: 0,
        advanceAmount: 0,
        currentCycle: null,
        totalCycles: null,
        statementGeneratedAt: now,
      },
      campaign: {
        campaignId,
        targetType,
        targetId,
        channels,
      },
      options: {
        sendStatement: false,
        sendReminder: false,
        generateDocument: false,
      },
      recipients: recipients || [],
    };

    const res = await this.dispatch(payload);
    const dispatchRecord = this.createDispatchRecord({
      dispatchId,
      batchId,
      tenantId,
      managerId,
      managerName,
      managerPhone,
      managerEmail,
      fundId,
      fundName,
      event: 'campaign_launch',
      channel: channels.join(', '),
      recipientCount,
      status: res.success ? 'received' : 'failed',
    });

    return {
      ...res,
      dispatchRecord,
    };
  }

  /**
   * Generates authentic, realistic sample JSON payloads for each event type (Section 53)
   * Suitable for direct pasting into n8n webhook test nodes.
   */
  static getSamplePayload(event: CommunicationEvent): CommunicationWebhookPayload {
    const now = '2026-10-03T08:30:00.000Z';

    switch (event) {
      case 'share_reminder':
        return {
          event: 'share_reminder',
          batchId: 'rem_batch_1791192800_x4a9k',
          dispatchId: 'DSP_1791192800_w8b2m',
          timestamp: now,
          tenant: { tenantId: 'tenant_cf_demo_8812' },
          fund: { fundId: 'fund_apex_wealth_01', fundName: 'Apex Wealth Scheme' },
          manager: { managerId: 'mgr_ravi_kumar', managerName: 'Ravi Kumar', phone: '+919876543210', email: 'ravi.kumar@apexwealth.internal' },
          recipient: {
            memberId: 'mem_mahesh_k',
            memberName: 'Mahesh Kumar',
            phone: '+919845010011',
            shareId: 'SH-0104',
          },
          communication: {
            channel: 'whatsapp',
            message: 'Hello Mahesh,\n\nShare ID: SH-0104\nMember: Mahesh Kumar\nChitti: Apex Wealth Scheme\nManager: Ravi Kumar\n\nCurrent Status: Pending ₹5,000\nCycle: 8 / 12\n\nThank you for your continued association with us.',
            subject: 'Chitti Reminder: Apex Wealth Scheme',
            mediaUrl: '',
            documentUrl: '',
          },
          statement: {
            available: true,
            shareId: 'SH-0104',
            memberName: 'Mahesh Kumar',
            fundName: 'Apex Wealth Scheme',
            managerName: 'Ravi Kumar',
            currentStatus: 'Pending',
            pendingAmount: 5000,
            advanceAmount: 0,
            currentCycle: 8,
            totalCycles: 12,
            statementGeneratedAt: now,
          },
          campaign: {
            campaignId: '',
            targetType: '',
            targetId: '',
            channels: ['whatsapp'],
          },
          options: {
            sendStatement: false,
            sendReminder: true,
            generateDocument: false,
          },
        };

      case 'bulk_reminder':
        return {
          event: 'bulk_reminder',
          batchId: 'bulk_rem_fund_apex_wealth_01_1791192800',
          dispatchId: 'DSP_1791192800_b9m4k',
          timestamp: now,
          tenant: { tenantId: 'tenant_cf_demo_8812' },
          fund: { fundId: 'fund_apex_wealth_01', fundName: 'Apex Wealth Scheme' },
          manager: { managerId: 'mgr_ravi_kumar', managerName: 'Ravi Kumar', phone: '+919876543210', email: 'ravi.kumar@apexwealth.internal' },
          recipient: {
            memberId: '',
            memberName: '',
            phone: '',
            shareId: '',
          },
          communication: {
            channel: 'whatsapp',
            message: 'Bulk Reminders for Apex Wealth Scheme (2 recipients)',
            subject: 'Chitti Reminder: Apex Wealth Scheme',
            mediaUrl: '',
            documentUrl: '',
          },
          statement: {
            available: false,
            shareId: '',
            memberName: '',
            fundName: 'Apex Wealth Scheme',
            managerName: 'Ravi Kumar',
            currentStatus: '',
            pendingAmount: 0,
            advanceAmount: 0,
            currentCycle: null,
            totalCycles: null,
            statementGeneratedAt: now,
          },
          campaign: {
            campaignId: '',
            targetType: 'PENDING_MEMBERS',
            targetId: 'fund_apex_wealth_01',
            channels: ['whatsapp'],
          },
          options: {
            sendStatement: false,
            sendReminder: true,
            generateDocument: false,
          },
          recipients: [
            {
              memberId: 'mem_mahesh_k',
              memberName: 'Mahesh Kumar',
              phone: '+919845010011',
              shareId: 'SH-0104',
              fundId: 'fund_apex_wealth_01',
              fundName: 'Apex Wealth Scheme',
              message: 'Dear Mahesh Kumar,\n\nThis is a friendly reminder from Ravi Kumar for "Apex Wealth Scheme" (Month #8).\n\nOutstanding Due: ₹5,000\nStatus: Share #4 (ACTIVE)\n\nPlease remit via UPI or bank wire at your earliest convenience to maintain your scheme allocation.\n\nThank you!',
            },
            {
              memberId: 'mem_priya_s',
              memberName: 'Priya Sharma',
              phone: '+919845020022',
              shareId: 'SH-0105',
              fundId: 'fund_apex_wealth_01',
              fundName: 'Apex Wealth Scheme',
              message: 'Dear Priya Sharma,\n\nThis is a friendly reminder from Ravi Kumar for "Apex Wealth Scheme" (Month #8).\n\nOutstanding Due: ₹5,000\nStatus: Share #5 (ACTIVE)\n\nPlease remit via UPI or bank wire at your earliest convenience to maintain your scheme allocation.\n\nThank you!',
            },
          ],
        };

      case 'share_statement':
        return {
          event: 'share_statement',
          batchId: 'stmt_batch_1791192800_k7n2z',
          dispatchId: 'DSP_1791192800_p4q9y',
          timestamp: now,
          tenant: { tenantId: 'tenant_cf_demo_8812' },
          fund: { fundId: 'fund_apex_wealth_01', fundName: 'Apex Wealth Scheme' },
          manager: { managerId: 'mgr_ravi_kumar', managerName: 'Ravi Kumar', phone: '+919876543210', email: 'ravi.kumar@apexwealth.internal' },
          recipient: {
            memberId: 'mem_mahesh_k',
            memberName: 'Mahesh Kumar',
            phone: '+919845010011',
            shareId: 'SH-0104',
          },
          communication: {
            channel: 'whatsapp',
            message: 'Hello Mahesh,\n\nShare ID: SH-0104\nMember: Mahesh Kumar\nChitti: Apex Wealth Scheme\nManager: Ravi Kumar\n\nCurrent Status: Pending ₹5,000\nCycle: 8 / 12\n\nThank you for your continued association with us.',
            subject: 'Account Statement: Apex Wealth Scheme',
            mediaUrl: '',
            documentUrl: '',
          },
          statement: {
            available: true,
            shareId: 'SH-0104',
            memberName: 'Mahesh Kumar',
            fundName: 'Apex Wealth Scheme',
            managerName: 'Ravi Kumar',
            currentStatus: 'Pending',
            pendingAmount: 5000,
            advanceAmount: 0,
            currentCycle: 8,
            totalCycles: 12,
            statementGeneratedAt: now,
          },
          campaign: {
            campaignId: '',
            targetType: '',
            targetId: '',
            channels: ['whatsapp'],
          },
          options: {
            sendStatement: true,
            sendReminder: false,
            generateDocument: false,
          },
        };

      case 'bulk_statement':
        return {
          event: 'bulk_statement',
          batchId: 'bulk_stmt_fund_apex_wealth_01_1791192800',
          dispatchId: 'DSP_1791192800_r1t5e',
          timestamp: now,
          tenant: { tenantId: 'tenant_cf_demo_8812' },
          fund: { fundId: 'fund_apex_wealth_01', fundName: 'Apex Wealth Scheme' },
          manager: { managerId: 'mgr_ravi_kumar', managerName: 'Ravi Kumar', phone: '+919876543210', email: 'ravi.kumar@apexwealth.internal' },
          recipient: {
            memberId: '',
            memberName: '',
            phone: '',
            shareId: '',
          },
          communication: {
            channel: 'whatsapp',
            message: 'Bulk Account Statements for Apex Wealth Scheme (2 recipients)',
            subject: 'Monthly Statements - Apex Wealth Scheme',
            mediaUrl: '',
            documentUrl: '',
          },
          statement: {
            available: false,
            shareId: '',
            memberName: '',
            fundName: 'Apex Wealth Scheme',
            managerName: 'Ravi Kumar',
            currentStatus: '',
            pendingAmount: 0,
            advanceAmount: 0,
            currentCycle: null,
            totalCycles: null,
            statementGeneratedAt: now,
          },
          campaign: {
            campaignId: '',
            targetType: '',
            targetId: '',
            channels: ['whatsapp'],
          },
          options: {
            sendStatement: true,
            sendReminder: false,
            generateDocument: false,
          },
          recipients: [
            {
              memberId: 'mem_mahesh_k',
              memberName: 'Mahesh Kumar',
              phone: '+919845010011',
              shareId: 'SH-0104',
              fundId: 'fund_apex_wealth_01',
              fundName: 'Apex Wealth Scheme',
              statement: {
                available: true,
                shareId: 'SH-0104',
                memberName: 'Mahesh Kumar',
                fundName: 'Apex Wealth Scheme',
                managerName: 'Ravi Kumar',
                currentStatus: 'Pending',
                pendingAmount: 5000,
                advanceAmount: 0,
                currentCycle: 8,
                totalCycles: 12,
                statementGeneratedAt: now,
              },
              message: 'Hello Mahesh,\n\nShare ID: SH-0104\nMember: Mahesh Kumar\nChitti: Apex Wealth Scheme\nManager: Ravi Kumar\n\nCurrent Status: Pending ₹5,000\nCycle: 8 / 12\n\nThank you for your continued association with us.',
            },
            {
              memberId: 'mem_priya_s',
              memberName: 'Priya Sharma',
              phone: '+919845020022',
              shareId: 'SH-0105',
              fundId: 'fund_apex_wealth_01',
              fundName: 'Apex Wealth Scheme',
              statement: {
                available: true,
                shareId: 'SH-0105',
                memberName: 'Priya Sharma',
                fundName: 'Apex Wealth Scheme',
                managerName: 'Ravi Kumar',
                currentStatus: 'Up to date',
                pendingAmount: 0,
                advanceAmount: 0,
                currentCycle: 8,
                totalCycles: 12,
                statementGeneratedAt: now,
              },
              message: 'Hello Priya Sharma,\n\nShare ID: SH-0105\nMember: Priya Sharma\nChitti: Apex Wealth Scheme\nManager: Ravi Kumar\n\nCurrent Status: Up to date\nCycle: 8 / 12\n\nThank you for your continued association with us.',
            },
          ],
        };

      case 'campaign_launch':
        return {
          event: 'campaign_launch',
          batchId: 'cmp_batch_cmp_festive_offer_2026',
          dispatchId: 'DSP_1791192800_h3j8u',
          timestamp: now,
          tenant: { tenantId: 'tenant_cf_demo_8812' },
          fund: { fundId: 'fund_apex_wealth_01', fundName: 'Apex Wealth Scheme' },
          manager: { managerId: 'mgr_ravi_kumar', managerName: 'Ravi Kumar', phone: '+919876543210', email: 'ravi.kumar@apexwealth.internal' },
          recipient: {
            memberId: '',
            memberName: '',
            phone: '',
            shareId: '',
          },
          communication: {
            channel: 'WHATSAPP, SMS',
            message: 'Exclusive New Gold Chit Series starting next week! Reserve your share early with zero processing fee.',
            subject: 'Festive Chit Launch 2026',
            mediaUrl: '',
            documentUrl: '',
          },
          statement: {
            available: false,
            shareId: '',
            memberName: '',
            fundName: 'Apex Wealth Scheme',
            managerName: 'Ravi Kumar',
            currentStatus: '',
            pendingAmount: 0,
            advanceAmount: 0,
            currentCycle: null,
            totalCycles: null,
            statementGeneratedAt: now,
          },
          campaign: {
            campaignId: 'cmp_festive_offer_2026',
            targetType: 'MEMBERS',
            targetId: 'ALL_EXISTING_MEMBERS',
            channels: ['WHATSAPP', 'SMS'],
          },
          options: {
            sendStatement: false,
            sendReminder: false,
            generateDocument: false,
          },
          recipients: [],
        };
    }
  }
}

