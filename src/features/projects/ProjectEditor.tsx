import { useState } from 'react';
import { Button, Modal } from '../../shared/ui/controls';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { ProjectFields } from './ProjectFields';
import type { Project } from './model';
export function ProjectEditor({
  existing,
  onSave,
  onClose,
  onArchive,
}: {
  existing?: Project;
  onSave: (project: Project) => boolean;
  onClose: () => void;
  onArchive?: (id: string, archived: boolean) => boolean;
}) {
  const initial: Project = existing ?? {
    id: '',
    name: '',
    subtitle: '',
    scope: 'unity',
    stack: '',
    progress: 0,
    color: 'forest',
    milestone: '',
    repositoryUrl: '',
    archived: false,
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const canDiscard = useUnsavedChanges(JSON.stringify(form) !== JSON.stringify(initial));
  const close = () => {
    if (canDiscard()) onClose();
  };
  return (
    <Modal title={existing ? '프로젝트 편집' : '프로젝트 추가'} onClose={close} wide>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.name.trim() || !form.stack.trim()) {
            setError('프로젝트 이름과 기술 스택을 입력해 주세요.');
            return;
          }
          if (form.repositoryUrl.trim()) {
            try {
              const url = new URL(form.repositoryUrl.trim());
              if (!['https:', 'http:'].includes(url.protocol)) throw Error();
            } catch {
              setError('저장소 주소는 http 또는 https URL을 입력해 주세요.');
              return;
            }
          }
          if (
            onSave({
              ...form,
              id: existing?.id ?? crypto.randomUUID(),
              name: form.name.trim(),
              stack: form.stack.trim(),
              repositoryUrl: form.repositoryUrl.trim(),
              color: form.scope === 'unity' ? 'forest' : 'api',
            })
          )
            onClose();
          else setError('저장하지 못했습니다. 입력 내용을 유지했습니다. 다시 저장해 주세요.');
        }}
      >
        <ProjectFields
          form={form}
          onChange={(key, value) => setForm((current) => ({ ...current, [key]: value }))}
        />
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          {existing && onArchive && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (
                  !window.confirm(
                    existing.archived
                      ? '프로젝트를 보관 해제할까요?'
                      : '프로젝트를 보관할까요? 연결된 작업과 일지는 유지됩니다.',
                  )
                )
                  return;
                if (onArchive(existing.id, !existing.archived)) onClose();
                else setError('보관 상태를 저장하지 못했습니다. 다시 시도해 주세요.');
              }}
            >
              {existing.archived ? '보관 해제' : '프로젝트 보관'}
            </Button>
          )}
          <Button type="button" onClick={close}>
            취소
          </Button>
          <Button type="submit" variant="primary">
            프로젝트 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
