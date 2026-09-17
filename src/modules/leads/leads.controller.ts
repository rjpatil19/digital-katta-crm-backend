import { FastifyRequest, FastifyReply } from 'fastify';
import { LeadsService } from './leads.service';
import { JwtUserPayload } from '../auth/auth.types';
import {
  listLeadsQuerySchema,
  leadIdParamSchema,
  createLeadBodySchema,
  fetchReportBodySchema,
  recommendPackageBodySchema,
  initiatePaymentBodySchema,
  createActivityLogBodySchema,
  logCommunicationBodySchema,
  updateLeadStatusBodySchema
} from './leads.schema';

export class LeadsController {
  private static getUser(request: FastifyRequest): JwtUserPayload {
    return request.user as JwtUserPayload;
  }

  static async listLeads(request: FastifyRequest, reply: FastifyReply) {
    const query = listLeadsQuerySchema.parse(request.query);
    const user = LeadsController.getUser(request);
    const result = await LeadsService.listLeads(user, query);
    return reply.status(200).send({
      success: true,
      data: result
    });
  }

  static async createLead(request: FastifyRequest, reply: FastifyReply) {
    const body = createLeadBodySchema.parse(request.body);
    const user = LeadsController.getUser(request);
    const result = await LeadsService.createLead(user, body);
    return reply.status(201).send({
      success: true,
      message: 'Lead created successfully',
      data: result
    });
  }

  static async getLeadById(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const user = LeadsController.getUser(request);
    const lead = await LeadsService.getLeadById(user, id);
    if (!lead) {
      return reply.status(404).send({
        success: false,
        error: 'Not Found',
        message: 'Lead not found'
      });
    }

    return reply.status(200).send({
      success: true,
      data: lead
    });
  }

  static async fetchReport(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const body = fetchReportBodySchema.parse(request.body || {});
    const user = LeadsController.getUser(request);
    const result = await LeadsService.fetchAndAnalyzeReport(user, id, body);
    return reply.status(200).send({
      success: true,
      message: 'Bureau report retrieved and AI analysis generated',
      data: result
    });
  }

  static async getAnalysisSummary(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const user = LeadsController.getUser(request);
    const summary = await LeadsService.getAnalysisSummary(user, id);
    if (!summary) {
      return reply.status(404).send({
        success: false,
        error: 'Not Found',
        message: 'No AI analysis report found for this lead. Run report fetch first.'
      });
    }

    return reply.status(200).send({
      success: true,
      data: summary
    });
  }

  static async recommendPackage(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const body = recommendPackageBodySchema.parse(request.body || {});
    const user = LeadsController.getUser(request);
    const result = await LeadsService.recommendPackage(
      user,
      id,
      body.packageCode,
      body.notes
    );
    return reply.status(200).send({
      success: true,
      message: 'Package recommendation assigned',
      data: result
    });
  }

  static async initiatePayment(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const body = initiatePaymentBodySchema.parse(request.body || {});
    const user = LeadsController.getUser(request);
    const result = await LeadsService.initiatePayment(user, id, body.gateway);
    return reply.status(200).send({
      success: true,
      message: 'Payment order generated successfully',
      data: result
    });
  }

  static async addActivityLog(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const body = createActivityLogBodySchema.parse(request.body);
    const user = LeadsController.getUser(request);
    const result = await LeadsService.addActivityLog(
      user,
      id,
      body.actionType,
      body.noteContent,
      body.scheduledFollowup
    );
    return reply.status(201).send({
      success: true,
      message: 'Note/activity logged',
      data: result
    });
  }

  static async getConversations(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const conversations = await LeadsService.getConversations(id);
    return reply.status(200).send({
      success: true,
      data: conversations
    });
  }

  static async logCommunication(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const body = logCommunicationBodySchema.parse(request.body);
    const user = LeadsController.getUser(request);
    const result = await LeadsService.logCommunication(user, id, body);
    return reply.status(201).send({
      success: true,
      message: 'Communication recorded',
      data: result
    });
  }

  static async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const { id } = leadIdParamSchema.parse(request.params);
    const body = updateLeadStatusBodySchema.parse(request.body);
    const user = LeadsController.getUser(request);
    const result = await LeadsService.updateLeadStatus(
      user,
      id,
      body.status,
      body.lostReason
    );
    return reply.status(200).send({
      success: true,
      message: `Status updated to ${body.status}`,
      data: result
    });
  }
}
