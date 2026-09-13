import { useState, useRef } from 'react';
import type { ApiProject } from './apiModel';
import type { ProjectStore } from './apiStore';
import type { DraftMemory } from './draftMemory';
import { ApiProjectEditor } from './ApiProjectEditor';
import { CancelledError, HttpError } from '../../shared/http/client';
export function ProjectActions({
  store,
  project,
  verified,
  memory,
  onSaved,
}: {
  store: ProjectStore;
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
          ? 'Archive this Project? Related resources remain preserved.'
          : 'Restore this Project to active?',
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
      onSaved(saved);
      setNotice('Project status saved.');
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
      {notice && <p role="alert">{notice}</p>}
      {editing ? (
        <ApiProjectEditor
          store={store}
          memory={memory}
          project={project}
          onClose={() => setEditing(false)}
          onSaved={(saved) => {
            setEditing(false);
            setNotice('Project saved.');
            onSaved(saved);
          }}
        />
      ) : (
        <div className="project-toolbar">
          <button disabled={!verified || busy} onClick={() => setEditing(true)}>
            Edit Project
          </button>
          <button disabled={!verified || busy} onClick={() => void handleArchive()}>
            {busy
              ? 'Saving status…'
              : project.status === 'active'
                ? 'Archive Project'
                : 'Unarchive Project'}
          </button>
        </div>
      )}
    </>
  );
}
