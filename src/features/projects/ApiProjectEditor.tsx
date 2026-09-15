import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CancelledError, HttpError } from '../../shared/http/client';
import {
  patchBody,
  projectDraft,
  validateDraft,
  type ApiProject,
  type ProjectDraft,
} from './apiModel';
import { ProjectCreatedError, type ProjectStore } from './apiStore';
import type { DraftMemory, EditorMemory } from './draftMemory';
import { createIntent, retryBody } from './createIntent';
import { Button, Modal } from '../../shared/ui/controls';
import { ProjectFields } from './ProjectFields';
import type { CategoryStore } from './categoryStore';
import { CategorySelection } from './CategorySelection';
import { CategoryManager, CategoryManagerButton } from './CategoryManager';

export function ApiProjectEditor({
  store,
  categories,
  memory,
  project,
  onClose,
  onSaved,
  onArchive,
  isArchiving = false,
  feedback,
}: {
  store: ProjectStore;
  categories: CategoryStore;
  memory: DraftMemory;
  project?: ApiProject;
  onClose: () => void;
  onSaved: (project: ApiProject) => void;
  onArchive?: () => void;
  isArchiving?: boolean;
  feedback?: string;
}) {
  const target = project?.id ?? 'create';
  const [managing, setManaging] = useState(!!memory.category);
  const returnToCategory = useRef(false);
  useEffect(() => {
    if (!managing && returnToCategory.current) {
      returnToCategory.current = false;
      const frame = requestAnimationFrame(() =>
        document.querySelector<HTMLSelectElement>('select[aria-label="개발 분야"]')?.focus(),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [managing]);
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
    if (editor.baseline && 'scope' in editor.baseline) {
      setConflict(true);
      setNotice(
        '이전 버전의 프로젝트 초안입니다. 최신 프로젝트를 확인하고 변경 사항을 다시 적용해 주세요.',
      );
      await reconcile();
      return;
    }
    const fields = editor.intent ? {} : validateDraft(editor.draft);
    const categoryState = categories.list.getSnapshot();
    if (
      !editor.intent &&
      editor.draft.categoryId &&
      editor.draft.categoryId !== editor.baseline?.categoryId &&
      (categoryState.status !== 'ready' ||
        !categoryState.data?.items.some((item) => item.id === editor.draft.categoryId))
    )
      fields.categoryId = '선택한 카테고리를 확인한 후 다시 저장해 주세요.';
    setErrors(fields);
    if (Object.keys(fields).length) return;
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (editor.confirmedId) {
        const query = store.detail(editor.confirmedId);
        await query.load();
        if (!current()) return;
        const state = query.getSnapshot();
        if (state.status !== 'ready' || !state.data)
          throw new ProjectCreatedError(editor.confirmedId);
        memory.editor = undefined;
        onSaved(state.data);
        return;
      }
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
      const saved = await store.mutate(
        editor.baseline?.id,
        body,
        intent?.key,
        intent ? (intent.endpoint ?? '/api/v1/projects') : undefined,
      );
      if (!current()) return;
      memory.editor = undefined;
      onSaved(saved);
    } catch (error) {
      if (!current() || error instanceof CancelledError) return;
      if (error instanceof ProjectCreatedError) {
        const next = { ...memory.editor!, confirmedId: error.id };
        memory.editor = next;
        setEditor(next);
        setNotice(error.message);
        return;
      }
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
        if (error.status === 404 && editor.draft.categoryId) {
          await categories.refresh();
          if (!current()) return;
          if (editor.baseline) {
            const query = store.detail(editor.baseline.id);
            await query.load();
            if (!current()) return;
            const state = query.getSnapshot();
            if (state.error instanceof HttpError && state.error.status === 404) setMissing(true);
          } else {
            const next = { ...editor, intent: undefined };
            memory.editor = next;
            setEditor(next);
          }
          setErrors({
            categoryId:
              '카테고리가 없거나 접근할 수 없어요. 다시 선택하거나 미분류로 변경해 주세요.',
          });
          setNotice('저장하지 못했습니다. 선택한 카테고리를 확인해 주세요.');
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
  // Header action styles must not alter the shared dialog's responsive layout.
  if (managing)
    return (
      <CategoryManager
        store={categories}
        memory={memory}
        onClose={() => {
          returnToCategory.current = true;
          setManaging(false);
        }}
      />
    );
  return createPortal(
    <Modal
      title={project ? '프로젝트 편집' : '프로젝트 추가'}
      onClose={() => {
        if (!busy && !isArchiving) discard();
      }}
      wide
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit();
        }}
      >
        <fieldset
          className="project-fields"
          disabled={busy || isArchiving || !!editor.intent || conflict || missing}
        >
          <ProjectFields
            classification={
              <CategorySelection
                store={categories}
                value={editor.draft.categoryId}
                onChange={(categoryId) => update({ ...editor.draft, categoryId })}
                error={errors.categoryId}
              />
            }
            form={editor.draft}
            errors={errors}
            progressStep="any"
            onChange={(key, value) => update({ ...editor.draft, [key]: value })}
          />
        </fieldset>
        <CategoryManagerButton
          disabled={busy || isArchiving || !!editor.intent}
          onClick={() => setManaging(true)}
        />
        {notice && (
          <p className="notice" role="alert">
            {notice}
          </p>
        )}
        {feedback && (
          <p className="notice" role="alert">
            {feedback}
          </p>
        )}
        {conflict && (
          <div className="notice">
            <Button type="button" disabled={busy || missing} onClick={() => void reconcile()}>
              최신 프로젝트 다시 확인
            </Button>
            {latest && (
              <>
                <p>
                  {latest.name} · {latest.stack} · {latest.progress}%<br />
                  {latest.subtitle}
                  <br />
                  {latest.currentMilestone}
                  <br />
                  {latest.repositoryUrl}
                </p>
                <Button type="button" onClick={handleReapply}>
                  내 변경 다시 적용
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    memory.editor = undefined;
                    onClose();
                  }}
                >
                  변경 취소하고 최신 내용 사용
                </Button>
              </>
            )}
          </div>
        )}
        <div className="modal-actions">
          {project && onArchive && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy || isArchiving || conflict || missing}
              onClick={onArchive}
            >
              {project.status === 'archived' ? '보관 해제' : '프로젝트 보관'}
            </Button>
          )}
          <Button type="button" disabled={busy || isArchiving} onClick={discard}>
            {editor.intent ? '생성 취소' : '취소'}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || isArchiving || conflict || missing}
          >
            {busy
              ? '저장 중…'
              : editor.confirmedId
                ? '최신 프로젝트 불러오기'
                : editor.intent
                  ? '생성 다시 시도'
                  : '프로젝트 저장'}
          </Button>
        </div>
      </form>
    </Modal>,
    document.body,
  );
}
