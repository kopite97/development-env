import type { Query } from '../../shared/http/query';
export type DashboardProjectOption = {
  id: string;
  name: string;
  scope: 'unity' | 'server';
  archived: boolean;
};
export type DashboardProjectOptions = {
  list: Query<{ items: DashboardProjectOption[]; nextCursor: string | null }>;
  more: () => Promise<void>;
  detail: (id: string) => Query<DashboardProjectOption>;
  invalidate: () => void;
  dispose: () => void;
};
