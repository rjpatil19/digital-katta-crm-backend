import { FastifyInstance } from 'fastify';
import { LeadsController } from './leads.controller';
import { authenticate, requireRoles } from '../auth/auth.middleware';

export async function leadsRoutes(fastify: FastifyInstance) {
  // All lead handling endpoints require PartnerAssistant or Admin permissions
  const partnerAssistantGuard = {
    preHandler: [authenticate, requireRoles(['PartnerAssistant', 'Admin'])]
  };

  // 1. List Leads (Unpaid / assigned)
  fastify.get('/leads', partnerAssistantGuard, LeadsController.listLeads);

  // 2. Create Lead
  fastify.post('/leads', partnerAssistantGuard, LeadsController.createLead);

  // 3. Get Lead By ID
  fastify.get('/leads/:id', partnerAssistantGuard, LeadsController.getLeadById);

  // 4. Fetch CIBIL / Bureau Report & Run AI Analysis (Mock)
  fastify.post('/leads/:id/fetch-report', partnerAssistantGuard, LeadsController.fetchReport);

  // 5. Read-only AI Summary
  fastify.get('/leads/:id/analysis-summary', partnerAssistantGuard, LeadsController.getAnalysisSummary);

  // 6. Recommend Package (Rule-based engine or override)
  fastify.post('/leads/:id/recommend-package', partnerAssistantGuard, LeadsController.recommendPackage);

  // 7. Initiate Mock Payment Flow
  fastify.post('/leads/:id/initiate-payment', partnerAssistantGuard, LeadsController.initiatePayment);

  // 8. Add Activity Log / Note
  fastify.post('/leads/:id/activity-logs', partnerAssistantGuard, LeadsController.addActivityLog);

  // 9. Get Conversations (Chat / WhatsApp / Call History)
  fastify.get('/leads/:id/conversations', partnerAssistantGuard, LeadsController.getConversations);

  // 10. Log Communication Event
  fastify.post('/leads/:id/communications', partnerAssistantGuard, LeadsController.logCommunication);

  // 11. Update Status (e.g. mark as Lost with reason)
  fastify.patch('/leads/:id/status', partnerAssistantGuard, LeadsController.updateStatus);
}
