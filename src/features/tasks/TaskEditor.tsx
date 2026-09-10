import { useState } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { type Task } from './model';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import type { Project } from '../projects/model';
import { ProjectSelect } from '../projects/ProjectSelect';
export function TaskEditor({
  existing,
  projects,
  onSave,
  onDelete,
  onClose,
}: {
  existing?: Task;
  projects: Project[];
  onSave: (task: Task) => boolean;
  onDelete: (id: string) => boolean;
  onClose: () => void;
}) {
  const initial = {
    title: existing?.title ?? '',
    projectId: existing?.projectId ?? '',
    description: existing?.description ?? '',
    status: existing?.status ?? 'todo',
    priority: existing?.priority ?? '보통',
    tag: existing?.tag ?? '',
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const canDiscard = useUnsavedChanges(JSON.stringify(form) !== JSON.stringify(initial));
  const close = () => {
    if (canDiscard()) onClose();
  };
  const change = <K extends keyof typeof initial>(key: K, value: (typeof initial)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <Modal title={existing ? '태스크 편집' : '태스크 추가'} onClose={close} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const project = projects.find((p) => p.id === form.projectId);
          if (!project || !form.title.trim()) {
            setError('제목과 프로젝트를 입력해 주세요.');
            return;
          }
          if (
            onSave({
              ...form,
              id: existing?.id ?? crypto.randomUUID(),
              title: form.title.trim(),
              tag: form.tag.trim(),
              project: project.name,
              scope: project.scope,
              deletedAt: null,
            })
          )
            onClose();
          else setError('저장하지 못했습니다. 입력 내용을 유지했습니다. 다시 저장해 주세요.');
        }}
      >
        <div className="form-grid">
          <Field label="태스크 제목">
            <input
              required
              maxLength={160}
              value={form.title}
              onChange={(e) => change('title', e.target.value)}
              autoFocus
            />
          </Field>
          <ProjectSelect
            projects={projects}
            value={form.projectId}
            onChange={(id) => change('projectId', id)}
          />
          <Field label="상태">
            <select
              value={form.status}
              onChange={(e) => change('status', e.target.value as Task['status'])}
            >
              <option value="todo">할 일</option>
              <option value="doing">진행 중</option>
              <option value="done">완료</option>
            </select>
          </Field>
          <Field label="우선순위">
            <select
              value={form.priority}
              onChange={(e) => change('priority', e.target.value as Task['priority'])}
            >
              <option value="보통">보통</option>
              <option value="높음">높음</option>
            </select>
          </Field>
          <Field label="태그">
            <input
              maxLength={40}
              value={form.tag}
              onChange={(e) => change('tag', e.target.value)}
            />
          </Field>
          <Field label="상세 내용">
            <textarea
              rows={5}
              maxLength={10000}
              value={form.description}
              onChange={(e) => change('description', e.target.value)}
            />
          </Field>
        </div>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {existing && (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                if (!window.confirm('태스크를 삭제할까요? 휴지통에서 복구할 수 있습니다.')) return;
                if (onDelete(existing.id)) onClose();
                else setError('삭제하지 못했습니다. 다시 시도해 주세요.');
              }}
            >
              태스크 삭제
            </Button>
          )}
          <Button type="button" onClick={close}>
            취소
          </Button>
          <Button variant="primary" type="submit">
            태스크 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
