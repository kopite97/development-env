import type { createHttpClient, Lifecycle } from './client';
export type PrivateTransport = {
  request: ReturnType<typeof createHttpClient>;
  lifecycle: Lifecycle;
  generation: number;
  recoverSecurity: () => Promise<void>;
};
