import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { PAYMENT_ORDER_CREATED_CONSUMER_CONFIG } from './payment-order-created.constants.js';

export type PaymentOrderExecution = 'processed' | 'duplicate' | 'failed';

@Injectable()
export class PaymentOrderProcessorService {
  constructor(private readonly prisma: PrismaService) {}

  async process(
    eventId: string,
    orderId: string,
    retryCount: number,
  ): Promise<PaymentOrderExecution> {
    const alreadyProcessed = await this.prisma.processedMessage.findUnique({
      where: {
        eventId_consumerName: {
          eventId,
          consumerName: PAYMENT_ORDER_CREATED_CONSUMER_CONFIG.consumerName,
        },
      },
      select: { id: true },
    });
    if (alreadyProcessed) return 'duplicate';
    const order = await this.prisma.paymentOrder.findUnique({
      where: { id: orderId },
      select: { simulationScenario: true, reprocessScenario: true, retryCount: true },
    });
    if (!order) throw new Error(`PaymentOrder ${orderId} not found`);
    const isRecoveryCycle = order.reprocessScenario !== null;
    if (isRecoveryCycle && order.retryCount !== retryCount) return 'duplicate';
    const scenario = order.reprocessScenario ?? order.simulationScenario;
    const latestAttempt = isRecoveryCycle
      ? await this.prisma.processingAttempt.findFirst({
          where: { orderId },
          orderBy: { attemptNumber: 'desc' },
          select: { attemptNumber: true },
        })
      : null;
    const attemptNumber = isRecoveryCycle
      ? (latestAttempt?.attemptNumber ?? 0) - order.retryCount + retryCount + 1
      : retryCount + 1;
    const error = deterministicError(scenario, retryCount);
    if (error) {
      try {
        await this.prisma.$transaction(async (tx) => {
          if (isRecoveryCycle)
            await tx.processingAttempt.create({
              data: { orderId, attemptNumber, status: 'ERROR', errorDescription: error },
            });
          else
            await tx.processingAttempt.upsert({
              where: { orderId_attemptNumber: { orderId, attemptNumber } },
              create: { orderId, attemptNumber, status: 'ERROR', errorDescription: error },
              update: { status: 'ERROR', errorDescription: error },
            });
          await tx.paymentOrder.update({
            where: { id: orderId },
            data: {
              retryCount: retryCount >= 3 ? 3 : retryCount + 1,
              status: retryCount >= 3 ? 'FAILED' : 'PENDING',
              lastError: error,
            },
          });
        });
      } catch (error) {
        if (isRecoveryCycle && isProcessingAttemptDuplicate(error))
          return 'duplicate';
        throw error;
      }
      return 'failed';
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.processedMessage.create({
          data: {
            eventId,
            consumerName: PAYMENT_ORDER_CREATED_CONSUMER_CONFIG.consumerName,
          },
        });
        if (isRecoveryCycle)
          await tx.processingAttempt.create({
            data: { orderId, attemptNumber, status: 'SUCCESS', errorDescription: null },
          });
        else
          await tx.processingAttempt.upsert({
            where: { orderId_attemptNumber: { orderId, attemptNumber } },
            create: { orderId, attemptNumber, status: 'SUCCESS', errorDescription: null },
            update: { status: 'SUCCESS', errorDescription: null },
          });
        await tx.paymentOrder.update({
          where: { id: orderId },
          data: { status: 'SUCCESS', retryCount, lastError: null },
        });
      });
      return 'processed';
    } catch (error) {
      if (isProcessedMessageDuplicate(error)) return 'duplicate';
      throw error;
    }
  }
}

function deterministicError(
  scenario: string,
  retryCount: number,
): string | undefined {
  if (
    scenario === 'ALWAYS_FAIL' ||
    (scenario === 'FAIL_ONCE' && retryCount === 0) ||
    (scenario === 'FAIL_TWICE' && retryCount < 2)
  )
    return `Deterministic payment processing failure (${scenario}, retry ${retryCount})`;
  return undefined;
}

function isProcessedMessageDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002' &&
    'meta' in error &&
    String((error.meta as { target?: unknown } | undefined)?.target).includes(
      'eventId',
    )
  );
}

function isProcessingAttemptDuplicate(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002' &&
    'meta' in error &&
    String((error.meta as { target?: unknown } | undefined)?.target).includes(
      'attemptNumber',
    )
  );
}
