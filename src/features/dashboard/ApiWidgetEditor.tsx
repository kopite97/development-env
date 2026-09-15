import { useCallback, useEffect, useState } from 'react';
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
  onSave,
  onClose,
}: {
  memory: DashboardMemory;
  options: DashboardProjectOptions;
  categories: readonly CategoryOption[];
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
  const projects = new Map((state.data?.items ?? []).map((p) => [p.id, p]));
  if (selected) projects.set(selected.id, selected);
  return (
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
  );
}
