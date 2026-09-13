import { useEffect, useRef, useState } from 'react';
import { CancelledError, HttpError } from '../../shared/http/client';
import {
  patchBody,
  projectDraft,
  validateDraft,
  type ApiProject,
  type ProjectDraft,
} from './apiModel';
import type { ProjectStore } from './apiStore';
import type { DraftMemory, EditorMemory } from './draftMemory';
import { createIntent, retryBody } from './createIntent';

export function ApiProjectEditor({
  store,
  memory,
  project,
  onClose,
  onSaved,
}: {
  store: ProjectStore;
  memory: DraftMemory;
  project?: ApiProject;
  onClose: () => void;
  onSaved: (project: ApiProject) => void;
}) {
  const target = project?.id ?? 'create';
  const [editor, setEditor] = useState<EditorMemory>(() =>
    memory.editor?.target === target
      ? memory.editor
      : { target, draft: projectDraft(project), baseline: project },
  );
  const [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState(editor.notice ?? ''),
    [conflict, setConflict] = useState(false);
  const [latest, setLatest] = useState<ApiProject>(),
    [missing, setMissing] = useState(false);
  const pending = useRef(false),
    alive = useRef(true);
  const current = () =>
    alive.current && store.transport.generation === store.transport.lifecycle.generation;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    memory.editor = editor;
  }, [memory, editor]);
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (memory.editor) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => window.removeEventListener('beforeunload', unload);
  }, [memory]);
  const update = (draft: ProjectDraft) => {
    const next = { ...editor, draft };
    memory.editor = next;
    setEditor(next);
  };
  const reconcile = async () => {
    if (!editor.baseline) return;
    const query = store.detail(editor.baseline.id);
    query.invalidate();
    await query.load();
    if (!current()) return;
    const state = query.getSnapshot();
    if (state.status === 'ready') setLatest(state.data);
    else {
      setNotice('Latest Project could not be loaded. Retry reconciliation before editing.');
      setMissing(state.error instanceof HttpError && state.error.status === 404);
    }
  };
  const handleSubmit = async () => {
    if (pending.current || conflict || missing) return;
    const fields = validateDraft(editor.draft);
    setErrors(fields);
    if (Object.keys(fields).length) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      let body: unknown;
      let intent = editor.intent;
      if (editor.baseline) {
        body = patchBody(editor.baseline, editor.draft);
        if (Object.keys(body as object).length === 1) {
          setNotice('No changes to save.');
          return;
        }
      } else {
        intent ??= createIntent(editor.draft);
        const next = { ...editor, intent };
        memory.editor = next;
        setEditor(next);
        body = retryBody(intent);
      }
      const saved = await store.mutate(editor.baseline?.id, body, intent?.key);
      if (!current()) return;
      memory.editor = undefined;
      onSaved(saved);
    } catch (error) {
      if (!current() || error instanceof CancelledError) return;
      if (error instanceof HttpError) {
        if (error.status === 400 && error.code === 'VALIDATION_ERROR' && !editor.baseline) {
          const next = { ...editor, intent: undefined };
          memory.editor = next;
          setEditor(next);
        }
        setErrors(
          Object.fromEntries(
            Object.entries(error.fieldErrors).map(([key, value]) => [
              key === 'currentMilestone' ? 'milestone' : key,
              value,
            ]),
          ),
        );
        if (error.code === 'CSRF_INVALID') {
          memory.editor = {
            ...memory.editor!,
            notice: 'Session security refreshed. Review and explicitly retry this operation.',
          };
          try {
            await store.transport.recoverSecurity();
          } catch (recoveryError) {
            if (current())
              setNotice(
                recoveryError instanceof Error
                  ? recoveryError.message
                  : 'Session security recovery failed.',
              );
          }
          return;
        }
        if (
          error.code === 'REVISION_CONFLICT' ||
          (editor.baseline &&
            (error.status === 0 || error.status >= 500 || error.code === 'PROTOCOL_ERROR'))
        ) {
          setConflict(true);
          setNotice(
            error.code === 'REVISION_CONFLICT'
              ? 'This Project changed elsewhere. Review the latest version before reapplying your edits.'
              : 'Update was not confirmed. Review the latest version; it may already have completed.',
          );
          await reconcile();
          return;
        }
        if (error.code === 'IDEMPOTENCY_KEY_REUSED') {
          setNotice(
            'This creation key belongs to different data. Review Projects and abandon this intent before an explicitly new creation.',
          );
          return;
        }
        if (error.status === 404) setMissing(true);
        setNotice(
          (editor.baseline
            ? 'Save failed.'
            : 'Creation was not confirmed. Retry uses the same recorded request; do not create a duplicate.') +
            (error.requestId ? ' Request ID: ' + error.requestId : ''),
        );
      } else setNotice(error instanceof Error ? error.message : 'Save failed.');
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const handleReapply = () => {
    if (!latest || !editor.baseline) return;
    const before = projectDraft(editor.baseline),
      draft = projectDraft(latest);
    for (const key of Object.keys(draft) as (keyof ProjectDraft)[])
      if (editor.draft[key] !== before[key]) Object.assign(draft, { [key]: editor.draft[key] });
    const next = { ...editor, baseline: latest, draft };
    memory.editor = next;
    setEditor(next);
    setConflict(false);
    setLatest(undefined);
    setNotice(
      'Latest revision adopted. Review the form and explicitly save your selected changes.',
    );
  };
  const discard = () => {
    if (
      window.confirm(
        editor.intent
          ? 'Creation may already exist. Abandon this intent and review Projects before creating again?'
          : 'Discard this draft?',
      )
    ) {
      memory.editor = undefined;
      onClose();
    }
  };
  return (
    <form
      className="project-editor"
      aria-label={project ? 'Edit Project' : 'Create Project'}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <h4>{project ? 'Edit Project' : 'Create Project'}</h4>
      {!project && (
        <p>
          If you reloaded after an unconfirmed creation, review Projects first: the previous request
          may have completed. Creation recovery is kept only in this session's memory.
        </p>
      )}
      {notice && <p role="alert">{notice}</p>}
      <fieldset disabled={busy || !!editor.intent || conflict || missing}>
        {(['name', 'subtitle', 'stack', 'milestone', 'repositoryUrl'] as const).map((key) => (
          <label key={key}>
            {
              {
                name: 'Name',
                subtitle: 'Subtitle',
                stack: 'Stack',
                milestone: 'Current milestone memo',
                repositoryUrl: 'Repository URL',
              }[key]
            }
            <input
              autoFocus={key === 'name'}
              value={editor.draft[key]}
              aria-invalid={!!errors[key]}
              onChange={(event) => update({ ...editor.draft, [key]: event.target.value })}
            />
            {errors[key] && <span role="alert">{errors[key]}</span>}
          </label>
        ))}
        <label>
          Project scope
          <select
            value={editor.draft.scope}
            onChange={(event) =>
              update({ ...editor.draft, scope: event.target.value as ProjectDraft['scope'] })
            }
          >
            <option value="unity">Unity</option>
            <option value="server">Server</option>
          </select>
        </label>
        <label>
          Progress
          <input
            type="number"
            min="0"
            max="100"
            step="any"
            value={Number.isNaN(editor.draft.progress) ? '' : editor.draft.progress}
            onChange={(event) => update({ ...editor.draft, progress: event.target.valueAsNumber })}
          />
          {errors.progress && <span role="alert">{errors.progress}</span>}
        </label>
      </fieldset>
      {conflict && (
        <div>
          <button type="button" disabled={busy || missing} onClick={() => void reconcile()}>
            Reload latest Project
          </button>
          {latest && (
            <>
              <p>
                Latest revision {latest.revision}: {latest.name} · {latest.scope} · {latest.status}
                <br />
                {latest.subtitle} · {latest.stack} · {latest.progress}%<br />
                Memo: {latest.currentMilestone}
                <br />
                Repository: {latest.repositoryUrl}
              </p>
              <button type="button" onClick={handleReapply}>
                Review reapplication
              </button>
              <button
                type="button"
                onClick={() => {
                  memory.editor = undefined;
                  onClose();
                }}
              >
                Discard edits and use latest
              </button>
            </>
          )}
        </div>
      )}
      <div className="project-toolbar">
        <button type="submit" disabled={busy || conflict || missing}>
          {busy ? 'Saving…' : editor.intent ? 'Retry creation' : 'Save Project'}
        </button>
        <button type="button" disabled={busy} onClick={discard}>
          {editor.intent ? 'Abandon creation' : 'Cancel edit'}
        </button>
      </div>
    </form>
  );
}
