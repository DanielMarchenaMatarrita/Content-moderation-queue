import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';
import { Prisma } from '../../../generated/prisma/client.js';

export type IdempotentExecutionResult = 'processed' | 'duplicate';
export type TransactionClient = Prisma.TransactionClient;

class DuplicateProcessedMessageError extends Error {}

@Injectable()
export class IdempotentMessageExecutorService {
  constructor(private readonly prisma: PrismaService) {}

  async executeOnce(
    eventId: string,
    consumerName: string,
    callback: (transaction: TransactionClient) => Promise<void>,
  ): Promise<IdempotentExecutionResult> {
    try {
      await this.prisma.$transaction(async (transaction) => {
        try {
          await transaction.processedMessage.create({
            data: { eventId, consumerName },
          });
        } catch (error) {
          if (this.isProcessedMessageDuplicate(error)) {
            throw new DuplicateProcessedMessageError();
          }

          throw error;
        }

        await callback(transaction);
      });

      return 'processed';
    } catch (error) {
      if (error instanceof DuplicateProcessedMessageError) {
        return 'duplicate';
      }

      throw error;
    }
  }

  private isProcessedMessageDuplicate(error: unknown): boolean {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2002'
    ) {
      return false;
    }

    const target = error.meta?.target;
    let fields: string[] = [];
    if (Array.isArray(target)) {
      fields = target.filter(
        (field): field is string => typeof field === 'string',
      );
    } else if (typeof target === 'string') {
      fields = [target];
    }

    return (
      fields.some((field) => field.includes('eventId')) &&
      fields.some((field) => field.includes('consumerName'))
    );
  }
}
