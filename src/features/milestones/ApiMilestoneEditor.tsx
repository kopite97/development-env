import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { useQuery } from '../../shared/http/query';
import { CancelledError, HttpError } from '../../shared/http/client';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import {
  createBody,
  milestoneDraft,
  patchBody,
  type ApiMilestone,
  type MilestoneProjectOption,
} from './apiModel';
import { createIntent, retryBody } from './apiIntent';
import type { MilestoneMemory, MilestoneEditorMemory } from './draftMemory';
import type { MilestoneStore } from './apiStore';
import type { MilestoneProjectOptions } from './projectOptions';

export function ApiMilestoneEditor({
  store,
  options,
  memory,
  onClose,
  onSaved,
  returnFocusRef,
}: {
  store: MilestoneStore;
  options: MilestoneProjectOptions;
  memory: MilestoneMemory;
  onClose: () => void;
  onSaved: () => void;
  returnFocusRef: RefObject<HTMLSelectElement | null>;
}) {
  const [editor, setEditor] = useState<MilestoneEditorMemory>(() => memory.editor!);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  const [notice, setNotice] = useState(editor.notice ?? '');
  const [latest, setLatest] = useState<ApiMilestone>();
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<MilestoneProjectOption>();
  const [selectedFailed, setSelectedFailed] = useState(false);
  const [selectionRetry, setSelectionRetry] = useState(0);
  const projects = useQuery(options.list);
  const current = () =>
    alive.current &&
    !store.transport.lifecycle.signal.aborted &&
    store.transport.generation === store.transport.lifecycle.generation;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setSelected(undefined);
    setSelectedFailed(false);
    if (editor.draft.projectId) {
      const q = options.detail(editor.draft.projectId);
      void q.load().then(() => {
        const s = q.getSnapshot();
        if (active) {
          if (s.status === 'ready') setSelected(s.data);
          else setSelectedFailed(true);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [options, editor.draft.projectId, selectionRetry]);
  const update = (next: MilestoneEditorMemory) => {
    memory.editor = next;
    setEditor(next);
  };
  const canDiscard = useUnsavedChanges(
    busy ||
      !!editor.intent ||
      !!editor.review ||
      JSON.stringify(editor.draft) !==
        JSON.stringify(editor.initialDraft ?? milestoneDraft(editor.baseline)),
  );
  const close = () => {
    if (!busy && canDiscard()) {
      memory.editor = undefined;
      onClose();
    }
  };
  const done = () => {
    memory.editor = undefined;
    onSaved();
  };
  const values = new Map((projects.data?.items ?? []).map((p) => [p.id, p]));
  if (selected && !values.has(selected.id)) values.set(selected.id, selected);
  const reload = async () => {
    const id = editor.confirmedId ?? editor.baseline?.id;
    if (!id) return;
    const q = store.detail(id);
    q.invalidate(true);
    await q.load();
    if (!current()) return;
    const s = q.getSnapshot();
    setLatest(s.status === 'ready' ? s.data : undefined);
    if (s.status !== 'ready')
      setNotice(
        s.error instanceof HttpError && s.error.status === 404
          ? '마일스톤을 찾을 수 없습니다. 입력 내용은 유지됩니다.'
          : '최신 상태를 확인하지 못했습니다. 입력 내용은 유지됩니다. 다시 확인해 주세요.',
      );
  };
  const run = async (operation: 'save' | 'delete') => {
    if (pending.current || editor.review) return;
    try {
      if (operation === 'save') createBody(editor.draft);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : '목표 제목, 프로젝트와 올바른 기한을 확인해 주세요.',
      );
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (operation === 'delete') {
        await store.mutate('delete', {
          id: editor.baseline!.id,
          revision: editor.baseline!.revision,
        });
        if (current()) done();
        return;
      }
      if (editor.baseline) {
        const body = patchBody(editor.baseline, editor.draft);
        if (Object.keys(body).length > 1)
          await store.mutate('patch', { id: editor.baseline.id, body });
        if (current()) done();
      } else {
        const intent = editor.intent ?? createIntent(editor.draft);
        update({ ...editor, intent });
        const result = await store.mutate('create', {
          body: retryBody(intent),
          key: intent.key,
          endpoint: intent.endpoint ?? '/api/v1/milestones',
        });
        if (!current()) return;
        if ('reconciled' in result && result.reconciled) done();
        else {
          update({
            ...memory.editor!,
            confirmedId: 'confirmedId' in result ? result.confirmedId : undefined,
            review: true,
          });
          setNotice(
            '생성 응답을 받았으나 현재 상태를 확인하지 못했습니다. 입력 내용은 유지되며 다시 생성하지 않습니다.',
          );
        }
      }
    } catch (error) {
      if (!current() || error instanceof CancelledError) return;
      const code = error instanceof HttpError ? error.code : '';
      if (error instanceof HttpError && code === 'SESSION_UNVERIFIED') {
        setNotice(error.message);
        return;
      }
      setNotice(
        code === 'REVISION_CONFLICT'
          ? '다른 곳에서 변경되었습니다. 최신 상태와 내 입력을 검토해 주세요.'
          : error instanceof Error
            ? error.message
            : '요청에 실패했습니다. 입력 내용은 유지됩니다.',
      );
      if (code === 'CSRF_INVALID') {
        update({
          ...memory.editor!,
          review: !!editor.baseline,
          notice: '세션을 확인했습니다. 최신 상태와 입력 내용을 검토하고 다시 시도해 주세요.',
        });
        try {
          await store.transport.recoverSecurity();
        } catch (failure) {
          if (current())
            setNotice(failure instanceof Error ? failure.message : '세션을 확인하지 못했습니다.');
        }
      } else if (!editor.baseline && error instanceof HttpError && error.status === 400) {
        update({ ...memory.editor!, intent: undefined });
      } else if (editor.baseline) {
        update({ ...memory.editor!, review: true });
        setDeleting(false);
        await reload();
      }
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const reapply = (adopt: boolean) => {
    if (!latest) return;
    const draft = milestoneDraft(latest);
    if (!adopt && editor.baseline) {
      const changes = patchBody(editor.baseline, editor.draft);
      if ('title' in changes) draft.title = editor.draft.title;
      if ('projectId' in changes) draft.projectId = editor.draft.projectId;
      if ('dueDate' in changes) draft.dueDate = editor.draft.dueDate;
      if ('completed' in changes) draft.completed = editor.draft.completed;
    }
    update({ target: latest.id, baseline: latest, draft });
    setLatest(undefined);
    setNotice('최신 상태를 반영했습니다. 검토 후 저장하거나 삭제해 주세요.');
  };
  return (
    <>
      <Modal
        title={editor.baseline ? '마일스톤 수정' : '마일스톤 추가'}
        onClose={close}
        returnFocusRef={returnFocusRef}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run('save');
          }}
        >
          <fieldset
            disabled={busy || !!editor.intent || !!editor.review}
            className="milestone-fieldset"
          >
            <div className="milestone-form">
              <Field label="목표 제목">
                <input
                  autoFocus
                  required
                  maxLength={200}
                  value={editor.draft.title}
                  onChange={(e) =>
                    update({ ...editor, draft: { ...editor.draft, title: e.target.value } })
                  }
                />
              </Field>
              <Field label="프로젝트">
                <select
                  aria-label="프로젝트"
                  required
                  value={editor.draft.projectId}
                  onChange={(e) =>
                    update({ ...editor, draft: { ...editor.draft, projectId: e.target.value } })
                  }
                >
                  <option value="">프로젝트 선택</option>
                  {[...values.values()].map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.archived ? ' (보관됨)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="목표 기한 (선택)">
                <input
                  type="date"
                  value={editor.draft.dueDate}
                  onChange={(e) =>
                    update({ ...editor, draft: { ...editor.draft, dueDate: e.target.value } })
                  }
                />
              </Field>
              <Field label="목표 상태">
                <select
                  value={editor.draft.completed ? 'done' : 'open'}
                  onChange={(e) =>
                    update({
                      ...editor,
                      draft: { ...editor.draft, completed: e.target.value === 'done' },
                    })
                  }
                >
                  <option value="open">진행 중</option>
                  <option value="done">완료</option>
                </select>
              </Field>
            </div>
          </fieldset>
          {projects.status === 'loading' && !projects.data && (
            <p role="status">프로젝트를 불러오는 중…</p>
          )}
          {projects.status === 'error' && (
            <p role="alert">
              프로젝트를 불러오지 못했습니다.{' '}
              <Button type="button" onClick={() => options.list.invalidate()}>
                프로젝트 다시 시도
              </Button>
            </p>
          )}
          {projects.data?.nextCursor && (
            <Button
              type="button"
              disabled={projects.status === 'loading'}
              onClick={() => void options.more()}
            >
              프로젝트 더 불러오기
            </Button>
          )}
          {selectedFailed && !values.has(editor.draft.projectId) && (
            <p role="alert" className="notice">
              선택된 프로젝트를 확인하지 못했습니다. 선택과 입력 내용은 유지됩니다.
              <Button type="button" onClick={() => setSelectionRetry((value) => value + 1)}>
                선택된 프로젝트 다시 확인
              </Button>
            </p>
          )}
          {notice && (
            <p className="notice" role="alert">
              {notice}
            </p>
          )}
          {editor.intent && (
            <p role="status">
              생성 요청이 저장되었을 수 있습니다. 재시도는 동일한 요청과 키를 사용합니다.
            </p>
          )}
          {editor.review && (
            <div className="notice">
              <Button type="button" disabled={busy} onClick={() => void reload()}>
                최신 상태 다시 확인
              </Button>
              {latest && (
                <>
                  <p>
                    최신 제목: {latest.title} · 프로젝트: {latest.projectName} ·{' '}
                    {latest.dueDate ?? '기한 없음'} · {latest.completed ? '완료' : '진행 중'} ·
                    revision {latest.revision}
                  </p>
                  <p>
                    내 입력: {editor.draft.title} · {editor.draft.dueDate || '기한 없음'} ·{' '}
                    {editor.draft.completed ? '완료' : '진행 중'}
                  </p>
                  {editor.confirmedId ? (
                    <Button type="button" onClick={done}>
                      확인 후 닫기
                    </Button>
                  ) : (
                    <>
                      <Button type="button" onClick={() => reapply(true)}>
                        서버 내용 사용
                      </Button>
                      <Button type="button" onClick={() => reapply(false)}>
                        내 변경 다시 적용
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          <div className="modal-actions">
            {editor.baseline && (
              <Button
                type="button"
                variant="danger"
                disabled={busy || editor.review}
                onClick={() => setDeleting(true)}
              >
                영구 삭제
              </Button>
            )}
            <Button type="button" disabled={busy} onClick={close}>
              취소
            </Button>
            <Button type="submit" variant="primary" disabled={busy || editor.review}>
              {busy ? '저장 중…' : editor.intent ? '동일 요청 다시 시도' : '마일스톤 저장'}
            </Button>
          </div>
        </form>
      </Modal>
      {deleting && (
        <Modal
          title="마일스톤 영구 삭제"
          onClose={() => {
            if (!busy) setDeleting(false);
          }}
        >
          <p>‘{editor.baseline?.title}’ 마일스톤을 영구 삭제할까요? 삭제 후 복원할 수 없습니다.</p>
          <div className="modal-actions">
            <Button disabled={busy} onClick={() => setDeleting(false)}>
              취소
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => void run('delete')}>
              {busy ? '삭제 중…' : '영구 삭제 확인'}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
