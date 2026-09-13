import type { Query } from '../../shared/http/query';
import type { JournalProjectOption } from './apiModel';

export type JournalProjectOptionsPage = {
  items: JournalProjectOption[];
  nextCursor: string | null;
};

export type JournalProjectOptions = {
  list: Query<JournalProjectOptionsPage>;
  more: () => Promise<void>;
  activeList: Query<JournalProjectOptionsPage>;
  moreActive: () => Promise<void>;
  detail: (id: string) => Query<JournalProjectOption>;
  invalidate: () => void;
  dispose: () => void;
};
