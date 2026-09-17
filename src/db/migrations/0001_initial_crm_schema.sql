-- Digital कट्टा CRM: Initial PostgreSQL Migration
-- Migration: 0001_initial_crm_schema.sql
-- Created: 2026-09-16

BEGIN;

-- Enable UUID & Cryptographic extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. Create Enumerations
-- ==========================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('PartnerAssistant', 'CreditExpert', 'Admin', 'Customer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM (
        'New', 
        'ReportFetched', 
        'AnalysisDone', 
        'PackageSuggested', 
        'PaymentPending', 
        'Converted', 
        'Lost'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE case_status AS ENUM (
        'Assigned', 
        'UnderReview', 
        'ActionPlanFormulated', 
        'DisputeFiled', 
        'FollowUpPending', 
        'Resolved', 
        'Closed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE issue_severity AS ENUM ('Critical', 'High', 'Medium', 'Low');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dispute_status AS ENUM (
        'Drafted', 
        'SubmittedToLender', 
        'SubmittedToBureau', 
        'UnderInvestigation', 
        'Rectified', 
        'Rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('Initiated', 'Success', 'Failed', 'Refunded');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- 2. Create Tables & Constraints
-- ==========================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    franchise_id VARCHAR(50) DEFAULT 'MAIN_BRANCH' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Packages Table
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price_inr NUMERIC(10, 2) NOT NULL,
    tax_rate NUMERIC(4, 2) DEFAULT 18.00 NOT NULL,
    features JSONB NOT NULL,
    validity_days INT DEFAULT 90 NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Leads (Managed by Partner Assistant)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_assistant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    pan_number VARCHAR(10),
    status lead_status DEFAULT 'New' NOT NULL,
    recommended_package_id UUID REFERENCES packages(id) ON DELETE SET NULL,
    score_summary INT,
    detected_errors_count INT DEFAULT 0 NOT NULL,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 4. Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    customer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    package_id UUID NOT NULL REFERENCES packages(id),
    gateway_order_id VARCHAR(100) UNIQUE NOT NULL,
    gateway_payment_id VARCHAR(100),
    gateway_signature VARCHAR(255),
    amount_inr NUMERIC(10, 2) NOT NULL,
    gst_inr NUMERIC(10, 2) NOT NULL,
    status payment_status DEFAULT 'Initiated' NOT NULL,
    metadata JSONB,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 5. Cases (Managed by Credit Expert)
CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_number VARCHAR(50) UNIQUE NOT NULL,
    customer_user_id UUID NOT NULL REFERENCES users(id),
    assigned_expert_id UUID NOT NULL REFERENCES users(id),
    package_id UUID NOT NULL REFERENCES packages(id),
    originating_lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    payment_id UUID NOT NULL REFERENCES payments(id),
    status case_status DEFAULT 'Assigned' NOT NULL,
    initial_score INT NOT NULL,
    target_score INT NOT NULL,
    current_score INT,
    sla_due_date TIMESTAMPTZ,
    closure_summary TEXT,
    closure_rating INT CHECK (closure_rating >= 1 AND closure_rating <= 5),
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. AI Analysis Results & Raw Bureau Data
CREATE TABLE IF NOT EXISTS ai_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    bureau_name VARCHAR(50) NOT NULL,
    score INT NOT NULL,
    report_date TIMESTAMPTZ NOT NULL,
    report_file_url VARCHAR(512),
    summary_markdown TEXT,
    total_accounts INT NOT NULL,
    overdue_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    credit_utilization_ratio NUMERIC(5, 2) DEFAULT 0.00 NOT NULL,
    enquiries_last_30_days INT DEFAULT 0 NOT NULL,
    raw_extracted_json JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. Issues (Detected by AI or Flagged by Expert)
CREATE TABLE IF NOT EXISTS issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id UUID NOT NULL REFERENCES ai_analysis_results(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    account_number VARCHAR(50),
    lender_name VARCHAR(150) NOT NULL,
    issue_type VARCHAR(100) NOT NULL,
    severity issue_severity NOT NULL,
    estimated_score_impact INT DEFAULT 0 NOT NULL,
    dpd_history VARCHAR(100),
    disputed_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    description TEXT NOT NULL,
    expert_override_notes TEXT,
    is_valid_for_dispute BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. Disputes (Statutory Filings under Section 21)
CREATE TABLE IF NOT EXISTS disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    target_entity VARCHAR(100) NOT NULL,
    status dispute_status DEFAULT 'Drafted' NOT NULL,
    token_number VARCHAR(100),
    dispute_letter_text TEXT NOT NULL,
    supporting_document_urls JSONB DEFAULT '[]'::JSONB NOT NULL,
    filed_at TIMESTAMPTZ,
    rbi_mandate_deadline TIMESTAMPTZ,
    resolution_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. Activity Logs & Internal Notes
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL,
    note_content TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. Communication Logs
CREATE TABLE IF NOT EXISTS communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    channel VARCHAR(30) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    duration_seconds INT,
    summary TEXT NOT NULL,
    scheduled_followup TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assistant ON leads(assigned_assistant_id);
CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_lead ON payments(lead_id);

CREATE INDEX IF NOT EXISTS idx_cases_expert ON cases(assigned_expert_id);
CREATE INDEX IF NOT EXISTS idx_cases_customer ON cases(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_lead ON ai_analysis_results(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_case ON ai_analysis_results(case_id);

CREATE INDEX IF NOT EXISTS idx_issues_analysis ON issues(analysis_id);
CREATE INDEX IF NOT EXISTS idx_issues_case ON issues(case_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);

CREATE INDEX IF NOT EXISTS idx_disputes_case ON disputes(case_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);

CREATE INDEX IF NOT EXISTS idx_activity_logs_lead ON activity_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_case ON activity_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_id);

CREATE INDEX IF NOT EXISTS idx_comm_logs_lead ON communication_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_comm_logs_case ON communication_logs(case_id);

COMMIT;
