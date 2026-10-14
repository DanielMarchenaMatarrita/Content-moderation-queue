import type { LoggerService } from '@nestjs/common';

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error';

export interface ApplicationLogFields {
  orderId?: string;
  result?: string;
  retryCount?: number;
  event?: string;
  reason?: string;
}

export function logApplicationEvent(
  service: string,
  severity: LogSeverity,
  fields: ApplicationLogFields,
): void {
  process.stdout.write(
    `${JSON.stringify({
      timestamp: new Date().toISOString(),
      severity,
      service,
      ...fields,
    })}\n`,
  );
}

export function createStructuredLogger(service: string): LoggerService {
  const write = (severity: LogSeverity, message: unknown, context?: unknown) => {
    logApplicationEvent(service, severity, {
      event: typeof message === 'string' ? message : 'nest_log',
      reason: typeof context === 'string' ? context : undefined,
    });
  };

  return {
    log: (message, ...optionalParams) => write('info', message, optionalParams[0]),
    error: (message, ...optionalParams) => write('error', message, optionalParams[0]),
    warn: (message, ...optionalParams) => write('warn', message, optionalParams[0]),
    debug: (message, ...optionalParams) => write('debug', message, optionalParams[0]),
    verbose: (message, ...optionalParams) => write('debug', message, optionalParams[0]),
    fatal: (message, ...optionalParams) => write('error', message, optionalParams[0]),
  };
}
