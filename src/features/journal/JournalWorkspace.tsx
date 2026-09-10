import { ArrowUpRight, BookOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Scope } from '../projects/scope';
import type { DetailHandler } from '../../shared/types/ui';
import { PageScaffold, type PageScaffoldProps } from '../../shared/ui/PageScaffold';
import { Button, EmptyState } from '../../shared/ui/controls';
import { JournalEditor } from './JournalEditor';
import { useJournals } from './JournalsProvider';
import { journalDate } from './model';

export type JournalWorkspaceProps = {
  scaffold: Omit<PageScaffoldProps, 'children' | 'actions'>;
  filter: Scope;
  query: string;
  onReset: () => void;
  onFilterChange: (scope: Scope) => void;
  onQueryChange: (query: string) => void;
  onDetail: DetailHandler;
  onNotify: (message: string) => void;
};

export function JournalWorkspace({
  scaffold,
  filter,
  query,
  onDetail,
  onFilterChange: setFilter,
  onQueryChange: setQuery,
  onNotify: setToast,
  onReset: resetSearch,
}: JournalWorkspaceProps) {
  const [open, setOpen] = useState(false);
  const { journals, add } = useJournals();
  const visible = journals.filter(
    (j) =>
      (filter === 'all' || j.scope === filter) &&
      `${j.title} ${j.project}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <PageScaffold
      {...scaffold}
      actions={
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={16} />
          일지 작성
        </Button>
      }
    >
      <div className="content-panel">
        {query && <p role="status">검색 결과 {visible.length}개</p>}
        {!visible.length && (
          <EmptyState
            title={
              query || filter !== 'all' ? '검색 조건에 맞는 개발일지가 없어요' : '개발일지가 없어요'
            }
            onReset={query || filter !== 'all' ? resetSearch : undefined}
          >
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              일지 작성
            </Button>
          </EmptyState>
        )}
        {visible.map((j) => (
          <button className="document-row" key={j.id} onClick={() => onDetail(j.title, j.body)}>
            <BookOpen size={20} />
            <span>
              <strong>{j.title}</strong>
              <small>
                {j.project} · {journalDate(j)}
              </small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        ))}
      </div>
      {open && (
        <JournalEditor
          onClose={() => setOpen(false)}
          onSave={(entry) => {
            const success = add(entry);
            if (success) {
              setFilter('all');
              setQuery('');
              setToast('개발일지를 저장했습니다.');
            }
            return success;
          }}
        />
      )}
    </PageScaffold>
  );
}
