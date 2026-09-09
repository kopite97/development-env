import { useState } from 'react';
import { Button, Field, Modal } from '../../components/ui';
import { useProjects } from '../projects/ProjectsProvider';
import { ProjectSelect } from '../projects/ProjectSelect';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges';
import type { JournalEntry } from './model';

export function JournalEditor({
  onSave,
  onClose,
}: {
  onSave: (entry: JournalEntry) => boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const canDiscard = useUnsavedChanges(!!(title || projectId || body));
  const close = () => {
    if (canDiscard()) onClose();
  };
  return (
    <Modal title="개발일지 작성" onClose={close} wide>
      <p className="modal-intro">오늘의 변경과 다음 작업을 기록하세요. 이 브라우저에 저장됩니다.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const project = projects.find((p) => p.id === projectId);
          if (!title.trim() || !body.trim() || !project) {
            setError('제목, 프로젝트, 본문을 입력해 주세요.');
            return;
          }
          if (
            onSave({
              id: crypto.randomUUID(),
              title: title.trim(),
              body: body.trim(),
              projectId,
              project: project.name,
              scope: project.scope,
              createdAt: new Date().toISOString(),
            })
          )
            onClose();
          else
            setError(
              '저장하지 못했습니다. 입력 내용은 유지됩니다. 저장 공간을 확인하고 다시 저장해 주세요.',
            );
        }}
      >
        <div className="journal-form">
          <Field label="일지 제목">
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </Field>
          <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
          <Field label="본문">
            <textarea
              required
              maxLength={20000}
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="어떤 작업을 했나요? 다음에 할 일도 남겨 보세요."
            />
          </Field>
        </div>
        {error && (
          <p className="notice" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <Button type="button" onClick={close}>
            취소
          </Button>
          <Button variant="primary" type="submit">
            일지 저장
          </Button>
        </div>
      </form>
    </Modal>
  );
}
