import type { Query } from '../../shared/http/query';
import type { MilestoneProjectOption } from './apiModel';
export type MilestoneProjectOptionsPage = {
  items: MilestoneProjectOption[];
  nextCursor: string | null;
};
export type MilestoneProjectOptions = {
  list: Query<MilestoneProjectOptionsPage>;
  more: () => Promise<void>;
  detail: (id: string) => Query<MilestoneProjectOption>;
  invalidate: () => void;
  dispose: () => void;
};
