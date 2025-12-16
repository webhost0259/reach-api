// User types with new multi-tenant fields
export interface IUser {
  id: string;
  tenant_id: string;
  email: string;
  password_hash?: string; // Don't expose in responses
  phone?: string;
  account_type: 'individual' | 'organization';
  organization_name?: string;
  first_name?: string;
  last_name?: string;
  company_size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  industry?: string;
  country: string;
  signup_status: 'pending' | 'approved' | 'rejected';
  tier: 'free' | 'silver' | 'gold' | 'platinum';
  daily_sms_limit: number;
  approved_at?: Date;
  approved_by?: string;
  rejection_reason?: string;
  created_at: Date;
  updated_at: Date;
}

// Registration request (from frontend)
export interface RegisterRequest {
  email: string;
  password: string;
  phone?: string;
  account_type?: 'individual' | 'organization';
  organization_name?: string;
  first_name?: string;
  last_name?: string;
  company_size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
  industry?: string;
  country?: string;
}

// Login request
export interface LoginRequest {
  email: string;
  password: string;
}

// API key authentication request
export interface TokenRequest {
  client_id: string;
  client_secret: string;
}

// JWT payload
export interface JWTPayload {
  id: string;           // ✅ Changed from userId to id
  tenant_id: string;
  email: string;
  tier?: string;
  iat?: number;
  exp?: number;
}


// API Key with tenant
export interface IApiKey {
  id: string;
  user_id: string;
  tenant_id: string;
  client_id: string;
  client_secret_hash: string;
  client_secret_plain?: string; // Only available during creation
  environment: 'test' | 'prod';
  status: 'active' | 'inactive' | 'revoked';
  expires_at?: Date;
  created_at: Date;
}

// Customer types
export interface ICustomer {
  id: string;
  tenant_id: string;
  user_id: string;
  first_name: string;
  last_name?: string;
  mobile_number: string;
  email?: string;
  country_code: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  opt_in_status: 'opted_in' | 'opted_out' | 'pending';
  opted_in_at?: Date;
  opted_out_at?: Date;
  last_contacted_at?: Date;
  notes?: string;
  status: 'active' | 'blocked' | 'deleted';
  created_at: Date;
  updated_at: Date;
}

// Auth responses (to frontend)
export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      tenant_id: string;
      email: string;
      account_type: string;
      organization_name?: string;
      tier: string;
      signup_status: string;
    };
    api_credentials: {
      test: {
        client_id: string;
        client_secret: string;
      };
      production: {
        client_id: string;
        client_secret: string;
      };
    };
    token: string;
  };
}

export interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    expires_in: string;
    user: {
      id: string;
      tenant_id: string;
      email: string;
      account_type: string;
      organization_name?: string;
      tier: string;
      daily_sms_limit: number;
    };
  };
}
