import { createTRPCClient, httpBatchLink, loggerLink } from '@trpc/client';
import type { AppRouter } from '../../../server/src';
import superjson from 'superjson';

// Create authenticated tRPC client
export function createAuthenticatedTrpc(token: string) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({ 
        url: '/api', 
        transformer: superjson,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }),
      loggerLink({
        enabled: (opts) =>
          (typeof window !== 'undefined') ||
          (opts.direction === 'down' && opts.result instanceof Error),
      }),
    ],
  });
}