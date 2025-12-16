import logger from './logger';

/**
 * Formats and validates phone numbers for WhatsApp
 * Ensures all numbers are in E.164 format (+[country code][number])
 */

interface PhoneValidationResult {
  isValid: boolean;
  formatted: string;
  original: string;
  error?: string;
}

export class PhoneNumberValidator {
  // Default country code (India)
  private static DEFAULT_COUNTRY_CODE = '91';

  /**
   * Validate and format a phone number
   * Accepts formats:
   * - +918870692077
   * - 918870692077
   * - 8870692077 (assumes +91)
   * - +91 8870692077
   * - +44 7424777800
   */
  static validate(phoneNumber: string, countryCode?: string): PhoneValidationResult {
    const original = phoneNumber;

    try {
      // Remove all whitespace, dashes, and parentheses
      let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

      // Remove leading zeros
      cleaned = cleaned.replace(/^0+/, '');

      // Handle different formats
      if (cleaned.startsWith('+')) {
        // Already has +, just validate
        cleaned = cleaned.substring(1);
      }

      // If no country code provided, check if number starts with a country code
      if (!countryCode) {
        // Check for common country codes (91, 44, 1, etc.)
        if (cleaned.startsWith('91') && cleaned.length === 12) {
          // Indian number with 91 prefix
          countryCode = '91';
          cleaned = cleaned.substring(2);
        } else if (cleaned.startsWith('44') && cleaned.length === 12) {
          // UK number with 44 prefix
          countryCode = '44';
          cleaned = cleaned.substring(2);
        } else if (cleaned.startsWith('1') && cleaned.length === 11) {
          // US/Canada number with 1 prefix
          countryCode = '1';
          cleaned = cleaned.substring(1);
        } else if (cleaned.length === 10) {
          // Assume default country code for 10-digit numbers
          countryCode = this.DEFAULT_COUNTRY_CODE;
        } else {
          // Try to extract country code (1-3 digits)
          const match = cleaned.match(/^(\d{1,3})(\d{10})$/);
          if (match) {
            countryCode = match[1];
            cleaned = match[2];
          } else {
            return {
              isValid: false,
              formatted: '',
              original,
              error: 'Invalid phone number format',
            };
          }
        }
      } else {
        // Country code provided, remove it from number if present
        const ccRegex = new RegExp(`^${countryCode}`);
        if (ccRegex.test(cleaned)) {
          cleaned = cleaned.replace(ccRegex, '');
        }
      }

      // Remove leading/trailing + from country code
      countryCode = countryCode.replace(/^\+/, '');

      // Validate number length (typically 7-15 digits for international numbers)
      if (cleaned.length < 7 || cleaned.length > 15) {
        return {
          isValid: false,
          formatted: '',
          original,
          error: `Invalid phone number length: ${cleaned.length} digits`,
        };
      }

      // Validate only contains digits
      if (!/^\d+$/.test(cleaned)) {
        return {
          isValid: false,
          formatted: '',
          original,
          error: 'Phone number must contain only digits',
        };
      }

      // Validate country code
      if (!/^\d{1,3}$/.test(countryCode)) {
        return {
          isValid: false,
          formatted: '',
          original,
          error: 'Invalid country code format',
        };
      }

      // Format in E.164 format
      const formatted = `+${countryCode}${cleaned}`;

      // Additional validation for specific country codes
      const validationError = this.validateCountrySpecific(countryCode, cleaned);
      if (validationError) {
        return {
          isValid: false,
          formatted: '',
          original,
          error: validationError,
        };
      }

      return {
        isValid: true,
        formatted,
        original,
      };
    } catch (error) {
      logger.error('Phone number validation error', { error, phoneNumber });
      return {
        isValid: false,
        formatted: '',
        original,
        error: 'Validation error occurred',
      };
    }
  }

  /**
   * Country-specific validation rules
   */
  private static validateCountrySpecific(countryCode: string, number: string): string | null {
    switch (countryCode) {
      case '91': // India
        if (number.length !== 10) {
          return `Indian mobile numbers must be 10 digits, got ${number.length}`;
        }
        // Indian mobile numbers start with 6-9
        if (!/^[6-9]/.test(number)) {
          return 'Indian mobile numbers must start with 6, 7, 8, or 9';
        }
        break;

      case '44': // UK
        if (number.length < 9 || number.length > 10) {
          return `UK numbers must be 9-10 digits, got ${number.length}`;
        }
        break;

      case '1': // US/Canada
        if (number.length !== 10) {
          return `US/Canada numbers must be 10 digits, got ${number.length}`;
        }
        break;

      case '86': // China
        if (number.length !== 11) {
          return `Chinese mobile numbers must be 11 digits, got ${number.length}`;
        }
        break;

      // Add more country-specific rules as needed
    }

    return null;
  }

  /**
   * Batch validate and format multiple phone numbers
   */
  static validateBatch(
    phoneNumbers: Array<{ phone_number: string; country_code?: string }>
  ): Array<PhoneValidationResult> {
    return phoneNumbers.map((item) => this.validate(item.phone_number, item.country_code));
  }

  /**
   * Extract country code from phone number
   */
  static extractCountryCode(phoneNumber: string): string | null {
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    if (cleaned.startsWith('+')) {
      const match = cleaned.match(/^\+(\d{1,3})/);
      return match ? match[1] : null;
    }
    
    if (cleaned.startsWith('91') && cleaned.length === 12) return '91';
    if (cleaned.startsWith('44') && cleaned.length === 12) return '44';
    if (cleaned.startsWith('1') && cleaned.length === 11) return '1';
    
    return null;
  }

  /**
   * Format phone number for display (with country code separated)
   */
  static formatForDisplay(phoneNumber: string): string {
    const validation = this.validate(phoneNumber);
    if (!validation.isValid) return phoneNumber;

    const formatted = validation.formatted;
    const match = formatted.match(/^\+(\d{1,3})(\d+)$/);
    
    if (match) {
      return `+${match[1]} ${match[2]}`;
    }
    
    return formatted;
  }
}

export default PhoneNumberValidator;
