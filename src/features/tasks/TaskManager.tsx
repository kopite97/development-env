import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, EmptyState, Modal } from '../../shared/ui/controls';
import { type Scope } from '../projects/scope';
import { type Task } from './model';
import { useProjects } from '../projects/ProjectsProvider';
import { useTasks } from './TasksProvider';
import { TaskBoard } from './TaskBoard';
import { TaskEditor } from './TaskEditor';
export function TaskManager({
  scope,
  search = '',
  onReset,
  projectId,
  limit,
}: {
  scope: Scope;
  search?: string;
  onReset?: () => void;
  projectId?: string;
  limit?: number;
}) {
  const { tasks, deletedTasks, upsert, remove, restore, changeStatus, error } = useTasks();
  const { projects } = useProjects();
  const [editor, setEditor] = useState<Task | 'new' | null>(null);
  const [trash, setTrash] = useState(false);
  const visible = tasks
    .filter(
      (t) =>
        (scope === 'all' || t.scope === scope) &&
        (!projectId || t.projectId === projectId) &&
        `${t.title} ${t.project}`.toLowerCase().includes(search.toLowerCase()),
    )
    .slice(0, limit);
  const removed = deletedTasks.filter(
    (t) => (scope === 'all' || t.scope === scope) && (!projectId || t.projectId === projectId),
  );
  return (
    <>
      <div className="feature-actions">
        <Button onClick={() => setEditor('new')}>
          <Plus size={14} />
          태스크 추가
        </Button>
        <Button variant="ghost" onClick={() => setTrash(true)}>
          <Trash2 size={14} />
          휴지통 ({removed.length})
        </Button>
      </div>
      {search && <p role="status">검색 결과 {visible.length}개</p>}
      {!visible.length && (
        <EmptyState
          title={search || scope !== 'all' ? '검색 조건에 맞는 태스크가 없어요' : '태스크가 없어요'}
          onReset={search || scope !== 'all' ? onReset : undefined}
        >
          <Button onClick={() => setEditor('new')}>
            <Plus size={16} />
            태스크 추가
          </Button>
        </EmptyState>
      )}
      <TaskBoard scope={scope} tasks={visible} onTaskChange={changeStatus} onEdit={setEditor} />
      {editor && (
        <TaskEditor
          existing={editor === 'new' ? undefined : editor}
          projects={projects}
          onSave={upsert}
          onDelete={remove}
          onClose={() => setEditor(null)}
        />
      )}
      {trash && (
        <Modal title="태스크 휴지통" onClose={() => setTrash(false)}>
          {removed.length ? (
            removed.map((t) => (
              <div className="restore-row" key={t.id}>
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.project}</small>
                </span>
                <Button aria-label={`${t.title} 복구`} onClick={() => restore(t.id)}>
                  복구
                </Button>
              </div>
            ))
          ) : (
            <EmptyState title="휴지통이 비어 있어요" />
          )}
          {error && (
            <p className="notice" role="alert">
              {error}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
