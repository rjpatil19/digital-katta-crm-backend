import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  integer,
  jsonb,
  pgEnum,
  index
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ==========================================
// 1. PostgreSQL Enums
// ==========================================

export const userRoleEnum = pgEnum('user_role', [
  'PartnerAssistant',
  'CreditExpert',
  'Admin',
  'Customer'
]);

export const leadStatusEnum = pgEnum('lead_status', [
  'New',
  'ReportFetched',
  'AnalysisDone',
  'PackageSuggested',
  'PaymentPending',
  'Converted',
  'Lost'
]);

export const caseStatusEnum = pgEnum('case_status', [
  'Assigned',
  'UnderReview',
  'ActionPlanFormulated',
  'DisputeFiled',
  'FollowUpPending',
  'Resolved',
  'Closed'
]);

export const issueSeverityEnum = pgEnum('issue_severity', [
  'Critical',
  'High',
  'Medium',
  'Low'
]);

export const disputeStatusEnum = pgEnum('dispute_status', [
  'Drafted',
  'SubmittedToLender',
  'SubmittedToBureau',
  'UnderInvestigation',
  'Rectified',
  'Rejected'
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'Initiated',
  'Success',
  'Failed',
  'Refunded'
]);

// ==========================================
// 2. Database Tables
// ==========================================

// 1. Users Table
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: userRoleEnum('role').notNull(),
  franchiseId: varchar('franchise_id', { length: 50 }).default('MAIN_BRANCH').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// 2. Packages Table
export const packages = pgTable('packages', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  priceInr: numeric('price_inr', { precision: 10, scale: 2 }).notNull(),
  taxRate: numeric('tax_rate', { precision: 4, scale: 2 }).default('18.00').notNull(),
  features: jsonb('features').$type<string[]>().notNull(),
  validityDays: integer('validity_days').default(90).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

// 3. Leads Table (Unpaid Prospects managed by Partner Assistant)
export const leads = pgTable(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerUserId: uuid('customer_user_id').references(() => users.id, { onDelete: 'set null' }),
    assignedAssistantId: uuid('assigned_assistant_id').references(() => users.id, { onDelete: 'set null' }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }),
    phone: varchar('phone', { length: 20 }).notNull(),
    email: varchar('email', { length: 255 }),
    panNumber: varchar('pan_number', { length: 10 }),
    status: leadStatusEnum('status').default('New').notNull(),
    recommendedPackageId: uuid('recommended_package_id').references(() => packages.id, { onDelete: 'set null' }),
    scoreSummary: integer('score_summary'),
    detectedErrorsCount: integer('detected_errors_count').default(0).notNull(),
    lostReason: text('lost_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_leads_status').on(table.status),
    index('idx_leads_assistant').on(table.assignedAssistantId),
    index('idx_leads_phone').on(table.phone)
  ]
);

// 4. Payments Table (Supports Mock and Gateway Order IDs)
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }).notNull(),
    customerUserId: uuid('customer_user_id').references(() => users.id, { onDelete: 'set null' }),
    packageId: uuid('package_id').references(() => packages.id).notNull(),
    gatewayOrderId: varchar('gateway_order_id', { length: 100 }).notNull().unique(),
    gatewayPaymentId: varchar('gateway_payment_id', { length: 100 }),
    gatewaySignature: varchar('gateway_signature', { length: 255 }),
    amountInr: numeric('amount_inr', { precision: 10, scale: 2 }).notNull(),
    gstInr: numeric('gst_inr', { precision: 10, scale: 2 }).notNull(),
    status: paymentStatusEnum('status').default('Initiated').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_payments_order').on(table.gatewayOrderId),
    index('idx_payments_lead').on(table.leadId)
  ]
);

// 5. Cases Table (Paid Engagements assigned to Credit Expert)
export const cases = pgTable(
  'cases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseNumber: varchar('case_number', { length: 50 }).notNull().unique(),
    customerUserId: uuid('customer_user_id').references(() => users.id).notNull(),
    assignedExpertId: uuid('assigned_expert_id').references(() => users.id).notNull(),
    packageId: uuid('package_id').references(() => packages.id).notNull(),
    originatingLeadId: uuid('originating_lead_id').references(() => leads.id, { onDelete: 'set null' }),
    paymentId: uuid('payment_id').references(() => payments.id).notNull(),
    status: caseStatusEnum('status').default('Assigned').notNull(),
    initialScore: integer('initial_score').notNull(),
    targetScore: integer('target_score').notNull(),
    currentScore: integer('current_score'),
    slaDueDate: timestamp('sla_due_date', { withTimezone: true }),
    closureSummary: text('closure_summary'),
    closureRating: integer('closure_rating'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_cases_expert').on(table.assignedExpertId),
    index('idx_cases_customer').on(table.customerUserId),
    index('idx_cases_status').on(table.status)
  ]
);

// 6. AI Analysis Results & Raw Bureau Data
export const aiAnalysisResults = pgTable(
  'ai_analysis_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    bureauName: varchar('bureau_name', { length: 50 }).notNull(),
    score: integer('score').notNull(),
    reportDate: timestamp('report_date', { withTimezone: true }).notNull(),
    reportFileUrl: varchar('report_file_url', { length: 512 }),
    summaryMarkdown: text('summary_markdown'),
    totalAccounts: integer('total_accounts').notNull(),
    overdueAmount: numeric('overdue_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    creditUtilizationRatio: numeric('credit_utilization_ratio', { precision: 5, scale: 2 }).default('0.00').notNull(),
    enquiriesLast30Days: integer('enquiries_last_30_days').default(0).notNull(),
    rawExtractedJson: jsonb('raw_extracted_json').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_ai_analysis_lead').on(table.leadId),
    index('idx_ai_analysis_case').on(table.caseId)
  ]
);

