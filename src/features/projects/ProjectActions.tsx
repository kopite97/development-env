import { useState, useRef } from 'react';
import type { ApiProject } from './apiModel';
import type { ProjectStore } from './apiStore';
import type { DraftMemory } from './draftMemory';
import { ApiProjectEditor } from './ApiProjectEditor';
import { CancelledError, HttpError } from '../../shared/http/client';
import { Pencil } from 'lucide-react';
import { Button } from '../../shared/ui/controls';
import type { CategoryStore } from './categoryStore';
export function ProjectActions({
  store,
  categories,
  project,
  verified,
  memory,
  onSaved,
}: {
  store: ProjectStore;
  categories: CategoryStore;
  project: ApiProject;
  verified: boolean;
  memory: DraftMemory;
  onSaved: (project: ApiProject) => void;
}) {
  const [editing, setEditing] = useState(memory.editor?.target === project.id),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const pending = useRef(false);
  const handleArchive = async () => {
    if (
      pending.current ||
      !verified ||
      !window.confirm(
        project.status === 'active'
          ? '프로젝트를 보관할까요? 연결된 작업과 일지는 유지됩니다.'
          : '프로젝트를 보관 해제할까요?',
      )
    )
      return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      const saved = await store.mutate(project.id, {
        revision: project.revision,
        status: project.status === 'active' ? 'archived' : 'active',
      });
      store.transport.lifecycle.assert(store.transport.generation);
      memory.editor = undefined;
      setEditing(false);
      onSaved(saved);
      setNotice('프로젝트 보관 상태를 저장했습니다.');
    } catch (error) {
      if (
        store.transport.generation !== store.transport.lifecycle.generation ||
        error instanceof CancelledError
      )
        return;
      if (error instanceof HttpError && error.code === 'CSRF_INVALID') {
        try {
          await store.transport.recoverSecurity();
        } catch (failure) {
          setNotice(failure instanceof Error ? failure.message : 'Security recovery failed.');
        }
      } else {
        setNotice(
          'Status change was not confirmed. Review the refreshed Project before explicitly trying again.',
        );
        store.invalidate();
      }
    } finally {
      pending.current = false;
      if (store.transport.generation === store.transport.lifecycle.generation) setBusy(false);
    }
  };
  return (
    <>
      {!editing && notice && <p role="alert">{notice}</p>}
      <Button disabled={!verified || busy} onClick={() => setEditing(true)}>
        <Pencil size={16} />
        프로젝트 편집
      </Button>
      {editing && (
        <ApiProjectEditor
          categories={categories}
          store={store}
          memory={memory}
          project={project}
          onArchive={verified ? () => void handleArchive() : undefined}
          isArchiving={busy}
          feedback={notice}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setNotice('프로젝트를 저장했습니다.');
            onSaved(saved);
          }}
        />
      )}
    </>
  );
}
