# Digital कट्टा CRM Backend

Production-ready, highly compliant CRM backend for **Digital कट्टा**, India's trusted credit advisory and credit repair platform. Built under **RBI Master Direction 2023** and **CICRA 2005 (Credit Information Companies Regulation Act)** compliance frameworks.

---

## 🛠 Tech Stack

- **Runtime**: Node.js v20+ with ES Modules
- **Framework**: Fastify v5 (high performance, low overhead)
- **Database & ORM**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT with Role-Based Access Control (RBAC)
- **Validation**: Zod (strict schema parsing on params, query, and bodies)
- **Job Queues**: BullMQ + Redis (asynchronous background bureau analysis & dispute notifications)
- **Payment Gateway**: Mock Payment Pipeline (ready for Razorpay/Cashfree webhooks)

---

## 📂 Project Structure

```
digital-katta-crm-backend/
├── src/
│   ├── app.ts                  # Fastify app setup, CORS, JWT, route mounting
│   ├── index.ts                # Server bootstrapper & listener
│   ├── config/
│   │   ├── db.ts               # Drizzle ORM client initialization
│   │   └── env.ts              # Zod environment variable validation
│   ├── db/
│   │   ├── schema.ts           # PostgreSQL schema (all 10 tables, enums & relations)
│   │   ├── seed.ts             # Initial seeding (packages, admin, assistants, experts)
│   │   └── migrations/
│   │       └── 0001_initial_crm_schema.sql  # SQL migration
│   ├── modules/
│   │   ├── auth/               # JWT auth, RBAC guards, login & profile
│   │   ├── conversion/         # Atomic Lead-to-Case transaction service
│   │   ├── leads/              # Partner Assistant workflows & state machine
│   │   ├── packages/           # Package recommendation heuristics engine
│   │   └── payments/           # Mock payment routes & webhook receivers
│   └── queue/
│       └── crm.queue.ts        # BullMQ queues & workers
├── drizzle.config.ts           # Drizzle Kit CLI configuration
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 👥 Core Role Matrix

| Role | Responsibilities | Access Scope |
|---|---|---|
| **PartnerAssistant** | Handles new prospects, bureau pulls, AI summaries, package recommendations, mock payments | Unpaid leads only (`status != 'Converted'`) |
| **CreditExpert** | Manages assigned active cases, dispute drafts, statutory filings under Section 21 | Active cases assigned to them |
| **Admin** | Full system visibility, staff management, reassignment, reporting | Complete access across all entities |
| **Customer** | End-user account, consent records, tracking | Own profile & case data |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Update DATABASE_URL with your PostgreSQL connection string
```

### 3. Run Database Migrations & Seed Data
```bash
# Run migrations using psql or drizzle-kit
psql $DATABASE_URL < src/db/migrations/0001_initial_crm_schema.sql

# Seed 3 packages and test users
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```
The server will boot at `http://0.0.0.0:3001` (or your configured `CRM_PORT`).

---

## 🔑 Default Seeded Credentials

All accounts are created with password: `Katta@Secure2026`

| Role | Full Name | Email |
|---|---|---|
| **Admin** | Rajesh Kadam | `admin@digitalkatta.com` |
| **PartnerAssistant** | Sneha Patil | `assistant.sneha@digitalkatta.com` |
| **PartnerAssistant** | Rohit Shinde | `assistant.rohit@digitalkatta.com` |
| **CreditExpert** | Vikram Deshmukh | `expert.vikram@digitalkatta.com` |
| **CreditExpert** | Ananya Joshi | `expert.ananya@digitalkatta.com` |
| **Customer** | Rahul More | `customer.rahul@example.com` |
| **Customer** | Priya Kulkarni | `customer.priya@example.com` |

---

## 📦 Packages Catalog

1. **Basic Analysis (`BASIC_AUDIT`)**: ₹999 + 18% GST (45-day validity)
2. **Standard Dispute (`STANDARD_DISPUTE`)**: ₹3,999 + 18% GST (90-day validity)
3. **Premium Handholding (`PREMIUM_HANDHOLDING`)**: ₹9,999 + 18% GST (180-day validity)

---

## 📡 API Reference

### 1. Authentication
- `POST /api/v1/auth/login` - Login with email & password, returns JWT token.
- `GET /api/v1/auth/me` - Get profile of authenticated user.

### 2. Leads (Partner Assistant)
All lead endpoints require `Bearer <token>` with `PartnerAssistant` or `Admin` role.
- `GET /api/v1/leads` - List unpaid leads with search and status filtering.
- `POST /api/v1/leads` - Create a new prospect lead.
- `GET /api/v1/leads/:id` - Get full lead profile with AI history & package info.
- `POST /api/v1/leads/:id/fetch-report` - Trigger bureau pull & AI issue analysis.
- `GET /api/v1/leads/:id/analysis-summary` - Read-only summary of detected tradeline errors.
- `POST /api/v1/leads/:id/recommend-package` - Lock package recommendation (`PackageSuggested`).
- `POST /api/v1/leads/:id/initiate-payment` - Generate mock payment order with GST (`PaymentPending`).
- `POST /api/v1/leads/:id/activity-logs` - Add internal notes and follow-ups.
- `GET /api/v1/leads/:id/conversations` - Get communication logs.
- `POST /api/v1/leads/:id/communications` - Log phone/WhatsApp conversation.
- `PATCH /api/v1/leads/:id/status` - Transition status (e.g. mark `Lost` with reason).

### 3. Mock Payments & Atomic Conversion
- `POST /api/v1/payments/mock-success`
  ```json
  {
    "gatewayOrderId": "mock_order_xxxx"
  }
  ```
  - Verifies payment in DB.
  - Runs single ACID transaction:
    1. Sets payment to `Success`.
    2. Converts lead (`leads.status = 'Converted'`).
    3. Finds least-loaded active `CreditExpert` using weighted round-robin.
    4. Generates unique case number (`DK-2026-XXXX`).
    5. Calculates SLA due date from package validity days.
    6. Relinks all AI analysis results and detected issues to the new case.
    7. Creates audit log in `activity_logs`.
- `POST /api/v1/webhooks/payments/razorpay` - Production webhook listener with signature verification.
