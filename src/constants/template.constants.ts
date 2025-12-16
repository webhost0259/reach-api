// Template Categories
export const TEMPLATE_CATEGORIES = [
  'marketing',
  'utility',
  'authentication',
  'appointment_update',
  'transportation_update',
  'issue_resolution',
  'ticket_update',
  'alert_update',
  'auto_reply',
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

// Template Statuses
export const TEMPLATE_STATUSES = [
  'draft',
  'pending',
  'approved',
  'rejected',
  'paused',
  'disabled',
] as const;

export type TemplateStatus = typeof TEMPLATE_STATUSES[number];

// Header Types
export const HEADER_TYPES = [
  'none',
  'text',
  'image',
  'video',
  'document',
] as const;

export type HeaderType = typeof HEADER_TYPES[number];

// Button Types
export const BUTTON_TYPES = [
  'QUICK_REPLY',
  'URL',
  'PHONE_NUMBER',
] as const;

export type ButtonType = typeof BUTTON_TYPES[number];

// Language Codes (commonly used)
export const LANGUAGE_CODES = [
  { code: 'en_US', name: 'English (US)' },
  { code: 'en_GB', name: 'English (UK)' },
  { code: 'es_ES', name: 'Spanish (Spain)' },
  { code: 'es_MX', name: 'Spanish (Mexico)' },
  { code: 'pt_BR', name: 'Portuguese (Brazil)' },
  { code: 'pt_PT', name: 'Portuguese (Portugal)' },
  { code: 'fr_FR', name: 'French' },
  { code: 'de_DE', name: 'German' },
  { code: 'it_IT', name: 'Italian' },
  { code: 'ar_AR', name: 'Arabic' },
  { code: 'hi_IN', name: 'Hindi' },
  { code: 'id_ID', name: 'Indonesian' },
  { code: 'ja_JP', name: 'Japanese' },
  { code: 'ko_KR', name: 'Korean' },
  { code: 'ru_RU', name: 'Russian' },
  { code: 'zh_CN', name: 'Chinese (Simplified)' },
  { code: 'zh_TW', name: 'Chinese (Traditional)' },
] as const;

// Template Limits
export const TEMPLATE_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_TEMPLATE_CODE_LENGTH: 100,
  MAX_HEADER_TEXT_LENGTH: 60,
  MAX_BODY_TEXT_LENGTH: 1024,
  MAX_FOOTER_TEXT_LENGTH: 60,
  MAX_BUTTON_TEXT_LENGTH: 25,
  MAX_BUTTONS: 3,
  MAX_QUICK_REPLY_BUTTONS: 3,
  MAX_CALL_TO_ACTION_BUTTONS: 2,
  MAX_VARIABLES: 10,
} as const;

// Validation Messages
export const VALIDATION_MESSAGES = {
  TEMPLATE_CODE_EXISTS: 'Template code already exists',
  INVALID_PLACEHOLDER_COUNT: 'Placeholder count mismatch with example values',
  INVALID_TEMPLATE_CODE_FORMAT: 'Template code must be lowercase with underscores only',
  HEADER_TEXT_TOO_LONG: `Header text cannot exceed ${TEMPLATE_LIMITS.MAX_HEADER_TEXT_LENGTH} characters`,
  BODY_TEXT_TOO_LONG: `Body text cannot exceed ${TEMPLATE_LIMITS.MAX_BODY_TEXT_LENGTH} characters`,
  FOOTER_TEXT_TOO_LONG: `Footer text cannot exceed ${TEMPLATE_LIMITS.MAX_FOOTER_TEXT_LENGTH} characters`,
  TOO_MANY_BUTTONS: `Maximum ${TEMPLATE_LIMITS.MAX_BUTTONS} buttons allowed`,
  ONLY_DRAFTS_CAN_BE_EDITED: 'Only draft templates can be edited',
  ONLY_DRAFTS_CAN_BE_SUBMITTED: 'Only draft templates can be submitted',
  TEMPLATE_NOT_SUBMITTED: 'Template has not been submitted to Meta',
} as const;

// Meta API Configuration
export const META_CONFIG = {
  BASE_URL: 'https://graph.facebook.com/v21.0',
  TIMEOUT: 30000, // 30 seconds
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;
