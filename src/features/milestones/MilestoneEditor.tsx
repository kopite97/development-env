import { useState } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { ProjectSelect } from '../projects/ProjectSelect';
import type { Project } from '../projects/model';
import { isDueDate, type Milestone } from './model';

export function MilestoneEditor({
  existing,
  projectId = '',
  projects,
  onSave,
  onClose,
}: {
  existing?: Milestone;
  projectId?: string;
  projects: Project[];
  onSave: (item: Milestone) => boolean;
  onClose: () => void;
}) {
  const [initial] = useState<Milestone>(
    () =>
      existing ?? { id: crypto.randomUUID(), projectId, title: '', dueDate: '', completed: false },
  );
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const canDiscard = useUnsavedChanges(JSON.stringify(form) !== JSON.stringify(initial));
  const close = () => {
    if (canDiscard()) onClose();
  };
  return (
    <Modal title={existing ? '마일스톤 수정' : '마일스톤 추가'} onClose={close}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (
            !form.title.trim() ||
            !projects.some((p) => p.id === form.projectId) ||
            !isDueDate(form.dueDate)
          ) {
            setError('목표 제목, 프로젝트와 올바른 기한을 확인해 주세요.');
            return;
          }
          if (onSave({ ...form, title: form.title.trim() })) onClose();
          else setError('저장하지 못했습니다. 입력 내용은 유지됩니다. 다시 저장해 주세요.');
        }}
      >
        <div className="milestone-form">
          <Field label="목표 제목">
            <input
              autoFocus
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <ProjectSelect
            projects={projects}
            value={form.projectId}
            onChange={(id) => setForm({ ...form, projectId: id })}
          />
          <Field label="목표 기한 (선택)">
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </Field>
          <Field label="목표 상태">
            <select
              value={form.completed ? 'done' : 'open'}
              onChange={(e) => setForm({ ...form, completed: e.target.value === 'done' })}
            >
              <option value="open">진행 중</option>
              <option value="done">완료</option>
            </select>
          </Field>
        </div>
        {error && (
          <p role="alert" className="notice">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" onClick={close}>
            취소
          </Button>
          <Button type="submit" variant="primary">
            마일스톤 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
