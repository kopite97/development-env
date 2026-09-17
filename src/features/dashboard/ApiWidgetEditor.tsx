import { useCallback, useEffect, useState } from 'react';
import { HttpError } from '../../shared/http/client';
import { useQuery } from '../../shared/http/query';
import { Button } from '../../shared/ui/controls';
import { WidgetEditorView } from './WidgetEditorView';
import { parseWidgets, dashboardText, writableWidgets } from './apiModel';
import type { DashboardMemory, WidgetForm } from './draftMemory';
import type { DashboardProjectOption, DashboardProjectOptions } from './projectOptions';
import type { Widget } from './apiModel';
import type { CategoryOption } from '../projects/categoryFilter';
export function ApiWidgetEditor({
  memory,
  options,
  categories,
  available = [],
  onDelete,
  onSave,
  onClose,
}: {
  memory: DashboardMemory;
  options: DashboardProjectOptions;
  categories: readonly CategoryOption[];
  available?: readonly Widget[];
  onDelete?: (widget: Widget) => Promise<void>;
  onSave: (widget: Widget) => void;
  onClose: () => void;
}) {
  const saved = memory.editor!.widget!;
  const [initial] = useState(saved);
  const [selectedId, setSelectedId] = useState(
    saved.form.selection.kind === 'project' ? saved.form.selection.projectId : undefined,
  );
  const [selected, setSelected] = useState<DashboardProjectOption>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const [availableItems, setAvailableItems] = useState<readonly Widget[]>(available);
  const [deletingId, setDeletingId] = useState<string>();
  const state = useQuery(options.list);
  const update = useCallback(
    (form: WidgetForm) => {
      if (memory.editor?.widget) {
        memory.editor.widget.form = form;
        setSelectedId(form.selection.kind === 'project' ? form.selection.projectId : undefined);
      }
    },
    [memory],
  );
  useEffect(() => {
    let active = true;
    setSelected(undefined);
    setFailed(false);
    if (selectedId) {
      const q = options.detail(selectedId);
      void q.load().then(() => {
        if (active) {
          const s = q.getSnapshot();
          setSelected(s.status === 'ready' ? s.data : undefined);
          setFailed(s.status !== 'ready');
        }
      });
    }
    return () => {
      active = false;
    };
  }, [selectedId, options, retry]);
  useEffect(() => setAvailableItems(available), [available]);
  const projects = new Map((state.data?.items ?? []).map((p) => [p.id, p]));
  if (selected) projects.set(selected.id, selected);
  return (
    <>
      {!initial.existing && availableItems.length > 0 && (
        <div className="notice" role="region" aria-label="미배치 위젯">
          <p>이미 만들어 둔 위젯을 홈에 다시 배치할 수 있어요.</p>
          {availableItems.map((widget) => (
            <span key={widget.id}>
              <Button
                type="button"
                disabled={deletingId !== undefined}
                onClick={() => onSave({ ...widget, size: 'medium' })}
              >
                {widget.title} 배치
              </Button>
              {onDelete && (
                <Button
                  type="button"
                  disabled={deletingId !== undefined}
                  onClick={() => {
                    if (!window.confirm('이 미배치 위젯을 영구 삭제할까요?')) return;
                    setDeletingId(widget.id);
                    setNotice('');
                    void onDelete(widget)
                      .then(() =>
                        setAvailableItems((items) => items.filter((item) => item.id !== widget.id)),
                      )
                      .catch((error) => {
                        const code = error instanceof HttpError ? error.code : '';
                        setNotice(
                          code === 'WIDGET_IN_USE'
                            ? '홈에 배치된 위젯은 먼저 홈에서 제거해 주세요.'
                            : '위젯을 삭제하지 못했습니다. 최신 미배치 목록을 확인해 주세요.',
                        );
                      })
                      .finally(() => setDeletingId(undefined));
                  }}
                >
                  {widget.title} 삭제
                </Button>
              )}
            </span>
          ))}
        </div>
      )}
      <WidgetEditorView
        categories={categories}
        normalizeTitle={dashboardText}
        unknownProjectLabel={failed ? '선택된 프로젝트 확인 불가' : '선택된 프로젝트 확인 중…'}
        existing={
          initial.existing
            ? {
                ...initial.form,
                ...(initial.form.limitText ? { limit: Number(initial.form.limitText) } : {}),
              }
            : undefined
        }
        typeImmutable
        restored={initial.form}
        onDraftChange={(form) => {
          if (form.selection) update({ ...form, selection: form.selection });
        }}
        projects={[...projects.values()]}
        onClose={onClose}
        onSave={(w) => {
          try {
            const widgets = memory.editor!.draft.filter(
              (x) => x.id !== (initial.existing ? initial.form.id : ''),
            );
            parseWidgets([...writableWidgets(widgets), w]);
            onSave(parseWidgets([w])[0]);
          } catch (error) {
            setNotice((error as Error).message);
          }
        }}
        feedback={
          <>
            {(state.status === 'loading' || state.status === 'idle') && !state.data && (
              <p role="status">프로젝트를 불러오는 중…</p>
            )}
            {state.status === 'error' && (
              <p role="alert">
                프로젝트를 불러오지 못했습니다.{' '}
                <Button type="button" onClick={() => options.list.invalidate()}>
                  프로젝트 다시 시도
                </Button>
              </p>
            )}
            {state.data?.nextCursor && (
              <Button
                type="button"
                disabled={state.status === 'loading'}
                onClick={() => void options.more()}
              >
                프로젝트 더 불러오기
              </Button>
            )}
            {failed && (
              <p role="alert">
                선택된 프로젝트를 확인하지 못했습니다. 선택은 유지됩니다.{' '}
                <Button type="button" onClick={() => setRetry((n) => n + 1)}>
                  선택된 프로젝트 다시 확인
                </Button>
              </p>
            )}
            {notice && (
              <p className="notice" role="alert">
                {notice}
              </p>
            )}
          </>
        }
      />
    </>
  );
}
