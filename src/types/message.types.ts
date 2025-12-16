// Message types
export interface IMessage {
  id: string;
  user_id: string;
  tenant_id?: string;
  api_key_id: string;
  phone_number: string;
  content: string;
  template_code?: string;
  external_message_id?: string;
  status: 'queued' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed' | 'scheduled';
  error_code?: string;
  error_message?: string;
  attempts: number;
  scheduled_at?: Date;
  created_at: Date;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  failed_at?: Date;
  updated_at: Date;
}

// Send message request
export interface SendMessageRequest {
  phone_number: string;
  content: string;
  template_code?: string;
}

// Bulk message request
export interface BulkMessageRequest {
  messages: SendMessageRequest[];
}

export interface QueueJobData {
  // Regular message fields
  messageId?: string;
  userId?: string;
  apiKeyId?: string;
  phoneNumber?: string;
  content?: string;
  templateCode?: string;
  
  // Campaign fields
  type?: 'message' | 'campaign' | 'campaign-recipient';
  campaign_id?: string;
  tenant_id?: string;
  recipient_id?: string;
  customer_id?: string;
  variables?: Record<string, any>;
  body_text?: string;
  phone_number_id?: string;
  access_token?: string;
  max_retries?: number;
}

export interface CampaignJobData {
  campaign_id: string;
  tenant_id: string;
  type: 'campaign';
}

// Message response
export interface SendMessageResponse {
  messageId: string;
  status: string;
  queuePosition: number;
}

// Bulk message response
export interface BulkMessageResponse {
  total: number;
  queued: number;
  failed: number;
  messageIds: string[];
  failedMessages: Array<{
    phone_number: string;
    error: string;
  }>;
}

// Schedule message request
export interface ScheduleMessageRequest {
  phone_number: string;
  content: string;
  scheduled_at: string; // ISO 8601 date string
  template_code?: string;
}

// Schedule message response
export interface ScheduleMessageResponse {
  messageId: string;
  status: string;
  scheduledAt: Date;
}


