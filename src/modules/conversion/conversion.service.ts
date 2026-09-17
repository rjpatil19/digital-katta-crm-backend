import { eq, sql, and } from 'drizzle-orm';
import { db } from '../../config/db';
import {
  leads,
  cases,
  payments,
  users,
  aiAnalysisResults,
  issues,
  packages,
  activityLogs
} from '../../db/schema';

export interface PaymentSuccessInput {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string;
  metadata?: Record<string, unknown>;
}

export class ConversionService {
  /**
   * Atomically converts a paid lead into an active Credit Advisory Case
   * Handled inside a single PostgreSQL ACID transaction.
   */
  static async handleSuccessfulPayment(input: PaymentSuccessInput) {
    const { gatewayOrderId, gatewayPaymentId, gatewaySignature, metadata } = input;

    return await db.transaction(async (tx) => {
      // 1. Fetch Payment by Gateway Order ID
      const paymentList = await tx
        .select()
        .from(payments)
        .where(eq(payments.gatewayOrderId, gatewayOrderId))
        .limit(1);

      if (paymentList.length === 0) {
        throw new Error(`Payment record with Order ID ${gatewayOrderId} not found`);
      }

      const payment = paymentList[0];

      // If already processed, idempotently return existing case
      if (payment.status === 'Success') {
        const existingCaseList = await tx
          .select()
          .from(cases)
          .where(eq(cases.paymentId, payment.id))
          .limit(1);

        if (existingCaseList.length > 0) {
          return {
            alreadyProcessed: true,
            caseId: existingCaseList[0].id,
            caseNumber: existingCaseList[0].caseNumber,
            assignedExpertId: existingCaseList[0].assignedExpertId
          };
        }
      }

      // 2. Lock & Fetch Lead
      const leadList = await tx
        .select()
        .from(leads)
        .where(eq(leads.id, payment.leadId))
        .limit(1);

      if (leadList.length === 0) {
        throw new Error(`Lead ${payment.leadId} associated with payment not found`);
      }

      const lead = leadList[0];

      // 3. Mark Payment as Success
      await tx
        .update(payments)
        .set({
          status: 'Success',
          gatewayPaymentId,
          gatewaySignature: gatewaySignature || null,
          paidAt: new Date(),
          metadata: metadata || null,
          updatedAt: new Date()
        })
        .where(eq(payments.id, payment.id));

      // 4. Mark Lead as Converted
      await tx
        .update(leads)
        .set({
          status: 'Converted',
          updatedAt: new Date()
        })
        .where(eq(leads.id, lead.id));

      // 5. Fetch Package details for SLA calculation
      const packageList = await tx
        .select()
        .from(packages)
        .where(eq(packages.id, payment.packageId))
        .limit(1);

      const validityDays = packageList.length > 0 ? packageList[0].validityDays : 90;

      // 6. Find least-loaded active CreditExpert (Weighted Round-Robin)
      const expertWorkloads = await tx.execute(sql`
        SELECT 
          u.id, 
          u.full_name,
          COUNT(c.id) FILTER (WHERE c.status NOT IN ('Closed', 'Resolved')) AS active_case_count
        FROM users u
        LEFT JOIN cases c ON u.id = c.assigned_expert_id
        WHERE u.role = 'CreditExpert' AND u.is_active = TRUE
        GROUP BY u.id, u.full_name
        ORDER BY active_case_count ASC, u.created_at ASC
        LIMIT 1
      `);

      if (!expertWorkloads || expertWorkloads.length === 0) {
        throw new Error('No active Credit Experts currently available for assignment');
      }

      const assignedExpertId = expertWorkloads[0].id as string;
      const assignedExpertName = expertWorkloads[0].full_name as string;

      // 7. Generate Case Number (e.g. DK-2026-0042)
      const currentYear = new Date().getFullYear();
      const countResult = await tx.execute(
        sql`SELECT COUNT(*)::int AS count FROM cases WHERE case_number LIKE ${`DK-${currentYear}-%`}`
      );
      const caseCount = ((countResult[0]?.count as number) || 0) + 1;
      const caseNumber = `DK-${currentYear}-${String(caseCount).padStart(4, '0')}`;

      // 8. Calculate Target Score
      const initialScore = lead.scoreSummary || 620;
      // Target score: standard recovery target +60 to +80 points, capped at 825
      const targetScore = Math.min(850, Math.max(750, initialScore + 75));

      // SLA date
      const slaDueDate = new Date();
      slaDueDate.setDate(slaDueDate.getDate() + validityDays);

      // Ensure customer user exists; if lead was guest, create customer user account or link
      let customerUserId = lead.customerUserId;
      if (!customerUserId) {
        const [newCustomerUser] = await tx
          .insert(users)
          .values({
            fullName: `${lead.firstName} ${lead.lastName || ''}`.trim(),
            email: lead.email || `customer.${lead.phone.replace(/\D/g, '')}@digitalkatta.com`,
            phone: lead.phone,
            passwordHash: '$2a$10$temporaryhashuntilfirstlogin2026',
            role: 'Customer',
            franchiseId: 'HQ_PUNE',
            isActive: true
          })
          .returning();

        customerUserId = newCustomerUser.id;

        await tx
          .update(leads)
          .set({ customerUserId })
          .where(eq(leads.id, lead.id));
      }

      // 9. Insert Case
      const [newCase] = await tx
        .insert(cases)
        .values({
          caseNumber,
          customerUserId,
          assignedExpertId,
          packageId: payment.packageId,
          originatingLeadId: lead.id,
          paymentId: payment.id,
          status: 'Assigned',
          initialScore,
          targetScore,
          currentScore: initialScore,
          slaDueDate,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      // 10. Re-associate AI Analysis Results & Issues to the new Case
      await tx
        .update(aiAnalysisResults)
        .set({ caseId: newCase.id })
        .where(eq(aiAnalysisResults.leadId, lead.id));

      const linkedAnalyses = await tx
        .select({ id: aiAnalysisResults.id })
        .from(aiAnalysisResults)
        .where(eq(aiAnalysisResults.leadId, lead.id));

      if (linkedAnalyses.length > 0) {
        for (const analysis of linkedAnalyses) {
          await tx
            .update(issues)
            .set({ caseId: newCase.id })
            .where(eq(issues.analysisId, analysis.id));
        }
      }

      // 11. Record Activity Log
      await tx.insert(activityLogs).values({
        actorId: assignedExpertId,
        leadId: lead.id,
        caseId: newCase.id,
        actionType: 'STATUS_CHANGE',
        noteContent: `Lead converted to active Case ${caseNumber} following verified payment of ₹${payment.amountInr}. Assigned to Credit Expert ${assignedExpertName}.`,
        metadata: {
          gatewayOrderId,
          gatewayPaymentId,
          initialScore,
          targetScore,
          packageId: payment.packageId
        }
      });

      return {
        alreadyProcessed: false,
        caseId: newCase.id,
        caseNumber: newCase.caseNumber,
        customerUserId,
        assignedExpertId,
        assignedExpertName,
        initialScore,
        targetScore,
        slaDueDate
      };
    });
  }
}
