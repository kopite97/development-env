import { useRef, useState } from 'react';
import { Flag } from 'lucide-react';
import { Button, EmptyState, Field } from '../../shared/ui/controls';
import type { Scope } from '../projects/scope';
import type { Project } from '../projects/model';
import { useMilestones } from './MilestonesProvider';
import { MilestoneEditor } from './MilestoneEditor';
import { sortMilestones, todayDate, type Milestone } from './model';

export function MilestoneList({
  scope,
  projects,
  limit,
  projectId,
}: {
  scope: Scope;
  projects: Project[];
  limit?: number;
  projectId?: string;
}) {
  const { milestones, upsert, error } = useMilestones();
  const [editor, setEditor] = useState<Milestone | 'new' | null>(null);
  const [status, setStatus] = useState('open');
  const statusRef = useRef<HTMLSelectElement>(null);
  const eligible = projects.filter(
    (p) => (!projectId || p.id === projectId) && (scope === 'all' || p.scope === scope),
  );
  const selected = sortMilestones(
    milestones.filter(
      (m) =>
        eligible.some((p) => p.id === m.projectId) &&
        (status === 'all' || m.completed === (status === 'done')),
    ),
  );
  const visible = selected.slice(0, limit);
  return (
    <div className="milestones">
      <div className="feature-actions">
        <Button onClick={() => setEditor('new')} disabled={!eligible.length}>
          마일스톤 추가
        </Button>
      </div>
      <Field label="마일스톤 상태 필터">
        <select ref={statusRef} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="open">진행 중</option>
          <option value="done">완료</option>
          <option value="all">전체</option>
        </select>
      </Field>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {!visible.length && <EmptyState title="표시할 마일스톤이 없어요" />}
      {visible.map((m) => (
        <div className="milestone" key={m.id}>
          <span className="milestone-icon">
            <Flag size={16} />
          </span>
          <div className="milestone-content">
            <button
              className="milestone-title"
              aria-label={`${m.title} 수정`}
              onClick={() => setEditor(m)}
            >
              <small>{eligible.find((p) => p.id === m.projectId)?.name}</small>
              <strong>{m.title}</strong>
            </button>
            <span className="muted">
              {m.completed ? '완료' : '진행 중'} · {m.dueDate || '기한 없음'}
              {!m.completed && m.dueDate && m.dueDate < todayDate() ? ' · 기한 지남' : ''}
            </span>
            <Button
              aria-label={`${m.title} ${m.completed ? '재개' : '완료'}`}
              onClick={() => {
                if (upsert({ ...m, completed: !m.completed }) && status !== 'all')
                  statusRef.current?.focus();
              }}
            >
              {m.completed ? '재개' : '완료'}
            </Button>
          </div>
        </div>
      ))}
      {limit && selected.length > limit && (
        <p className="muted">
          {selected.length}개 중 {visible.length}개 표시
        </p>
      )}
      {editor && (
        <MilestoneEditor
          existing={editor === 'new' ? undefined : editor}
          projectId={projectId ?? (eligible.length === 1 ? eligible[0].id : '')}
          projects={eligible}
          onSave={upsert}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}
