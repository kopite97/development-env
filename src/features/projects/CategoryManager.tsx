import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pencil, Plus, RefreshCw, Tags, Trash2 } from 'lucide-react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { CancelledError, HttpError } from '../../shared/http/client';
import {
  categoryIntent,
  categoryNameError,
  type CategoryMemory,
  type Category,
} from './categoryModel';
import type { CategoryStore } from './categoryStore';
import type { DraftMemory } from './draftMemory';
import { useCategories } from './CategorySelection';

export function CategoryManagerButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      className="category-management-action"
      type="button"
      onClick={onClick}
      disabled={disabled}
    >
      <Tags size={16} />
      카테고리 관리
    </Button>
  );
}
function message(error: unknown) {
  if (!(error instanceof HttpError))
    return error instanceof Error ? error.message : '저장하지 못했습니다.';
  const messages: Record<string, string> = {
    CATEGORY_IN_USE:
      '진행 중이거나 보관된 프로젝트가 사용 중인 카테고리입니다. 프로젝트의 개발 분야를 변경한 후 삭제해 주세요.',
    CATEGORY_NAME_CONFLICT: '같은 이름의 카테고리가 이미 있어요. 다른 이름을 입력해 주세요.',
    QUOTA_EXCEEDED:
      '카테고리는 최대 100개까지 만들 수 있어요. 사용하지 않는 카테고리를 삭제한 후 다시 시도해 주세요.',
    REVISION_CONFLICT: '카테고리가 변경되었습니다. 최신 내용을 확인한 후 다시 저장해 주세요.',
    RESOURCE_NOT_FOUND: '카테고리가 없거나 접근할 수 없어요. 목록을 다시 확인해 주세요.',
    IDEMPOTENCY_KEY_REUSED:
      '다른 생성 요청에 사용된 키입니다. 목록을 확인한 후 요청을 취소해 주세요.',
    CSRF_INVALID: '보안 정보를 다시 확인했습니다. 내용을 검토한 후 직접 다시 시도해 주세요.',
  };
  return (
    messages[error.code] ??
    error.fieldErrors.name ??
    '저장이 확인되지 않았습니다. 다시 확인해 주세요.' +
      (error.requestId ? ' Request ID: ' + error.requestId : '')
  );
}
export function CategoryManager({
  store,
  memory,
  onClose,
}: {
  store: CategoryStore;
  memory: DraftMemory;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<CategoryMemory>(() => memory.category ?? { name: '' });
  const [busy, setBusy] = useState(false);
  const pending = useRef(false),
    alive = useRef(true);
  const state = useCategories(store);
  const current = () =>
    alive.current && store.transport.generation === store.transport.lifecycle.generation;
  const update = (next: CategoryMemory) => {
    memory.category = next;
    setDraft(next);
  };
  useEffect(() => {
    alive.current = true;
    memory.category ??= draft;
    const unload = (event: BeforeUnloadEvent) => {
      if (memory.category) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', unload);
    return () => {
      alive.current = false;
      window.removeEventListener('beforeunload', unload);
    };
  }, [memory]);
  const clear = () => update({ name: '' });
  const refresh = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      if (draft.reconcile && draft.target) {
        try {
          const target = await store.read(draft.target.id);
          if (current())
            update({
              ...draft,
              target,
              reconcile: false,
              notice: '최신 내용을 확인했습니다. 변경 내용을 검토한 후 다시 저장해 주세요.',
            });
        } catch (error) {
          if (current()) {
            if (error instanceof HttpError && error.status === 404 && draft.mode === 'delete')
              update({ name: '', notice: '카테고리가 이미 삭제되었거나 접근할 수 없어요.' });
            else update({ ...draft, notice: message(error) });
          }
        }
      }
      await store.refresh();
      if (current() && draft.confirmed && store.list.getSnapshot().status === 'ready') clear();
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const save = async (deleting?: Category) => {
    if (pending.current || draft.reconcile || draft.confirmed) return;
    if (
      deleting &&
      draft.name &&
      !window.confirm('작성 중인 카테고리 초안 대신 삭제를 진행할까요?')
    )
      return;
    const target = deleting ?? draft.target;
    const isDelete = !!deleting || draft.mode === 'delete';
    if (!isDelete && categoryNameError(draft.name)) {
      update({ ...draft, notice: categoryNameError(draft.name) });
      return;
    }
    if (isDelete && !window.confirm('카테고리를 삭제할까요? 이 작업은 되돌릴 수 없어요.')) return;
    let next: CategoryMemory = {
      ...draft,
      target,
      mode: isDelete ? 'delete' : undefined,
      notice: undefined,
    };
    if (!target) next = { ...next, intent: next.intent ?? categoryIntent(next.name) };
    update(next);
    pending.current = true;
    setBusy(true);
    try {
      const fresh = target
        ? isDelete
          ? await store.delete(target)
          : await store.rename(target, next.name)
        : await store.create(next.intent!);
      if (current())
        update(
          fresh
            ? { name: '', notice: '저장했습니다.' }
            : {
                ...next,
                confirmed: true,
                notice:
                  '저장은 완료되었지만 목록을 갱신하지 못했습니다. 목록만 다시 불러와 주세요.',
              },
        );
    } catch (error) {
      if (!current() || error instanceof CancelledError) return;
      const known = error instanceof HttpError;
      const reconcile =
        !!target &&
        (!known ||
          error.code === 'REVISION_CONFLICT' ||
          error.status === 0 ||
          error.status >= 500 ||
          error.code === 'PROTOCOL_ERROR' ||
          error.status === 404);
      const rejectedCreate =
        !target &&
        known &&
        (error.code === 'VALIDATION_ERROR' ||
          error.code === 'CATEGORY_NAME_CONFLICT' ||
          error.code === 'QUOTA_EXCEEDED' ||
          error.status === 404);
      update({
        ...next,
        reconcile,
        intent: rejectedCreate ? undefined : next.intent,
        notice: message(error),
      });
      if (known && error.code === 'CSRF_INVALID') {
        try {
          await store.transport.recoverSecurity();
        } catch (failure) {
          if (current()) update({ ...memory.category!, notice: message(failure) });
        }
      }
    } finally {
      pending.current = false;
      if (current()) setBusy(false);
    }
  };
  const close = () => {
    if (pending.current) return;
    if (
      (draft.name || draft.intent || draft.target) &&
      !window.confirm(
        '작성 중인 내용을 취소할까요? 확인되지 않은 생성 요청은 이미 완료되었을 수 있어요.',
      )
    )
      return;
    memory.category = undefined;
    onClose();
  };
  return createPortal(
    <Modal title="카테고리 관리" onClose={close}>
      <div className="category-manager">
        <div className="feature-actions">
          <Button type="button" disabled={busy} onClick={() => void refresh()}>
            <RefreshCw size={16} />
            목록 다시 확인
          </Button>
        </div>
        {state.status === 'loading' && <p role="status">카테고리를 불러오는 중...</p>}
        {state.status === 'error' && <p role="alert">카테고리 목록을 새로 불러오지 못했습니다.</p>}
        {state.status === 'ready' && !state.data?.items.length && <p>등록된 카테고리가 없어요.</p>}
        <ul className="category-list">
          {state.data?.items.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <div className="feature-actions">
                <Button
                  type="button"
                  title="이름 변경"
                  aria-label={item.name + ' 이름 변경'}
                  disabled={busy || !!draft.target || !!draft.intent || !!draft.confirmed}
                  onClick={() => {
                    if (
                      draft.name &&
                      !window.confirm('작성 중인 카테고리 초안을 취소하고 이름을 변경할까요?')
                    )
                      return;
                    update({ name: item.name, target: item });
                  }}
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  type="button"
                  title="삭제"
                  aria-label={item.name + ' 삭제'}
                  disabled={busy || !!draft.target || !!draft.intent || !!draft.confirmed}
                  onClick={() => void save(item)}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {draft.mode !== 'delete' && (
            <Field label={draft.target ? '새 카테고리 이름' : '카테고리 이름'}>
              <input
                value={draft.name}
                disabled={busy || !!draft.intent || !!draft.confirmed || !!draft.reconcile}
                onChange={(event) =>
                  update({ ...draft, name: event.target.value, notice: undefined })
                }
                aria-invalid={!!draft.notice}
                required
              />
            </Field>
          )}
          {draft.reconcile && draft.target && <p>변경 전 이름: {draft.target.name}</p>}
          {draft.notice && (
            <p className="notice" role="alert">
              {draft.notice}
            </p>
          )}
          <div className="modal-actions">
            {(draft.target || draft.intent || draft.confirmed) && (
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('목록을 확인했나요? 현재 요청을 취소할까요?')) clear();
                }}
              >
                요청 취소
              </Button>
            )}
            <Button type="button" disabled={busy} onClick={close}>
              닫기
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={busy || !!draft.reconcile || !!draft.confirmed}
            >
              {!draft.target && <Plus size={16} />}
              {busy
                ? '저장 중...'
                : draft.mode === 'delete'
                  ? '삭제 다시 확인'
                  : draft.target
                    ? '이름 저장'
                    : draft.intent
                      ? '생성 다시 시도'
                      : '카테고리 추가'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>,
    document.body,
  );
}
