import { useState } from 'react';
import { Button, Modal } from '../../shared/ui/controls';
import { type Task } from './model';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import type { Project } from '../projects/model';
import { TaskFields } from './TaskFields';
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
        <TaskFields form={form} change={change} projects={projects} />
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
