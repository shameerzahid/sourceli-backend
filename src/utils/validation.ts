/**
 * Validate email format
 * @param email - Email address to validate
 * @returns True if email format is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(email.trim());
}

/**
 * Validate phone number format (basic validation)
 * Accepts: digits, spaces, dashes, plus sign, parentheses
 * @param phone - Phone number to validate
 * @returns True if phone format is valid
 */
export function isValidPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Basic phone validation: allows digits, spaces, dashes, plus, parentheses
  // Minimum 10 digits, maximum 15 digits (international format)
  const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;

  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  const digitCount = cleaned.replace(/\+/g, '').length;

  return phoneRegex.test(phone) && digitCount >= 10 && digitCount <= 15;
}

/**
 * Normalize phone number by removing spaces, dashes, and other formatting
 * @param phone - Phone number to normalize
 * @returns Normalized phone number
 */
export function normalizePhone(phone: string): string {
  if (!phone || typeof phone !== 'string') {
    return '';
  }

  // Remove spaces, dashes, dots, parentheses (keep plus sign)
  return phone.replace(/[\s\-\(\)\.]/g, '');
}

/**
 * Convert phone to E.164 for Twilio/SMS (e.g. +923001234567).
 * - If already starts with +: normalize digits and ensure single + prefix.
 * - If starts with 0 (e.g. 03XXXXXXXXX): treat as Pakistan, replace leading 0 with defaultCountryCode.
 * - Otherwise: prepend + and defaultCountryCode.
 * @param phone - Raw phone input
 * @param defaultCountryCode - Country code without + (e.g. '92' for Pakistan)
 */
export function toE164(phone: string, defaultCountryCode = '92'): string {
  if (!phone || typeof phone !== 'string') return '';
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10) return '';

  if (phone.trim().startsWith('+')) {
    return '+' + digitsOnly;
  }
  // Already has country code (e.g. 233..., 92... from frontend)
  if (digitsOnly.length >= 11 && digitsOnly.length <= 15 && !digitsOnly.startsWith('0')) {
    return '+' + digitsOnly;
  }
  if (digitsOnly.startsWith('0') && digitsOnly.length >= 10) {
    return '+' + defaultCountryCode + digitsOnly.slice(1);
  }
  if (digitsOnly.startsWith(defaultCountryCode)) {
    return '+' + digitsOnly;
  }
  return '+' + defaultCountryCode + digitsOnly;
}

/**
 * Basic input sanitization to prevent XSS
 * Removes potentially dangerous characters
 * @param input - Input string to sanitize
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags and encode special characters
  return input
    .trim()
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove remaining angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Object with isValid boolean and error message
 */
export function validatePassword(password: string): {
  isValid: boolean;
  error?: string;
} {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      error: 'Password must be at least 8 characters long',
    };
  }

  if (password.length > 128) {
    return {
      isValid: false,
      error: 'Password must be less than 128 characters',
    };
  }

  return { isValid: true };
}