// 7. Issues Table (Detected by AI or Flagged by Expert)
export const issues = pgTable(
  'issues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    analysisId: uuid('analysis_id').references(() => aiAnalysisResults.id, { onDelete: 'cascade' }).notNull(),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    accountNumber: varchar('account_number', { length: 50 }),
    lenderName: varchar('lender_name', { length: 150 }).notNull(),
    issueType: varchar('issue_type', { length: 100 }).notNull(),
    severity: issueSeverityEnum('severity').notNull(),
    estimatedScoreImpact: integer('estimated_score_impact').default(0).notNull(),
    dpdHistory: varchar('dpd_history', { length: 100 }),
    disputedAmount: numeric('disputed_amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    description: text('description').notNull(),
    expertOverrideNotes: text('expert_override_notes'),
    isValidForDispute: boolean('is_valid_for_dispute').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_issues_analysis').on(table.analysisId),
    index('idx_issues_case').on(table.caseId),
    index('idx_issues_severity').on(table.severity)
  ]
);

// 8. Disputes Table (Statutory Bureau/Lender Filings)
export const disputes = pgTable(
  'disputes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
    issueId: uuid('issue_id').references(() => issues.id, { onDelete: 'cascade' }).notNull(),
    targetEntity: varchar('target_entity', { length: 100 }).notNull(),
    status: disputeStatusEnum('status').default('Drafted').notNull(),
    tokenNumber: varchar('token_number', { length: 100 }),
    disputeLetterText: text('dispute_letter_text').notNull(),
    supportingDocumentUrls: jsonb('supporting_document_urls').$type<string[]>().default([]).notNull(),
    filedAt: timestamp('filed_at', { withTimezone: true }),
    rbiMandateDeadline: timestamp('rbi_mandate_deadline', { withTimezone: true }),
    resolutionDetails: text('resolution_details'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_disputes_case').on(table.caseId),
    index('idx_disputes_status').on(table.status)
  ]
);

// 9. Activity Logs & Notes
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id).notNull(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    actionType: varchar('action_type', { length: 50 }).notNull(),
    noteContent: text('note_content'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_activity_logs_lead').on(table.leadId),
    index('idx_activity_logs_case').on(table.caseId),
    index('idx_activity_logs_actor').on(table.actorId)
  ]
);

// 10. Communication Logs
export const communicationLogs = pgTable(
  'communication_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').references(() => users.id).notNull(),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 30 }).notNull(),
    direction: varchar('direction', { length: 10 }).notNull(),
    durationSeconds: integer('duration_seconds'),
    summary: text('summary').notNull(),
    scheduledFollowup: timestamp('scheduled_followup', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index('idx_comm_logs_lead').on(table.leadId),
    index('idx_comm_logs_case').on(table.caseId)
  ]
);

// ==========================================
// 3. Drizzle ORM Relations
// ==========================================

export const usersRelations = relations(users, ({ many }) => ({
  assignedLeads: many(leads, { relationName: 'partnerAssistantLeads' }),
  assignedCases: many(cases, { relationName: 'expertCases' }),
  activities: many(activityLogs),
  communications: many(communicationLogs)
}));

export const packagesRelations = relations(packages, ({ many }) => ({
  leads: many(leads),
  cases: many(cases)
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  customerUser: one(users, {
    fields: [leads.customerUserId],
    references: [users.id]
  }),
  assignedAssistant: one(users, {
    fields: [leads.assignedAssistantId],
    references: [users.id],
    relationName: 'partnerAssistantLeads'
  }),
  recommendedPackage: one(packages, {
    fields: [leads.recommendedPackageId],
    references: [packages.id]
  }),
  payments: many(payments),
  aiAnalyses: many(aiAnalysisResults),
  activityLogs: many(activityLogs),
  communicationLogs: many(communicationLogs)
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
  customerUser: one(users, {
    fields: [cases.customerUserId],
    references: [users.id]
  }),
  assignedExpert: one(users, {
    fields: [cases.assignedExpertId],
    references: [users.id],
    relationName: 'expertCases'
  }),
  package: one(packages, {
    fields: [cases.packageId],
    references: [packages.id]
  }),
  payment: one(payments, {
    fields: [cases.paymentId],
    references: [payments.id]
  }),
  issues: many(issues),
  disputes: many(disputes),
  activityLogs: many(activityLogs),
  communicationLogs: many(communicationLogs)
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  lead: one(leads, {
    fields: [payments.leadId],
    references: [leads.id]
  }),
  customerUser: one(users, {
    fields: [payments.customerUserId],
    references: [users.id]
  }),
  package: one(packages, {
    fields: [payments.packageId],
    references: [packages.id]
  })
}));

export const aiAnalysisResultsRelations = relations(aiAnalysisResults, ({ one, many }) => ({
  lead: one(leads, {
    fields: [aiAnalysisResults.leadId],
    references: [leads.id]
  }),
  case: one(cases, {
    fields: [aiAnalysisResults.caseId],
    references: [cases.id]
  }),
  issues: many(issues)
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  analysis: one(aiAnalysisResults, {
    fields: [issues.analysisId],
    references: [aiAnalysisResults.id]
  }),
  case: one(cases, {
    fields: [issues.caseId],
    references: [cases.id]
  }),
  disputes: many(disputes)
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  case: one(cases, {
    fields: [disputes.caseId],
    references: [cases.id]
  }),
  issue: one(issues, {
    fields: [disputes.issueId],
    references: [issues.id]
  })
}));
