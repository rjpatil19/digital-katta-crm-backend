import { z } from 'zod';

export const listLeadsQuerySchema = z.object({
  status: z
    .enum([
      'New',
      'ReportFetched',
      'AnalysisDone',
      'PackageSuggested',
      'PaymentPending',
      'Converted',
      'Lost'
    ])
    .optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0)
});

export const leadIdParamSchema = z.object({
  id: z.string().uuid()
});

export const fetchReportBodySchema = z.object({
  bureauName: z.enum(['CIBIL', 'EXPERIAN', 'CRIF', 'EQUIFAX']).default('CIBIL'),
  reportFileUrl: z.string().url().optional(),
  // For direct bureau credential pull simulation
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
  dateOfBirth: z.string().optional()
});

export const recommendPackageBodySchema = z.object({
  packageCode: z.enum(['BASIC_AUDIT', 'STANDARD_DISPUTE', 'PREMIUM_HANDHOLDING']).optional(),
  notes: z.string().optional()
});

export const initiatePaymentBodySchema = z.object({
  packageId: z.string().uuid().optional(),
  gateway: z.enum(['razorpay', 'cashfree', 'upi_collect']).default('razorpay')
});

export const createActivityLogBodySchema = z.object({
  actionType: z.enum(['NOTE_ADDED', 'CALL_LOGGED', 'PACKAGE_SENT', 'STATUS_CHANGE']).default('NOTE_ADDED'),
  noteContent: z.string().min(1),
  scheduledFollowup: z.string().datetime().optional()
});

export const logCommunicationBodySchema = z.object({
  channel: z.enum(['WhatsApp', 'PhoneCall', 'InPerson', 'Email']),
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  durationSeconds: z.number().int().min(0).optional(),
  summary: z.string().min(1),
  scheduledFollowup: z.string().datetime().optional()
});

export const updateLeadStatusBodySchema = z.object({
  status: z.enum([
    'New',
    'ReportFetched',
    'AnalysisDone',
    'PackageSuggested',
    'PaymentPending',
    'Lost'
  ]),
  lostReason: z.string().optional()
});

export const createLeadBodySchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  phone: z.string().regex(/^\+?[0-9]{10,13}$/),
  email: z.string().email().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional()
});
