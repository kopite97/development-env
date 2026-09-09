import { Flag } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '../../components/ui';
import { type Scope, type Task } from '../../data/demo';
export function TaskBoard({
  scope,
  tasks,
  onTaskChange,
  onEdit,
}: {
  scope: Scope;
  tasks: Task[];
  onTaskChange: (id: string, status: Task['status']) => void;
  onEdit?: (task: Task) => void;
}) {
  const [dragged, setDragged] = useState<string | null>(null);
  const [target, setTarget] = useState<Task['status'] | null>(null);
  const filtered = tasks.filter((t) => scope === 'all' || t.scope === scope);
  return (
    <div className="kanban">
      {(['todo', 'doing', 'done'] as const).map((status, i) => (
        <div
          className={`kanban-column column-${status} ${target === status ? 'drop-target' : ''}`}
          key={status}
          onDragOver={(event) => {
            if (!dragged || !event.dataTransfer.types.includes('application/x-devspace-task'))
              return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = 'move';
            setTarget(status);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTarget(null);
          }}
          onDrop={(event) => {
            if (!dragged) return;
            event.preventDefault();
            event.stopPropagation();
            const task = filtered.find((t) => t.id === dragged);
            if (task && task.status !== status) onTaskChange(task.id, status);
            setDragged(null);
            setTarget(null);
          }}
        >
          <div className="column-heading">
            <span className="status-dot" />
            {['할 일', '진행 중', '완료'][i]}
            <span className="count">{filtered.filter((t) => t.status === status).length}</span>
          </div>
          {filtered
            .filter((t) => t.status === status)
            .map((t) => (
              <article
                className={`task ${dragged === t.id ? 'task-dragging' : ''}`}
                key={t.id}
                draggable
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.setData('application/x-devspace-task', t.id);
                  event.dataTransfer.effectAllowed = 'move';
                  setDragged(t.id);
                }}
                onDragEnd={(event) => {
                  event.stopPropagation();
                  setDragged(null);
                  setTarget(null);
                }}
              >
                <small>{t.project}</small>
                <h4>
                  {onEdit ? (
                    <button className="task-title" onClick={() => onEdit(t)}>
                      {t.title}
                    </button>
                  ) : (
                    t.title
                  )}
                </h4>
                <div className="task-meta">
                  <Badge tone={t.tag === '버그' ? 'amber' : t.tag === '개선' ? 'blue' : 'neutral'}>
                    {t.tag}
                  </Badge>
                  {t.priority === '높음' && (
                    <span className="priority">
                      <Flag size={11} />
                      높음
                    </span>
                  )}
                </div>
                <label className="task-status">
                  <span className="sr-only">{t.title} 상태</span>
                  <select
                    value={t.status}
                    onChange={(e) => onTaskChange(t.id, e.target.value as Task['status'])}
                  >
                    <option value="todo">○ 할 일</option>
                    <option value="doing">◔ 진행 중</option>
                    <option value="done">✓ 완료</option>
                  </select>
                </label>
              </article>
            ))}
          {!filtered.some((t) => t.status === status) && (
            <p className="column-empty">아직 작업이 없어요</p>
          )}
        </div>
      ))}
    </div>
  );
}
