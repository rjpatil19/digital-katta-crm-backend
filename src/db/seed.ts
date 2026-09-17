import bcrypt from 'bcryptjs';
import { db } from '../config/db';
import { users, packages, leads } from './schema';
import { eq } from 'drizzle-orm';

export async function runSeed() {
  console.log('🌱 Seeding Digital कट्टा CRM Database...');

  const defaultPassword = 'Katta@Secure2026';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(defaultPassword, salt);

  // ==========================================
  // 1. Seed Packages
  // ==========================================
  const seedPackages = [
    {
      code: 'BASIC_AUDIT',
      name: 'Basic Analysis',
      priceInr: '999.00',
      taxRate: '18.00',
      validityDays: 45,
      features: [
        'Single bureau (CIBIL) AI audit report',
        'Identification of duplicate accounts & clerical errors',
        'Summary score simulator & debt payoff schedule',
        'Email dispute guide template'
      ]
    },
    {
      code: 'STANDARD_DISPUTE',
      name: 'Standard Dispute',
      priceInr: '3999.00',
      taxRate: '18.00',
      validityDays: 90,
      features: [
        'Dual bureau (CIBIL + Experian) cross-reconciliation',
        'Statutory dispute filing under Section 21 CICRA',
        'Lender escalation draft letters for DPD/settled tags',
        '30-day follow-up tracking & dedicated Credit Expert assignment'
      ]
    },
    {
      code: 'PREMIUM_HANDHOLDING',
      name: 'Premium Handholding',
      priceInr: '9999.00',
      taxRate: '18.00',
      validityDays: 180,
      features: [
        'All 4 bureaus (CIBIL, Experian, CRIF, Equifax) comprehensive coverage',
        'Personal Senior Credit Expert + SLA guaranteed response',
        'Banking Ombudsman escalation assistance if unresolved by day 30',
        'Card utilization restructuring & loan pre-qualification advisory'
      ]
    }
  ];

  for (const pkg of seedPackages) {
    const existing = await db
      .select()
      .from(packages)
      .where(eq(packages.code, pkg.code))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(packages).values(pkg);
      console.log(`  ➕ Package created: ${pkg.name} (${pkg.code}) - ₹${pkg.priceInr}`);
    } else {
      console.log(`  ✔️ Package exists: ${pkg.name}`);
    }
  }

  // ==========================================
  // 2. Seed Test Users (1 Admin, 2 PartnerAssistants, 2 CreditExperts, 2 Customers)
  // ==========================================
  const seedUsers = [
    // 1 Admin
    {
      fullName: 'Rajesh Kadam',
      email: 'admin@digitalkatta.com',
      phone: '+919820011000',
      passwordHash,
      role: 'Admin' as const,
      franchiseId: 'HQ_MUMBAI'
    },
    // 2 Partner Assistants
    {
      fullName: 'Sneha Patil',
      email: 'assistant.sneha@digitalkatta.com',
      phone: '+919820011001',
      passwordHash,
      role: 'PartnerAssistant' as const,
      franchiseId: 'PUNE_KOTHRUD'
    },
    {
      fullName: 'Rohit Shinde',
      email: 'assistant.rohit@digitalkatta.com',
      phone: '+919820011002',
      passwordHash,
      role: 'PartnerAssistant' as const,
      franchiseId: 'MUMBAI_THANE'
    },
    // 2 Credit Experts
    {
      fullName: 'Vikram Deshmukh',
      email: 'expert.vikram@digitalkatta.com',
      phone: '+919820011003',
      passwordHash,
      role: 'CreditExpert' as const,
      franchiseId: 'HQ_MUMBAI'
    },
    {
      fullName: 'Ananya Joshi',
      email: 'expert.ananya@digitalkatta.com',
      phone: '+919820011004',
      passwordHash,
      role: 'CreditExpert' as const,
      franchiseId: 'HQ_MUMBAI'
    },
    // 2 Customers
    {
      fullName: 'Rahul More',
      email: 'customer.rahul@example.com',
      phone: '+919820011005',
      passwordHash,
      role: 'Customer' as const,
      franchiseId: 'PUNE_KOTHRUD'
    },
    {
      fullName: 'Priya Kulkarni',
      email: 'customer.priya@example.com',
      phone: '+919820011006',
      passwordHash,
      role: 'Customer' as const,
      franchiseId: 'MUMBAI_THANE'
    }
  ];

  const createdUserMap: Record<string, string> = {};

  for (const u of seedUsers) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, u.email))
      .limit(1);

    if (existing.length === 0) {
      const [inserted] = await db.insert(users).values(u).returning();
      createdUserMap[u.email] = inserted.id;
      console.log(`  ➕ User created: ${u.fullName} (${u.role}) - ${u.email}`);
    } else {
      createdUserMap[u.email] = existing[0].id;
      console.log(`  ✔️ User exists: ${u.fullName} (${u.role})`);
    }
  }

  // ==========================================
  // 3. Seed Sample Leads for Partner Assistants
  // ==========================================
  const snehaId = createdUserMap['assistant.sneha@digitalkatta.com'];
  const rohitId = createdUserMap['assistant.rohit@digitalkatta.com'];
  const rahulCustomerId = createdUserMap['customer.rahul@example.com'];

  const sampleLeads = [
    {
      firstName: 'Amit',
      lastName: 'Gaikwad',
      phone: '+919876543210',
      email: 'amit.gaikwad@example.com',
      panNumber: 'ABCDE1234F',
      status: 'New' as const,
      assignedAssistantId: snehaId
    },
    {
      firstName: 'Rahul',
      lastName: 'More',
      phone: '+919820011005',
      email: 'customer.rahul@example.com',
      panNumber: 'FGHIJ5678K',
      customerUserId: rahulCustomerId,
      status: 'AnalysisDone' as const,
      scoreSummary: 628,
      detectedErrorsCount: 2,
      assignedAssistantId: snehaId
    },
    {
      firstName: 'Sunil',
      lastName: 'Kambale',
      phone: '+919765432109',
      email: 'sunil.k@example.com',
      panNumber: 'KLMNO9012P',
      status: 'PackageSuggested' as const,
      scoreSummary: 590,
      detectedErrorsCount: 3,
      assignedAssistantId: rohitId
    }
  ];

  for (const lead of sampleLeads) {
    const existing = await db
      .select()
      .from(leads)
      .where(eq(leads.phone, lead.phone))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(leads).values(lead);
      console.log(`  ➕ Sample Lead created: ${lead.firstName} ${lead.lastName} (Status: ${lead.status})`);
    }
  }

  console.log('✅ Seeding completed successfully!');
  console.log('----------------------------------------------------');
  console.log('Default Password for all seeded users: Katta@Secure2026');
  console.log('1 Admin:            admin@digitalkatta.com');
  console.log('2 PartnerAssistants: assistant.sneha@digitalkatta.com, assistant.rohit@digitalkatta.com');
  console.log('2 CreditExperts:    expert.vikram@digitalkatta.com, expert.ananya@digitalkatta.com');
  console.log('2 Customers:        customer.rahul@example.com, customer.priya@example.com');
  console.log('----------------------------------------------------');
}

// Allow standalone execution: `npx tsx src/backend/db/seed.ts`
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      process.exit(1);
    });
}
