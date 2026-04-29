import type { NormalizedError } from '@we-build/domain';

import type { Logger } from './logger.js';
import type { AdapterOperationResult } from './vendors/contract.js';

export type VendorExecutionConfig = {
  timeoutMs: number;
  retryCount: number;
};

type OperationContext = {
  sessionId: string;
  vendorId: string;
  operationName: string;
};

function createTimeoutError(timeoutMs: number): NormalizedError {
  return {
    code: 'VENDOR_OPERATION_TIMEOUT',
    message: `Vendor operation exceeded ${timeoutMs}ms timeout.`,
    retryable: true,
    source: 'vendor-adapter',
  };
}

function createUnexpectedError(error: unknown): NormalizedError {
  return {
    code: 'VENDOR_OPERATION_EXCEPTION',
    message: error instanceof Error ? error.message : 'Unknown vendor operation exception.',
    retryable: true,
    source: 'vendor-adapter',
  };
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => reject(createTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function executeVendorOperation<T>(
  operation: () => Promise<AdapterOperationResult<T>>,
  context: OperationContext,
  config: VendorExecutionConfig,
  logger: Logger,
): Promise<AdapterOperationResult<T>> {
  const maxAttempts = Math.max(1, config.retryCount + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    logger.info('vendor.operation.started', {
      ...context,
      attempt,
      maxAttempts,
      timeoutMs: config.timeoutMs,
    });

    try {
      const result = await withTimeout(operation(), config.timeoutMs);

      logger.info('vendor.operation.completed', {
        ...context,
        attempt,
        status: result.status,
        retryable: result.error?.retryable ?? false,
      });

      if (result.status !== 'failed' || !result.error?.retryable || attempt === maxAttempts) {
        return result;
      }

      logger.warn('vendor.operation.retrying', {
        ...context,
        attempt,
        reason: result.error.message,
      });
    } catch (error) {
      const normalizedError = typeof error === 'object' && error !== null && 'code' in error
        ? (error as NormalizedError)
        : createUnexpectedError(error);

      logger.warn('vendor.operation.exception', {
        ...context,
        attempt,
        code: normalizedError.code,
        message: normalizedError.message,
      });

      if (attempt === maxAttempts) {
        return {
          status: 'failed',
          error: normalizedError,
          message: normalizedError.message,
        };
      }
    }
  }

  return {
    status: 'failed',
    error: createUnexpectedError('Vendor operation exhausted without result.'),
    message: 'Vendor operation exhausted without result.',
  };
}