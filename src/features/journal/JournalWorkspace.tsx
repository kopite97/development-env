import { ArrowUpRight, BookOpen, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Scope } from '../projects/scope';
import type { DetailHandler } from '../../shared/types/ui';
import { PageScaffold, type PageScaffoldProps } from '../../shared/ui/PageScaffold';
import { Button, EmptyState, Field, Modal } from '../../shared/ui/controls';
import { JournalEditor } from './JournalEditor';
import { useJournals } from './JournalsProvider';
import { journalDate, selectJournals, type JournalEntry } from './model';
import { useProjects } from '../projects/ProjectsProvider';

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
  const [editing, setEditing] = useState<JournalEntry>();
  const [deleting, setDeleting] = useState<JournalEntry>();
  const [projectId, setProjectId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [order, setOrder] = useState('newest');
  const { projects } = useProjects();
  const { journals, add, update, remove, error } = useJournals();
  const reset = () => {
    resetSearch();
    setProjectId('');
    setFrom('');
    setTo('');
    setOrder('newest');
  };
  const hasFilters = !!(query || filter !== 'all' || projectId || from || to);
  const visible = selectJournals(journals, { scope: filter, query, projectId, from, to, order });
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
        <div className="form-grid">
          <Field label="일지 프로젝트 필터">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">전체 프로젝트</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.archived ? ' (보관)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="시작일">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="종료일">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="일지 정렬">
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="newest">최신순</option>
              <option value="oldest">과거순</option>
            </select>
          </Field>
        </div>
        {from && to && from > to && <p role="alert">종료일은 시작일 이후로 선택해 주세요.</p>}
        {hasFilters && <Button onClick={reset}>일지 필터 초기화</Button>}
        {query && <p role="status">검색 결과 {visible.length}개</p>}
        {!visible.length && (
          <EmptyState
            title={hasFilters ? '검색 조건에 맞는 개발일지가 없어요' : '개발일지가 없어요'}
            onReset={hasFilters ? reset : undefined}
          >
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              일지 작성
            </Button>
          </EmptyState>
        )}
        {visible.map((j) => (
          <div key={j.id}>
            <button className="document-row" onClick={() => onDetail(j.title, j.body)}>
              <BookOpen size={20} />
              <span>
                <strong>{j.title}</strong>
                <small>
                  {j.project} · {journalDate(j)}
                </small>
              </span>
              <ArrowUpRight size={17} />
            </button>
            <div className="feature-actions">
              <Button
                aria-label={`${j.title} 수정`}
                onClick={() => {
                  setEditing(j);
                  setOpen(true);
                }}
              >
                수정
              </Button>
              <Button aria-label={`${j.title} 삭제`} onClick={() => setDeleting(j)}>
                삭제
              </Button>
            </div>
          </div>
        ))}
      </div>
      {open && (
        <JournalEditor
          existing={editing}
          onClose={() => {
            setOpen(false);
            setEditing(undefined);
          }}
          onSave={(entry) => {
            const success = editing ? update(entry) : add(entry);
            if (success) {
              setFilter('all');
              setQuery('');
              setProjectId('');
              setFrom('');
              setTo('');
              setOrder('newest');
              setToast('개발일지를 저장했습니다.');
            }
            return success;
          }}
        />
      )}
      {deleting && (
        <Modal title="개발일지를 삭제할까요?" onClose={() => setDeleting(undefined)}>
          <p>{deleting.title} — 삭제하면 복구할 수 없습니다.</p>
          {error && <p role="alert">{error}</p>}
          <div className="modal-actions">
            <Button onClick={() => setDeleting(undefined)}>취소</Button>
            <Button
              onClick={() => {
                if (remove(deleting.id)) {
                  setDeleting(undefined);
                  setToast('개발일지를 삭제했습니다.');
                }
              }}
            >
              삭제 확인
            </Button>
          </div>
        </Modal>
      )}
    </PageScaffold>
  );
}
