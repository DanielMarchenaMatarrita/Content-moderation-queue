import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { queryClient } from '../query-client';
import { ActivityProvider } from './ActivityProvider';
import { ToastProvider } from './ToastProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={350}>
        <ActivityProvider>
          <ToastProvider>{children}</ToastProvider>
        </ActivityProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
