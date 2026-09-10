import { Check, GripVertical, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { PageScaffold, type PageScaffoldProps } from '../../shared/ui/PageScaffold';
import { Button, EmptyState, Modal } from '../../shared/ui/controls';
import { scopes, type Scope } from '../projects/scope';
import { useDashboard } from './DashboardProvider';
import { WidgetEditor } from './WidgetEditor';
import { WidgetFrame } from './WidgetFrame';
import type { Widget } from './model';

export function DashboardWorkspace({
  scaffold,
  filter,
  query,
  onStartEditing,
  onNotify: setToast,
  onReset: resetSearch,
  renderWidget,
}: {
  scaffold: Omit<PageScaffoldProps, 'children' | 'actions'>;
  filter: Scope;
  query: string;
  onStartEditing: () => void;
  onNotify: (message: string) => void;
  onReset: () => void;
  renderWidget: (widget: Widget) => ReactNode;
}) {
  const dashboard = useDashboard();
  const { editing, items } = dashboard;
  const [editor, setEditor] = useState<Widget | 'new' | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const start = () => {
    dashboard.start();
    onStartEditing();
  };
  const add = () => {
    if (!editing) start();
    setEditor('new');
  };
  const shown = items.filter(
    (w) =>
      (filter === 'all' || w.scope === filter || w.scope === 'all') &&
      `${w.title} ${scopes[w.scope]}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <PageScaffold
      {...scaffold}
      actions={
        <div className="heading-actions">
          {editing ? (
            <>
              <Button
                onClick={() => {
                  if (dashboard.cancel()) setToast('');
                }}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={() => setToast(dashboard.commit() ? '배치를 적용했습니다.' : '')}
              >
                <Check size={16} />
                배치 저장
              </Button>
            </>
          ) : (
            <>
              <Button onClick={start}>
                <Pencil size={15} />
                배치 편집
              </Button>
              <Button variant="primary" onClick={add}>
                <Plus size={17} />
                위젯 추가
              </Button>
            </>
          )}
        </div>
      }
    >
      {editing && (
        <div className="edit-banner">
          <GripVertical size={18} />
          <span>
            드래그하거나 화살표로 위치를 바꾸세요. 설정에서 크기와 종류를 변경할 수 있어요.
          </span>
          <Button variant="ghost" onClick={() => setResetOpen(true)}>
            <RotateCcw size={14} />
            기본 배치
          </Button>
          <Button onClick={add}>
            <Plus size={15} />
            위젯 추가
          </Button>
        </div>
      )}
      <div className={`dashboard-grid ${editing ? 'is-editing' : ''}`}>
        {shown.map((w) => {
          const index = items.findIndex((item) => item.id === w.id);
          return (
            <WidgetFrame
              key={w.id}
              widget={w}
              editing={editing}
              index={index}
              total={items.length}
              dragging={dragId === w.id}
              onDrag={setDragId}
              onDrop={() => {
                if (dragId) dashboard.move(dragId, w.id);
                setDragId(null);
              }}
              onMove={(offset) => {
                const target = items[index + offset];
                if (target) dashboard.move(w.id, target.id);
              }}
              onEdit={() => setEditor(w)}
              onRemove={() => dashboard.remove(w.id)}
            >
              {renderWidget(w)}
            </WidgetFrame>
          );
        })}
      </div>
      {!shown.length && (
        <EmptyState
          title="표시할 위젯이 없어요"
          onReset={query || filter !== 'all' ? resetSearch : undefined}
        >
          <p>검색 조건을 바꾸거나 홈에 필요한 위젯을 추가해 주세요.</p>
          <Button onClick={add}>
            <Plus size={16} />
            위젯 추가
          </Button>
        </EmptyState>
      )}
      <button className="add-widget-area" onClick={add}>
        <Plus size={18} />
        <span>나에게 필요한 위젯으로 홈을 채워 보세요</span>
        <strong>위젯 추가</strong>
      </button>
      {editor && (
        <WidgetEditor
          existing={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSave={(w) => {
            dashboard.upsert(w);
            setEditor(null);
          }}
        />
      )}
      {resetOpen && (
        <Modal title="기본 배치로 복원할까요?" onClose={() => setResetOpen(false)}>
          <p className="detail-body">
            현재 편집 중인 배치를 기본 위젯 6개로 바꿉니다. 작업 데이터는 유지됩니다. 배치 저장
            전에는 취소할 수 있어요.
          </p>
          <div className="modal-actions">
            <Button onClick={() => setResetOpen(false)}>취소</Button>
            <Button
              variant="primary"
              onClick={() => {
                dashboard.reset();
                setResetOpen(false);
              }}
            >
              기본 배치 적용
            </Button>
          </div>
        </Modal>
      )}
    </PageScaffold>
  );
}
