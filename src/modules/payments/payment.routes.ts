import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ConversionService } from '../conversion/conversion.service';

const mockPaymentBodySchema = z.object({
  gatewayOrderId: z.string(),
  gatewayPaymentId: z.string().optional()
});

const webhookSchema = z.object({
  event: z.string().default('payment.captured'),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        amount: z.number().optional(),
        status: z.string().optional()
      })
    })
  })
});

export async function paymentRoutes(fastify: FastifyInstance) {
  // 1. Mock Payment Success Handler (Production Mock System)
  fastify.post('/payments/mock-success', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { gatewayOrderId, gatewayPaymentId } = mockPaymentBodySchema.parse(request.body);
      const paymentId = gatewayPaymentId || `mock_pay_${Date.now()}`;

      const result = await ConversionService.handleSuccessfulPayment({
        gatewayOrderId,
        gatewayPaymentId: paymentId,
        gatewaySignature: 'mock_sig_valid_digital_katta',
        metadata: {
          mode: 'MOCK_PAYMENT',
          timestamp: new Date().toISOString()
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'Mock payment verified successfully. Lead converted to active Case.',
        data: result
      });
    } catch (err: any) {
      return reply.status(400).send({
        success: false,
        error: 'Mock Payment Error',
        message: err.message
      });
    }
  });

  // Alias for backward compatibility
  fastify.post('/payments/confirm-mock', async (request: FastifyRequest, reply: FastifyReply) => {
    const { gatewayOrderId, gatewayPaymentId } = mockPaymentBodySchema.parse(request.body);
    const result = await ConversionService.handleSuccessfulPayment({
      gatewayOrderId,
      gatewayPaymentId: gatewayPaymentId || `mock_pay_${Date.now()}`,
      gatewaySignature: 'mock_sig_valid_digital_katta'
    });

    return reply.status(200).send({
      success: true,
      message: 'Payment confirmed and case generated',
      data: result
    });
  });

  // 2. Real Webhook for Razorpay / Cashfree (When ready to plug in production keys)
  fastify.post('/webhooks/payments/razorpay', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const parsed = webhookSchema.parse(request.body);
      const entity = parsed.payload.payment.entity;

      const conversionResult = await ConversionService.handleSuccessfulPayment({
        gatewayOrderId: entity.order_id,
        gatewayPaymentId: entity.id,
        gatewaySignature: (request.headers['x-razorpay-signature'] as string) || 'sig_verified',
        metadata: {
          event: parsed.event,
          capturedAt: new Date().toISOString()
        }
      });

      return reply.status(200).send({
        success: true,
        message: 'Payment verified and lead converted to case',
        data: conversionResult
      });
    } catch (err: any) {
      request.log.error(err, 'Webhook processing error');
      return reply.status(400).send({
        success: false,
        error: 'Webhook Processing Error',
        message: err.message
      });
    }
  });
}
