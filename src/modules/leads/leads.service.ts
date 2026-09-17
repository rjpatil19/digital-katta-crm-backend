import { eq, and, sql, desc, ne, or, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { db } from '../../config/db';
import {
  leads,
  packages,
  aiAnalysisResults,
  issues,
  payments,
  activityLogs,
  communicationLogs
} from '../../db/schema';
import { evaluatePackageRecommendation } from '../packages/recommendation.engine';
import { JwtUserPayload } from '../auth/auth.types';

export class LeadsService {
  /**
   * List leads with role-based access control.
   * Partner Assistants can only view unpaid leads (status != 'Converted') assigned to them or unassigned.
   */
  static async listLeads(
    currentUser: JwtUserPayload,
    filters: {
      status?: string;
      search?: string;
      limit: number;
      offset: number;
    }
  ) {
    const { status, search, limit, offset } = filters;
    const conditions = [];

    // Partner Assistant isolation rule: Cannot see converted cases; only unassigned or own leads
    if (currentUser.role === 'PartnerAssistant') {
      conditions.push(ne(leads.status, 'Converted'));
      conditions.push(
        or(
          eq(leads.assignedAssistantId, currentUser.id),
          isNull(leads.assignedAssistantId)
        )
      );
    }

    if (status) {
      conditions.push(eq(leads.status, status as any));
    }

    if (search) {
      const searchPattern = `%${search.toLowerCase()}%`;
      conditions.push(
        or(
          sql`LOWER(${leads.firstName}) LIKE ${searchPattern}`,
          sql`LOWER(${leads.lastName}) LIKE ${searchPattern}`,
          sql`${leads.phone} LIKE ${`%${search}%`}`,
          sql`LOWER(${leads.panNumber}) LIKE ${searchPattern}`
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const leadItems = await db
      .select({
        id: leads.id,
        firstName: leads.firstName,
        lastName: leads.lastName,
        phone: leads.phone,
        email: leads.email,
        panNumber: leads.panNumber,
        status: leads.status,
        scoreSummary: leads.scoreSummary,
        detectedErrorsCount: leads.detectedErrorsCount,
        assignedAssistantId: leads.assignedAssistantId,
        recommendedPackageId: leads.recommendedPackageId,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
        recommendedPackageName: packages.name,
        recommendedPackagePrice: packages.priceInr
      })
      .from(leads)
      .leftJoin(packages, eq(leads.recommendedPackageId, packages.id))
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(whereClause);

    return {
      total: countResult[0]?.count || 0,
      limit,
      offset,
      data: leadItems
    };
  }

  /**
   * Create a new Lead
   */
  static async createLead(
    currentUser: JwtUserPayload,
    data: {
      firstName: string;
      lastName?: string;
      phone: string;
      email?: string;
      panNumber?: string;
    }
  ) {
    const [created] = await db
      .insert(leads)
      .values({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        panNumber: data.panNumber?.toUpperCase(),
        assignedAssistantId: currentUser.role === 'PartnerAssistant' ? currentUser.id : null,
        status: 'New'
      })
      .returning();

    await db.insert(activityLogs).values({
      actorId: currentUser.id,
      leadId: created.id,
      actionType: 'STATUS_CHANGE',
      noteContent: `Lead created by ${currentUser.fullName} (${currentUser.role}). Initial status: New.`
    });

    return created;
  }

  /**
   * Get single lead details with relations
   */
  static async getLeadById(currentUser: JwtUserPayload, leadId: string) {
    const leadList = await db
      .select()
      .from(leads)
      .where(eq(leads.id, leadId))
      .limit(1);

    if (leadList.length === 0) return null;

    const lead = leadList[0];

    // Access control check for Partner Assistants
    if (currentUser.role === 'PartnerAssistant' && lead.status === 'Converted') {
      throw new Error('Access denied: Converted leads are transitioned to Credit Experts');
    }

    // Fetch recommended package if any
    let recommendedPackage = null;
    if (lead.recommendedPackageId) {
      const pkgList = await db
        .select()
        .from(packages)
        .where(eq(packages.id, lead.recommendedPackageId))
        .limit(1);
      if (pkgList.length > 0) recommendedPackage = pkgList[0];
    }

    // Fetch latest analysis
    const latestAnalysis = await db
      .select()
      .from(aiAnalysisResults)
      .where(eq(aiAnalysisResults.leadId, lead.id))
      .orderBy(desc(aiAnalysisResults.createdAt))
      .limit(1);

    // Fetch recent activity
    const recentActivities = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.leadId, lead.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(5);

    return {
      ...lead,
      recommendedPackage,
      latestAnalysis: latestAnalysis[0] || null,
      recentActivities
    };
  }

  /**
   * Fetch bureau report and run AI analysis on the lead (Mock for now)
   */
  static async fetchAndAnalyzeReport(
    currentUser: JwtUserPayload,
    leadId: string,
    params: {
      bureauName: string;
      reportFileUrl?: string;
      panNumber?: string;
    }
  ) {
    const lead = await this.getLeadById(currentUser, leadId);
    if (!lead) throw new Error('Lead not found');

    // Simulate Bureau Fetch & AI parsing pipeline
    const score = Math.floor(Math.random() * (720 - 580 + 1)) + 580;
    const utilization = Number((Math.random() * (78 - 35) + 35).toFixed(2));
    const totalAccounts = 5;

    // Create AI Analysis Result
    const [analysis] = await db
      .insert(aiAnalysisResults)
      .values({
        leadId,
        bureauName: params.bureauName || 'CIBIL',
        score,
        reportDate: new Date(),
        reportFileUrl: params.reportFileUrl || 'https://storage.digitalkatta.com/reports/sample-cir.pdf',
        summaryMarkdown: `### ${params.bureauName} AI Analysis Summary\n- **Bureau Score**: ${score} / 900\n- **Revolving Card Utilization**: ${utilization}%\n- **Tradelines Assessed**: ${totalAccounts}\n- **Identified Inaccuracies**: Settled remark without written consent, 1 DPD sequence past limitation window.`,
        totalAccounts,
        overdueAmount: '18500.00',
        creditUtilizationRatio: String(utilization),
        enquiriesLast30Days: 3,
        rawExtractedJson: {
          bureauScore: score,
          utilization,
          totalAccounts,
          pulledBy: currentUser.fullName
        }
      })
      .returning();

    // Insert Identified Issues
    const detectedIssues = [
      {
        analysisId: analysis.id,
        accountNumber: 'XXXX-9901',
        lenderName: 'Axis Bank Credit Card',
        issueType: 'SettledRemark',
        severity: 'Critical' as const,
        estimatedScoreImpact: 40,
        disputedAmount: '12000.00',
        description: 'Account reported as Settled despite customer holding proof of full payment under Bank OTR 2024.',
        isValidForDispute: true
      },
      {
        analysisId: analysis.id,
        accountNumber: 'XXXX-1142',
        lenderName: 'SBI Cards',
        issueType: 'DPDLatePayment',
        severity: 'High' as const,
        estimatedScoreImpact: 25,
        dpdHistory: '000/030/060/000',
        disputedAmount: '2400.00',
        description: '30-60 DPD reported during disputed annual membership fee charge subsequently reversed by bank.',
        isValidForDispute: true
      }
    ];

    await db.insert(issues).values(detectedIssues);

    // Update Lead state to AnalysisDone
    await db
      .update(leads)
      .set({
        status: 'AnalysisDone',
        scoreSummary: score,
        detectedErrorsCount: detectedIssues.length,
        panNumber: params.panNumber ? params.panNumber.toUpperCase() : lead.panNumber,
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId));

    // Add Activity Log
    await db.insert(activityLogs).values({
      actorId: currentUser.id,
      leadId,
      actionType: 'STATUS_CHANGE',
      noteContent: `Fetched ${params.bureauName} report. AI Analysis detected Score: ${score} with ${detectedIssues.length} high-severity disputes.`
    });

    return {
      analysisId: analysis.id,
      score,
      detectedErrorsCount: detectedIssues.length,
      issues: detectedIssues
    };
  }

  /**
   * Get read-only AI analysis summary for Partner Assistant
   */
  static async getAnalysisSummary(currentUser: JwtUserPayload, leadId: string) {
    const analysisList = await db
      .select()
      .from(aiAnalysisResults)
      .where(eq(aiAnalysisResults.leadId, leadId))
      .orderBy(desc(aiAnalysisResults.createdAt))
      .limit(1);

    if (analysisList.length === 0) {
      return null;
    }

    const analysis = analysisList[0];

    const issueList = await db
      .select({
        id: issues.id,
        lenderName: issues.lenderName,
        issueType: issues.issueType,
        severity: issues.severity,
        estimatedScoreImpact: issues.estimatedScoreImpact,
        description: issues.description
      })
      .from(issues)
      .where(eq(issues.analysisId, analysis.id));

    const totalPotentialGain = issueList.reduce((acc, curr) => acc + curr.estimatedScoreImpact, 0);

    return {
      bureauName: analysis.bureauName,
      score: analysis.score,
      reportDate: analysis.reportDate,
      summaryMarkdown: analysis.summaryMarkdown,
      creditUtilizationRatio: analysis.creditUtilizationRatio,
      overdueAmount: analysis.overdueAmount,
      totalIssuesCount: issueList.length,
      totalPotentialGain,
      issues: issueList
    };
  }

  /**
   * Run recommendation engine or accept manual override from Partner Assistant
   */
  static async recommendPackage(
    currentUser: JwtUserPayload,
    leadId: string,
    overridePackageCode?: string,
    notes?: string
  ) {
    const lead = await this.getLeadById(currentUser, leadId);
    if (!lead) throw new Error('Lead not found');

    const analysisSummary = await this.getAnalysisSummary(currentUser, leadId);
    const score = analysisSummary?.score || lead.scoreSummary || 620;
    const criticalCount =
      analysisSummary?.issues.filter((i) => i.severity === 'Critical').length || 1;
    const minorCount =
      analysisSummary?.issues.filter((i) => i.severity === 'Medium' || i.severity === 'Low').length || 1;
    const utilization = parseFloat(analysisSummary?.creditUtilizationRatio || '45');

    // Run Recommendation Engine
    const recommendation = evaluatePackageRecommendation({
      score,
      criticalIssuesCount: criticalCount,
      minorIssuesCount: minorCount,
      utilizationRatio: utilization
    });

    const targetPackageCode = overridePackageCode || recommendation.recommendedPackageCode;

    // Look up Package in DB
    const pkgList = await db
      .select()
      .from(packages)
      .where(eq(packages.code, targetPackageCode))
      .limit(1);

    if (pkgList.length === 0) {
      throw new Error(`Package code ${targetPackageCode} not found in catalog`);
    }

    const chosenPackage = pkgList[0];

    // Update Lead state to PackageSuggested
    await db
      .update(leads)
      .set({
        recommendedPackageId: chosenPackage.id,
        status: 'PackageSuggested',
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId));

    // Record Activity Log
    await db.insert(activityLogs).values({
      actorId: currentUser.id,
      leadId,
      actionType: 'PACKAGE_SENT',
      noteContent: `Recommended package ${chosenPackage.name} (₹${chosenPackage.priceInr} + 18% GST). Rationale: ${recommendation.rationaleEn}. ${notes ? `Notes: ${notes}` : ''}`,
      metadata: {
        packageCode: chosenPackage.code,
        priceInr: chosenPackage.priceInr,
        recommendation
      }
    });

    return {
      leadId,
      status: 'PackageSuggested',
      recommendedPackage: chosenPackage,
      recommendationDetails: recommendation
    };
  }

  /**
   * Initiate Mock payment flow: creates pending order record and returns mock checkout metadata
   */
  static async initiatePayment(
    currentUser: JwtUserPayload,
    leadId: string,
    gateway: string = 'mock_payment'
  ) {
    const lead = await this.getLeadById(currentUser, leadId);
    if (!lead) throw new Error('Lead not found');

    if (!lead.recommendedPackageId) {
      throw new Error('Please recommend a package before initiating payment flow');
    }

    const pkgList = await db
      .select()
      .from(packages)
      .where(eq(packages.id, lead.recommendedPackageId))
      .limit(1);

    if (pkgList.length === 0) throw new Error('Recommended package not found');
    const pkg = pkgList[0];

    const baseAmount = parseFloat(pkg.priceInr);
    const taxRate = parseFloat(pkg.taxRate);
    const gstAmount = Number(((baseAmount * taxRate) / 100).toFixed(2));
    const totalAmount = Number((baseAmount + gstAmount).toFixed(2));

    // Generate mock order reference ID
    const orderRef = `mock_order_${crypto.randomBytes(8).toString('hex')}`;

    // Create Payment Record
    const [payment] = await db
      .insert(payments)
      .values({
        leadId,
        customerUserId: lead.customerUserId,
        packageId: pkg.id,
        gatewayOrderId: orderRef,
        amountInr: String(totalAmount),
        gstInr: String(gstAmount),
        status: 'Initiated',
        metadata: {
          gateway: 'mock_payment',
          packageCode: pkg.code,
          initiatedBy: currentUser.fullName
        }
      })
      .returning();

    // Transition Lead state to PaymentPending
    await db
      .update(leads)
      .set({
        status: 'PaymentPending',
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId));

    // Record Activity
    await db.insert(activityLogs).values({
      actorId: currentUser.id,
      leadId,
      actionType: 'STATUS_CHANGE',
      noteContent: `Initiated mock payment order ${orderRef} for ₹${totalAmount} (₹${baseAmount} + ₹${gstAmount} 18% GST). Status set to PaymentPending.`
    });

    return {
      paymentId: payment.id,
      gatewayOrderId: orderRef,
      leadId,
      packageName: pkg.name,
      baseAmount,
      gstAmount,
      totalAmount,
      currency: 'INR',
      isMockPayment: true,
      mockActionUrl: `/api/v1/payments/mock-success`,
      mockRequestBody: {
        gatewayOrderId: orderRef
      }
    };
  }

  /**
   * Add activity log / internal note
   */
  static async addActivityLog(
    currentUser: JwtUserPayload,
    leadId: string,
    actionType: string,
    noteContent: string,
    scheduledFollowup?: string
  ) {
    const [log] = await db
      .insert(activityLogs)
      .values({
        actorId: currentUser.id,
        leadId,
        actionType,
        noteContent,
        metadata: scheduledFollowup ? { scheduledFollowup } : null
      })
      .returning();

    return log;
  }

  /**
   * Get communication history
   */
  static async getConversations(leadId: string) {
    return await db
      .select({
        id: communicationLogs.id,
        channel: communicationLogs.channel,
        direction: communicationLogs.direction,
        durationSeconds: communicationLogs.durationSeconds,
        summary: communicationLogs.summary,
        scheduledFollowup: communicationLogs.scheduledFollowup,
        createdAt: communicationLogs.createdAt
      })
      .from(communicationLogs)
      .where(eq(communicationLogs.leadId, leadId))
      .orderBy(desc(communicationLogs.createdAt));
  }

  /**
   * Log communication (Call, WhatsApp, Email)
   */
  static async logCommunication(
    currentUser: JwtUserPayload,
    leadId: string,
    data: {
      channel: string;
      direction: string;
      durationSeconds?: number;
      summary: string;
      scheduledFollowup?: string;
    }
  ) {
    const [log] = await db
      .insert(communicationLogs)
      .values({
        actorId: currentUser.id,
        leadId,
        channel: data.channel,
        direction: data.direction,
        durationSeconds: data.durationSeconds || null,
        summary: data.summary,
        scheduledFollowup: data.scheduledFollowup ? new Date(data.scheduledFollowup) : null
      })
      .returning();

    return log;
  }

  /**
   * Update lead status (e.g. marking as Lost with reason)
   */
  static async updateLeadStatus(
    currentUser: JwtUserPayload,
    leadId: string,
    status: string,
    lostReason?: string
  ) {
    const [updated] = await db
      .update(leads)
      .set({
        status: status as any,
        lostReason: lostReason || null,
        updatedAt: new Date()
      })
      .where(eq(leads.id, leadId))
      .returning();

    await db.insert(activityLogs).values({
      actorId: currentUser.id,
      leadId,
      actionType: 'STATUS_CHANGE',
      noteContent: `Status updated to ${status}.${lostReason ? ` Reason: ${lostReason}` : ''}`
    });

    return updated;
  }
}
