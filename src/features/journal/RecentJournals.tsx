import { ChevronRight } from 'lucide-react';
import { type Scope } from '../projects/scope';
import type { DetailHandler } from '../../shared/types/ui';
import { journalDate, type JournalEntry } from './model';
export function RecentJournals({
  scope,
  onDetail,
  journals,
  limit = 3,
}: {
  scope: Scope;
  journals: JournalEntry[];
  onDetail: DetailHandler;
  limit?: number;
}) {
  return (
    <div className="journal-list">
      {journals
        .filter((j) => scope === 'all' || j.scope === scope)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        .slice(0, limit)
        .map((j) => (
          <button key={j.id} className="journal-row" onClick={() => onDetail(j.title, j.body)}>
            <span className="journal-date">{journalDate(j)}</span>
            <span>
              <strong>{j.title}</strong>
              <small>{j.project}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
    </div>
  );
}
