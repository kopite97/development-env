import { ChevronRight } from 'lucide-react';
import { type Scope } from '../../data/demo';
import type { DetailHandler } from '../../types/ui';
import { journalDate, type JournalEntry } from './model';
export function RecentJournals({
  scope,
  onDetail,
  journals,
}: {
  scope: Scope;
  journals: JournalEntry[];
  onDetail: DetailHandler;
}) {
  return (
    <div className="journal-list">
      {journals
        .filter((j) => scope === 'all' || j.scope === scope)
        .slice(0, 3)
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
