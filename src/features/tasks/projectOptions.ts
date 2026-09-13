import type { Query } from '../../shared/http/query';
import type { TaskProjectOption } from './presentation';

/** App composition adapts Projects; Tasks never looks up identity by name. */
export type TaskProjectOptions = {
  list: Query<{ items: TaskProjectOption[]; nextCursor: string | null }>;
  more: () => Promise<void>;
  detail: (id: string) => Query<TaskProjectOption>;
};
