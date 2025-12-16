// Message Template
export interface MessageTemplate {
  id: string;
  user_id: string;
  tenant_id?: string;
  name: string;
  template_code: string;
  language: string;
  category: 
    | 'marketing'
    | 'utility'
    | 'authentication'
    | 'appointment_update'
    | 'transportation_update'
    | 'issue_resolution'
    | 'ticket_update'
    | 'alert_update'
    | 'auto_reply';
  status: 
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'paused'
    | 'disabled';
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: TemplateButton[];
  example_values?: string[];
  rejection_reason?: string;
  meta_template_id?: string;
  created_at: Date;
  submitted_at?: Date;
  approved_at?: Date;
  last_synced_at?: Date;
  updated_at: Date;
}

// Template Button Types
export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

// Create template request
export interface CreateTemplateRequest {
  name: string;
  template_code: string;
  language?: string;
  category?: 
    | 'marketing'
    | 'utility'
    | 'authentication'
    | 'appointment_update'
    | 'transportation_update'
    | 'issue_resolution'
    | 'ticket_update'
    | 'alert_update'
    | 'auto_reply';
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: TemplateButton[];
  example_values?: string[];
  submit_to_meta?: boolean; // New field for immediate submission
}

// Update template request
export interface UpdateTemplateRequest {
  // Fields that can always be updated
  name?: string;
  
  // Fields that can only be updated for draft templates
  template_code?: string;
  language?: string;
  category?: 
    | 'marketing'
    | 'utility'
    | 'authentication'
    | 'appointment_update'
    | 'transportation_update'
    | 'issue_resolution'
    | 'ticket_update'
    | 'alert_update'
    | 'auto_reply';
  header_type?: 'none' | 'text' | 'image' | 'video' | 'document';
  header_content?: string;
  body_text?: string;
  footer_text?: string;
  buttons?: TemplateButton[];
  example_values?: string[];
  
  // System/admin fields (for Meta sync)
  status?: 
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'paused'
    | 'disabled';
  rejection_reason?: string;
  meta_template_id?: string;
}

// Template stats response
export interface TemplateStatsResponse {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  paused?: number;
  disabled?: number;
  byCategory: Record<string, number>;
}

// Template list response
export interface TemplateListResponse {
  templates: MessageTemplate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Template filter options
export interface TemplateFilterOptions {
  status?: 
    | 'draft'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'paused'
    | 'disabled';
  category?: 
    | 'marketing'
    | 'utility'
    | 'authentication'
    | 'appointment_update'
    | 'transportation_update'
    | 'issue_resolution'
    | 'ticket_update'
    | 'alert_update'
    | 'auto_reply';
  page?: number;
  limit?: number;
}

// Meta template submission response
export interface MetaTemplateResponse {
  id: string;
  status: string;
  message?: string;
}

// Template sync result
export interface TemplateSyncResult {
  template_id: string;
  previous_status: string;
  new_status: string;
  synced_at: Date;
  rejection_reason?: string;
}

// Batch sync response
export interface BatchSyncResponse {
  synced_count: number;
  error_count: number;
  synced_ids: string[];
  failed_ids?: string[];
  results: TemplateSyncResult[];
}

// Template validation error
export interface TemplateValidationError {
  field: string;
  message: string;
  code: string;
}

// Category display names mapping
export const TEMPLATE_CATEGORY_LABELS: Record<string, string> = {
  marketing: 'Marketing',
  utility: 'Utility',
  authentication: 'Authentication',
  appointment_update: 'Appointment Update',
  transportation_update: 'Transportation Update',
  issue_resolution: 'Issue Resolution',
  ticket_update: 'Ticket Update',
  alert_update: 'Alert Update',
  auto_reply: 'Auto Reply',
};

// Status display names mapping
export const TEMPLATE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending Approval',
  approved: 'Approved',
  rejected: 'Rejected',
  paused: 'Paused by Meta',
  disabled: 'Disabled by Meta',
};

// Status color mapping for UI
export const TEMPLATE_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
  },
  pending: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  approved: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  rejected: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
  paused: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  disabled: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-300',
  },
};

// Helper type guards
export const isApprovedTemplate = (template: MessageTemplate): boolean => {
  return template.status === 'approved';
};

export const isDraftTemplate = (template: MessageTemplate): boolean => {
  return template.status === 'draft';
};

export const isPendingTemplate = (template: MessageTemplate): boolean => {
  return template.status === 'pending';
};

export const canEditTemplate = (template: MessageTemplate): boolean => {
  return template.status === 'draft';
};

export const canSubmitTemplate = (template: MessageTemplate): boolean => {
  return template.status === 'draft' && !template.meta_template_id;
};

export const canSyncTemplate = (template: MessageTemplate): boolean => {
  return !!template.meta_template_id && 
         (template.status === 'pending' || template.status === 'approved');
};

export const canDeleteTemplate = (template: MessageTemplate): boolean => {
  return true; // All templates can be deleted
};
