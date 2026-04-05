import { z } from 'zod';
import { isValidEmail, isValidPhone, validatePassword } from '../utils/validation.js';
import { GHANA_CARD_FIELD_KEYS } from '../utils/ghanaCardFields.js';

// Buyer type enum
const BuyerTypeEnum = z.enum(['RESTAURANT', 'HOTEL', 'CATERER', 'INDIVIDUAL']);

const ghanaTrimmedRequired = (fieldLabel: string, maxLen: number) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, `${fieldLabel} is required`).max(maxLen, `${fieldLabel} is too long`));

const ghanaCardRegistrationFields = {
  ghanaCardId: ghanaTrimmedRequired('Ghana Card ID', 200),
  ghanaCardPersonalNumber: ghanaTrimmedRequired('Ghana Card personal ID number (PIN)', 200),
  ghanaCardDocumentNumber: ghanaTrimmedRequired('Ghana Card document number', 200),
  ghanaCardPlaceOfIssuance: ghanaTrimmedRequired('Ghana Card place of issuance', 200),
  ghanaCardDateOfIssuance: ghanaTrimmedRequired('Ghana Card date of issuance', 100),
  ghanaCardDateOfExpiry: ghanaTrimmedRequired('Ghana Card date of expiry', 100),
};

const ghanaCardProfileFields = {
  ghanaCardId: z.string().max(200).optional().nullable(),
  ghanaCardPersonalNumber: z.string().max(200).optional().nullable(),
  ghanaCardDocumentNumber: z.string().max(200).optional().nullable(),
  ghanaCardPlaceOfIssuance: z.string().max(200).optional().nullable(),
  ghanaCardDateOfIssuance: z.string().max(100).optional().nullable(),
  ghanaCardDateOfExpiry: z.string().max(100).optional().nullable(),
};

/**
 * Farmer registration validation schema
 */
export const farmerRegistrationSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Invalid email format')
      .refine((val) => isValidEmail(val), {
        message: 'Invalid email format',
      }),
    phone: z
      .string()
      .min(1, 'Phone number is required')
      .refine((val) => isValidPhone(val), {
        message: 'Invalid phone number format',
      }),
    password: z
      .string()
      .min(1, 'Password is required')
      .refine((val) => {
        const result = validatePassword(val);
        return result.isValid;
      }, (val) => {
        const result = validatePassword(val);
        return { message: result.error || 'Invalid password' };
      }),
    fullName: z.string().min(1, 'Full name is required').max(100, 'Full name is too long'),
    farmName: z.string().max(100, 'Farm name is too long').optional(),
    region: z.string().min(1, 'Region is required').max(100, 'Region name is too long'),
    town: z.string().min(1, 'Town is required').max(100, 'Town name is too long'),
    weeklyCapacityMin: z
      .number()
      .int('Capacity must be a whole number')
      .min(1, 'Minimum capacity must be at least 1')
      .max(100000, 'Minimum capacity is too large'),
    weeklyCapacityMax: z
      .number()
      .int('Capacity must be a whole number')
      .min(1, 'Maximum capacity must be at least 1')
      .max(100000, 'Maximum capacity is too large'),
    produceCategory: z
      .string()
      .min(1, 'Produce category is required')
      .max(50, 'Produce category is too long'),
    feedingMethod: z
      .string()
      .min(1, 'Feeding method is required')
      .max(50, 'Feeding method is too long'),
    termsAccepted: z
      .boolean()
      .refine((val) => val === true, {
        message: 'You must agree to platform rules, performance-based access, and no price negotiation policy',
      }),
    // When submitting as JSON (upload-on-add flow), photos are pre-uploaded URLs
    photoUrls: z.array(z.string().url()).min(1).max(10).optional(),
    // Certificates: optional, 0–10 URLs
    certificateUrls: z.array(z.string().url()).max(10).optional(),
    avatarUrl: z.string().url().optional(),
    ...ghanaCardRegistrationFields,
  })
  .refine((data) => data.weeklyCapacityMax >= data.weeklyCapacityMin, {
    message: 'Maximum capacity must be greater than or equal to minimum capacity',
    path: ['weeklyCapacityMax'],
  });

/**
 * Buyer registration validation schema
 */
