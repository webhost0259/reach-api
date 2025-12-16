import { CreateCustomerRequest } from '../types/customer.types';

export class CSVParser {
  /**
   * Parse CSV string to customer objects
   * 
   * Expected CSV format:
   * first_name,last_name,mobile_number,email,country_code,tags,opt_in_status
   * John,Doe,+918870692077,john@example.com,+91,"vip,premium",opted_in
   */
  static parseCustomersCSV(csvContent: string): CreateCustomerRequest[] {
    const lines = csvContent.trim().split('\n');
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header row and one data row');
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const customers: CreateCustomerRequest[] = [];

    // Validate required headers
    const requiredHeaders = ['first_name', 'mobile_number'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    
    if (missingHeaders.length > 0) {
      throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = this.parseCSVLine(line);
      const customer: any = {};

      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        
        if (!value) return;

        switch (header) {
          case 'first_name':
          case 'last_name':
          case 'mobile_number':
          case 'email':
          case 'country_code':
          case 'notes':
            customer[header] = value;
            break;

          case 'tags':
            customer.tags = value.split(',').map(t => t.trim()).filter(t => t);
            break;

          case 'opt_in_status':
            if (['opted_in', 'opted_out', 'pending'].includes(value)) {
              customer.opt_in_status = value;
            }
            break;

          case 'custom_fields':
            try {
              customer.custom_fields = JSON.parse(value);
            } catch (e) {
              // Skip invalid JSON
            }
            break;
        }
      });

      if (customer.first_name && customer.mobile_number) {
        customers.push(customer);
      }
    }

    return customers;
  }

  /**
   * Parse a single CSV line handling quoted values
   */
  private static parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current);
    return values;
  }

  /**
   * Generate CSV template
   */
  static generateTemplate(): string {
    const headers = [
      'first_name',
      'last_name',
      'mobile_number',
      'email',
      'country_code',
      'tags',
      'opt_in_status',
      'notes',
    ];

    const example = [
      'John',
      'Doe',
      '+918870692077',
      'john@example.com',
      '+91',
      'vip,premium',
      'opted_in',
      'VIP customer',
    ];

    return `${headers.join(',')}\n${example.join(',')}`;
  }

  /**
   * Export customers to CSV
   */
  static exportCustomersToCSV(customers: any[]): string {
    const headers = [
      'first_name',
      'last_name',
      'mobile_number',
      'email',
      'country_code',
      'tags',
      'opt_in_status',
      'status',
      'created_at',
    ];

    const rows = customers.map((customer) => {
      return [
        customer.first_name || '',
        customer.last_name || '',
        customer.mobile_number || '',
        customer.email || '',
        customer.country_code || '',
        Array.isArray(customer.tags) ? customer.tags.join(';') : '',
        customer.opt_in_status || '',
        customer.status || '',
        customer.created_at || '',
      ].map(value => `"${value}"`).join(',');
    });

    return `${headers.join(',')}\n${rows.join('\n')}`;
  }
}

export default CSVParser;
