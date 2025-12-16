export interface ICustomer {
  id: string;
  tenant_id: string;
  user_id?: string;
  first_name: string;
  last_name?: string;
  mobile_number: string;
  email?: string;
  country_code: string;
  tags?: string; // JSON array
  custom_fields?: string; // JSON object
  opt_in_status: 'opted_in' | 'opted_out' | 'pending';
  opted_in_at?: Date;
  opted_out_at?: Date;
  last_contacted_at?: Date;
  notes?: string;
  status: 'active' | 'blocked' | 'deleted';
  created_at: Date;
  updated_at: Date;
}

export interface ICustomerGroup {
  id: string;
  tenant_id: string;
  user_id?: string;
  name: string;
  description?: string;
  criteria?: string; // JSON for dynamic groups
  is_dynamic: boolean;
  customer_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateCustomerRequest {
  first_name: string;
  last_name?: string;
  mobile_number: string;
  email?: string;
  country_code?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  notes?: string;
  opt_in_status?: 'opted_in' | 'opted_out' | 'pending';
}

export interface UpdateCustomerRequest {
  first_name?: string;
  last_name?: string;
  mobile_number?: string;
  email?: string;
  country_code?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  notes?: string;
  opt_in_status?: 'opted_in' | 'opted_out' | 'pending';
  status?: 'active' | 'blocked' | 'deleted';
}

export interface CustomerFilters {
  search?: string;
  tags?: string[];
  opt_in_status?: string;
  status?: string;
  country_code?: string;
  created_from?: string;
  created_to?: string;
  page?: number;
  limit?: number;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  is_dynamic: boolean;
  criteria?: GroupCriteria;
  customer_ids?: string[]; // For static groups
}

export interface GroupCriteria {
  tags?: string[];
  opt_in_status?: string;
  status?: string;
  country_code?: string;
  custom_field_filters?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'starts_with';
    value: string;
  }>;
}