export const buyerRegistrationSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .refine((val) => isValidEmail(val), {
      message: 'Invalid email format',
    }),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .refine((val) => isValidPhone(val), {
      message: 'Invalid phone number format',
    }),
  password: z
    .string()
    .min(1, 'Password is required')
    .refine((val) => {
      const result = validatePassword(val);
      return result.isValid;
    }, (val) => {
      const result = validatePassword(val);
      return { message: result.error || 'Invalid password' };
    }),
  fullName: z.string().min(1, 'Full name is required').max(100, 'Full name is too long'),
  businessName: z.string().max(100, 'Business name is too long').optional(),
  buyerType: BuyerTypeEnum,
  contactPerson: z
    .string()
    .min(1, 'Contact person is required')
    .max(100, 'Contact person name is too long'),
  estimatedVolume: z
    .number()
    .int('Estimated volume must be a whole number')
    .min(1, 'Estimated volume must be at least 1')
    .max(100000, 'Estimated volume is too large')
    .optional(),
  orderFrequency: z
    .enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'AS_NEEDED'])
    .optional(),
  companyRegistrationUrls: z
    .array(z.string().url())
    .min(1, 'At least one company registration document is required')
    .max(10, 'Maximum 10 company registration documents allowed'),
  supportingDocUrls: z
    .array(z.string().url())
    .max(10, 'Maximum 10 supporting documents allowed')
    .optional(),
  deliveryAddresses: z
    .array(
      z.object({
        address: z.string().min(1, 'Address is required').max(500, 'Address is too long'),
        landmark: z.string().max(200, 'Landmark is too long').optional(),
        region: z.string().max(100).optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .min(1, 'At least one delivery address is required')
    .max(10, 'Maximum 10 delivery addresses allowed'),
  avatarUrl: z.string().url().optional(),
  ...ghanaCardRegistrationFields,
});

/**
 * Login validation schema
 */
export const loginSchema = z.object({
  emailOrPhone: z
    .string()
    .min(1, 'Email or phone number is required')
    .refine(
      (val) => {
        // Must be either valid email or valid phone
        return isValidEmail(val) || isValidPhone(val);
      },
      {
        message: 'Must be a valid email address or phone number',
      }
    ),
  password: z.string().min(1, 'Password is required'),
});

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = z.object({
  emailOrPhone: z
    .string()
    .min(1, 'Email or phone number is required')
    .refine(
      (val) => {
        return isValidEmail(val) || isValidPhone(val);
      },
      {
        message: 'Must be a valid email address or phone number',
      }
    ),
});

/**
 * Reset password validation schema
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .refine((val) => {
        const result = validatePassword(val);
        return result.isValid;
      }, (val) => {
        const result = validatePassword(val);
        return { message: result.error || 'Invalid password' };
      }),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Change password validation schema (for authenticated users)
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(1, 'New password is required')
      .refine((val) => {
        const result = validatePassword(val);
        return result.isValid;
      }, (val) => {
        const result = validatePassword(val);
        return { message: result.error || 'Invalid password' };
      }),
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Update my profile (PATCH /api/auth/me) - partial update for current user
 */
const BuyerTypeEnumFull = z.enum(['RESTAURANT', 'HOTEL', 'CATERER', 'INDIVIDUAL', 'BUSINESS']);
export const updateProfileSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email format')
      .refine((val) => isValidEmail(val), { message: 'Invalid email format' })
      .optional(),
    phone: z
      .string()
      .refine((val) => isValidPhone(val), { message: 'Invalid phone number format' })
      .optional(),
    fullName: z.string().min(1).max(100).optional(),
    farmName: z.string().max(100).optional().nullable(),
    region: z.string().min(1).max(100).optional(),
    town: z.string().min(1).max(100).optional(),
    weeklyCapacityMin: z.number().int().min(1).max(100000).optional(),
    weeklyCapacityMax: z.number().int().min(1).max(100000).optional(),
    produceCategory: z.string().min(1).max(50).optional(),
    feedingMethod: z.string().min(1).max(50).optional(),
    businessName: z.string().max(100).optional().nullable(),
    buyerType: BuyerTypeEnumFull.optional(),
    contactPerson: z.string().min(1).max(100).optional(),
    estimatedVolume: z.number().int().min(1).max(100000).optional().nullable(),
    orderFrequency: z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'AS_NEEDED']).optional().nullable(),
    ...ghanaCardProfileFields,
  })
  .refine(
    (data) => {
      if (data.weeklyCapacityMin != null && data.weeklyCapacityMax != null) {
        return data.weeklyCapacityMax >= data.weeklyCapacityMin;
      }
      return true;
    },
    { message: 'Maximum capacity must be >= minimum capacity', path: ['weeklyCapacityMax'] }
  )
  .superRefine((data, ctx) => {
    const d = data as Record<string, unknown>;
    const farmerTouched = [
      'fullName',
      'farmName',
      'region',
      'town',
      'weeklyCapacityMin',
      'weeklyCapacityMax',
      'produceCategory',
      'feedingMethod',
    ].some((k) => d[k] !== undefined);
    const buyerTouched = [
      'fullName',
      'businessName',
      'buyerType',
      'contactPerson',
      'estimatedVolume',
      'orderFrequency',
    ].some((k) => d[k] !== undefined);
    const ghanaTouched = GHANA_CARD_FIELD_KEYS.some((k) => d[k] !== undefined);
    if (!farmerTouched && !buyerTouched && !ghanaTouched) return;
    for (const k of GHANA_CARD_FIELD_KEYS) {
      const v = d[k];
      if (v == null || (typeof v === 'string' && v.trim() === '')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ghana Card details are required',
          path: [k],
        });
      }
    }
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Type exports for use in controllers
export type FarmerRegistrationInput = z.infer<typeof farmerRegistrationSchema>;
export type BuyerRegistrationInput = z.infer<typeof buyerRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

