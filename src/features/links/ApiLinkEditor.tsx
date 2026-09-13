import { useEffect, useRef, useState } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { CancelledError, HttpError } from '../../shared/http/client';
import { createBody, linkDraft, patchBody, type ApiLink, type LinkDraft } from './apiModel';
import { createIntent, retryBody } from './apiIntent';
import type { LinkEditorMemory, LinkMemory } from './draftMemory';
import type { LinkStore } from './apiStore';

export function ApiLinkEditor({
  store,
  memory,
  onClose,
  onSaved,
}: {
  store: LinkStore;
  memory: LinkMemory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editor, setEditor] = useState(memory.editor!);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(editor.notice ?? '');
  const [latest, setLatest] = useState<ApiLink>();
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const current = () =>
    alive.current &&
    !store.transport.lifecycle.signal.aborted &&
    store.transport.lifecycle.generation === store.transport.generation;
  const update = (next: LinkEditorMemory) => {
    if (current()) {
      memory.editor = next;
      setEditor(next);
    }
  };
  const canDiscard = useUnsavedChanges(
    busy ||
      !!editor.intent ||
      !!editor.review ||
      JSON.stringify(editor.draft) !== JSON.stringify(linkDraft(editor.baseline)),
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
  const reload = async () => {
    const id = editor.confirmedId ?? editor.baseline?.id;
    if (!id) return;
    setLatest(undefined);
    const q = store.detail(id);
    q.invalidate(true);
    await q.load();
    if (!current()) return;
    const state = q.getSnapshot();
    if (state.status === 'ready') setLatest(state.data);
    else
      setNotice(
        state.error instanceof HttpError && state.error.status === 404
          ? '링크를 찾을 수 없습니다. 입력 내용은 유지됩니다.'
          : '최신 상태를 확인하지 못했습니다. 다시 확인해 주세요.',
      );
  };
  const save = async () => {
    if (pending.current || editor.review) return;
    try {
      createBody(editor.draft);
    } catch (error) {
      setNotice((error as Error).message);
      return;
    }
    pending.current = true;
    setBusy(true);
    setNotice('');
    try {
      if (editor.baseline) {
        const body = patchBody(editor.baseline, editor.draft);
        if (Object.keys(body).length > 1) {
          update({ ...editor, review: true });
          await store.mutate('patch', { id: editor.baseline.id, body });
        }
        if (current()) done();
      } else {
        const intent = editor.intent ?? createIntent(editor.draft);
        update({ ...editor, intent });
        const result = await store.mutate('create', { body: retryBody(intent), key: intent.key });
        if (!current()) return;
        if (result.reconciled) done();
        else {
          update({ ...memory.editor!, confirmedId: result.confirmedId, review: true });
          setNotice(
            '생성 응답을 받았으나 현재 상태를 확인하지 못했습니다. 다시 생성하지 않고 최신 상태를 확인해 주세요.',
          );
        }
      }
    } catch (error) {
      if (!current() || error instanceof CancelledError) return;
      const code = error instanceof HttpError ? error.code : '';
      setNotice(
        code === 'REVISION_CONFLICT'
          ? '다른 곳에서 변경되었습니다. 최신 내용과 내 입력을 검토해 주세요.'
          : code === 'QUOTA_EXCEEDED'
            ? '링크 한도에 도달했습니다. 기존 링크를 삭제한 뒤 다시 저장해 주세요. 입력 내용은 유지됩니다.'
            : code === 'IDEMPOTENCY_KEY_REUSED'
              ? '같은 생성 요청 키가 다른 내용에 사용되었습니다. 기존 요청을 검토해 주세요. 새 요청을 자동으로 보내지 않습니다.'
              : error instanceof Error
                ? error.message
                : '저장하지 못했습니다. 입력 내용은 유지됩니다.',
      );
      if (editor.baseline) {
        update({ ...memory.editor!, review: true });
        await reload();
      } else if (error instanceof HttpError && (error.status === 400 || error.status === 429))
        update({ ...memory.editor!, intent: undefined });
      else if (code === 'IDEMPOTENCY_KEY_REUSED') update({ ...memory.editor!, review: true });
      if (code === 'CSRF_INVALID') {
        try {
          await store.transport.recoverSecurity();
        } catch {
          if (current()) setNotice('세션 확인에 실패했습니다. 입력 내용은 유지됩니다.');
        }
      }
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const reapply = (keep: boolean) => {
    if (!latest || !editor.baseline) return;
    const draft = linkDraft(latest);
    if (keep) {
      const changes = patchBody(editor.baseline, editor.draft);
      for (const key of ['label', 'description', 'url', 'scope'] as const)
        if (key in changes) Object.assign(draft, { [key]: editor.draft[key] });
    }
    update({ baseline: latest, draft });
    setLatest(undefined);
    setNotice('최신 상태를 반영했습니다. 검토 후 저장해 주세요.');
  };
  const change = (key: keyof LinkDraft, value: string) =>
    update({ ...editor, draft: { ...editor.draft, [key]: value } });
  return (
    <Modal title={editor.baseline ? '링크 편집' : '링크 추가'} onClose={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <fieldset className="link-fieldset" disabled={busy || !!editor.intent || !!editor.review}>
          <Field label="링크 이름">
            <input
              autoFocus
              required
              maxLength={100}
              value={editor.draft.label}
              onChange={(e) => change('label', e.target.value)}
            />
          </Field>
          <Field label="URL">
            <input
              required
              maxLength={2000}
              value={editor.draft.url}
              onChange={(e) => change('url', e.target.value)}
            />
          </Field>
          <Field label="설명">
            <input
              maxLength={300}
              value={editor.draft.description}
              onChange={(e) => change('description', e.target.value)}
            />
          </Field>
          <Field label="표시 범위">
            <select value={editor.draft.scope} onChange={(e) => change('scope', e.target.value)}>
              <option value="all">공통</option>
              <option value="unity">Unity 개발</option>
              <option value="server">서버 · 웹 개발</option>
            </select>
          </Field>
        </fieldset>
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
                  최신 내용: {latest.label} · {latest.url} · {latest.description} · {latest.scope}
                </p>
                <p>
                  내 입력: {editor.draft.label} · {editor.draft.url} · {editor.draft.description} ·{' '}
                  {editor.draft.scope}
                </p>
                {editor.confirmedId ? (
                  <Button type="button" onClick={done}>
                    확인 후 닫기
                  </Button>
                ) : (
                  <>
                    <Button type="button" onClick={() => reapply(false)}>
                      서버 내용 사용
                    </Button>
                    <Button type="button" onClick={() => reapply(true)}>
                      내 변경 다시 적용
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        <div className="modal-actions">
          <Button type="button" disabled={busy} onClick={close}>
            취소
          </Button>
          <Button type="submit" variant="primary" disabled={busy || editor.review}>
            {busy ? '저장 중…' : editor.intent ? '동일 요청 다시 시도' : '링크 저장'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
