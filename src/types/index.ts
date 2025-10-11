export interface IUser {
  id: string;
  email: string;
  password_hash: string;
  phone?: string;
  signup_status: 'pending' | 'approved' | 'rejected';
  tier: 'free' | 'silver' | 'gold' | 'platinum';
  daily_sms_limit: number;
  created_at: Date;
  updated_at: Date;
}

export interface IApiKey {
  id: string;
  user_id: string;
  client_id: string;
  client_secret_hash: string;
  environment: 'test' | 'prod';
  status: 'active' | 'inactive' | 'revoked';
  expires_at?: Date;
  created_at: Date;
}

export interface IMessage {
  id: string;
  user_id: string;
  api_key_id: string;
  phone_number: string;
  content: string;
  status: 'queued' | 'processing' | 'sent' | 'delivered' | 'failed';
  error_message?: string;
  attempts: number;
  created_at: Date;
  updated_at: Date;
}

export interface ITemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  approved: boolean;
  created_at: Date;
}

export interface IAuditLog {
  id: string;
  user_id?: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: Date;
}

export interface JwtPayload {
  userId: string;
  email: string;
  tier: string;
  iat?: number;
  exp?: number;
}

export interface SendMessageRequest {
  phone_number: string;
  content: string;
  template_id?: string;
}

export interface BulkMessageRequest {
  messages: SendMessageRequest[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface QueueJobData {
  messageId: string;
  userId: string;
  apiKeyId: string;
  phoneNumber: string;
  content: string;
}

// Add these to existing types file

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  template_code: string;
  language: string;
  category: 'marketing' | 'utility' | 'authentication';
  status: 'pending' | 'approved' | 'rejected';
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: TemplateButton[];
  example_values?: string[];
  rejection_reason?: string;
  meta_template_id?: string;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateButton {
  type: 'quick_reply' | 'url' | 'phone_number';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface CreateTemplateRequest {
  name: string;
  template_code: string;
  language?: string;
  category?: 'marketing' | 'utility' | 'authentication';
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: TemplateButton[];
  example_values?: string[];
}

export interface UpdateTemplateRequest {
  name?: string;
  status?: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  meta_template_id?: string;
}

export interface SendTemplateMessageRequest {
  phone_number: string;
  template_code: string;
  language?: string;
  parameters?: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time';
  text?: string;
}

