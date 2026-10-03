// Standard Variable Contract for ClearFlow centralized n8n Communication Webhook
export type CommunicationEvent =
  | 'share_reminder'
  | 'bulk_reminder'
  | 'share_statement'
  | 'bulk_statement'
  | 'campaign_launch';

export interface WebhookTenant {
  tenantId: string;
}

export interface WebhookFund {
  fundId: string;
  fundName: string;
}

export interface WebhookManager {
  managerId: string;
  managerName: string;
  phone: string;
  email?: string;
}

export type DispatchStatus = 'queued' | 'received' | 'processing' | 'completed' | 'failed';

/**
 * Validates legal forward progression of dispatch state.
 * Terminal states ('completed', 'failed') cannot transition backward.
 */
export function isValidStatusTransition(currentStatus: DispatchStatus, newStatus: DispatchStatus): boolean {
  if (currentStatus === newStatus) return true;
  if (currentStatus === 'completed' || currentStatus === 'failed') {
    return false;
  }
  if (currentStatus === 'queued') {
    return newStatus === 'received' || newStatus === 'processing' || newStatus === 'failed';
  }
  if (currentStatus === 'received') {
    return newStatus === 'processing' || newStatus === 'completed' || newStatus === 'failed';
  }
  if (currentStatus === 'processing') {
    return newStatus === 'completed' || newStatus === 'failed';
  }
  return false;
}

export interface CommunicationDispatch {
  dispatchId: string;
  batchId: string;
  tenantId: string;
  managerId: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  fundId: string;
  fundName: string;
  event: CommunicationEvent;
  channel: string;
  recipientCount: number;
  status: DispatchStatus;
  total?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string | null;
  updatedAt: string;
}

export interface DispatchCallbackPayload {
  dispatchId: string;
  tenantId: string;
  status: DispatchStatus;
  total?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  errorMessage?: string;
  completedAt?: string;
}

export interface WebhookRecipient {
  memberId: string;
  memberName: string;
  phone: string;
  shareId: string;
}

export interface WebhookCommunication {
  channel: string;
  message: string;
  subject: string;
  mediaUrl: string;
  documentUrl: string;
}

export interface WebhookStatement {
  available: boolean;
  shareId: string;
  memberName: string;
  fundName: string;
  managerName: string;
  currentStatus: string;
  pendingAmount: number;
  advanceAmount: number;
  currentCycle: number | null;
  totalCycles: number | null;
  statementGeneratedAt: string;
}

export interface WebhookCampaign {
  campaignId: string;
  targetType: string;
  targetId: string;
  channels: string[];
}

export interface WebhookOptions {
  sendStatement: boolean;
  sendReminder: boolean;
  generateDocument: boolean;
}

export interface WebhookBulkRecipient {
  memberId: string;
  memberName: string;
  phone: string;
  shareId: string;
  fundId: string;
  fundName: string;
  message: string;
  statement?: WebhookStatement | Record<string, never>;
}

/**
 * Authoritative top-level schema sent to n8n webhook
 * Predictable structure guaranteed across all 5 events:
 * - share_reminder
 * - bulk_reminder
 * - share_statement
 * - bulk_statement
 * - campaign_launch
 */
export interface CommunicationWebhookPayload {
  event: CommunicationEvent;
  batchId: string;
  dispatchId: string;
  timestamp: string;

  tenant: WebhookTenant;
  fund: WebhookFund;
  manager: WebhookManager;
  recipient: WebhookRecipient;
  communication: WebhookCommunication;
  statement: WebhookStatement;
  campaign: WebhookCampaign;
  options: WebhookOptions;
  recipients?: WebhookBulkRecipient[];
}

export interface DispatchResult {
  success: boolean;
  event: CommunicationEvent;
  dispatchId: string;
  batchId: string;
  status?: number;
  message?: string;
  error?: string;
  simulated?: boolean;
  endpointUrl: string;
  payload: CommunicationWebhookPayload;
}
