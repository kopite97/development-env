import { Check, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { scopes, type Scope } from '../projects/scope';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { widgetTypes, type Widget, type WidgetType } from './model';
import { widgetCatalog as registry } from './widgetCatalog';
import { useProjects } from '../projects/ProjectsProvider';
import type { WidgetForm } from './draftMemory';
export function WidgetEditor(props: {
  existing?: Widget;
  onSave: (widget: Widget) => void;
  onClose: () => void;
}) {
  const { projects } = useProjects();
  return <WidgetEditorView {...props} projects={projects} />;
}
export function WidgetEditorView({
  existing,
  onSave,
  onClose,
  projects,
  restored,
  onDraftChange,
  feedback,
  normalizeTitle = (value: string) => value.trim(),
  unknownProjectLabel = '없는 프로젝트',
}: {
  existing?: Widget;
  projects: { id: string; name: string; archived: boolean }[];
  restored?: WidgetForm;
  onDraftChange?: (form: WidgetForm) => void;
  feedback?: ReactNode;
  normalizeTitle?: (value: string) => string;
  unknownProjectLabel?: string;
  onSave: (widget: Widget) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<WidgetType>(restored?.type ?? existing?.type ?? 'overview');
  const [scope, setScope] = useState<Scope>(restored?.scope ?? existing?.scope ?? 'all');
  const [title, setTitle] = useState(restored?.title ?? existing?.title ?? registry.overview.title);
  const [size, setSize] = useState<Widget['size']>(restored?.size ?? existing?.size ?? 'medium');
  const [projectId, setProjectId] = useState(restored?.projectId ?? existing?.projectId ?? '');
  const [limit, setLimit] = useState(restored?.limitText ?? existing?.limit?.toString() ?? '');
  const [id] = useState(() => restored?.id ?? existing?.id ?? crypto.randomUUID());
  useEffect(() => {
    onDraftChange?.({
      id,
      type,
      scope,
      title,
      size,
      ...(projectId ? { projectId } : {}),
      limitText: limit,
    });
  }, [id, type, scope, title, size, projectId, limit, onDraftChange]);
  const supportsProject = ['overview', 'board', 'journal', 'milestone'].includes(type);
  const canDiscard = useUnsavedChanges(
    type !== (existing?.type || 'overview') ||
      scope !== (existing?.scope || 'all') ||
      title !== (existing?.title || registry.overview.title) ||
      size !== (existing?.size || 'medium') ||
      projectId !== (existing?.projectId ?? '') ||
      limit !== (existing?.limit?.toString() ?? ''),
  );
  const close = () => {
    if (canDiscard()) onClose();
  };
  return (
    <Modal title={existing ? '위젯 설정 · 교체' : '나의 홈에 위젯 추가'} onClose={close} wide>
      <p className="modal-intro">필요한 정보를 골라 나에게 맞는 작업실을 만들어 보세요.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id,
            type,
            scope,
            title: normalizeTitle(title) || registry[type].title,
            size,
            ...(supportsProject && projectId ? { projectId } : {}),
            ...(supportsProject && limit ? { limit: Number(limit) } : {}),
          });
        }}
      >
        <div className="widget-catalog">
          {widgetTypes.map((key) => {
            const info = registry[key];
            return (
              <button
                type="button"
                className={`catalog-item ${type === key ? 'selected' : ''}`}
                key={key}
                onClick={() => {
                  setType(key);
                  setTitle(info.title);
                }}
                aria-pressed={type === key}
              >
                <info.icon size={21} />
                {type === key && <Check className="catalog-check" size={16} />}
                <strong>{info.title}</strong>
                <small>{info.description}</small>
              </button>
            );
          })}
        </div>
        <div className="form-grid">
          <Field label="위젯 제목">
            <input maxLength={48} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="표시할 프로젝트 범위">
            <select
              disabled={supportsProject && !!projectId}
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
            >
              {Object.entries(scopes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          {supportsProject && (
            <>
              <Field label="특정 프로젝트">
                <select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setScope('all');
                  }}
                >
                  <option value="">분야 범위 사용</option>
                  {projectId && !projects.some((p) => p.id === projectId) && (
                    <option value={projectId}>{unknownProjectLabel}</option>
                  )}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.archived ? ' (보관)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="표시 개수">
                <input
                  type="number"
                  min={1}
                  max={20}
                  step={1}
                  placeholder="기본값"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </Field>
            </>
          )}
          <Field label="위젯 너비">
            <select value={size} onChange={(e) => setSize(e.target.value as Widget['size'])}>
              <option value="small">작게 · 1칸</option>
              <option value="medium">보통 · 2칸</option>
              <option value="wide">넓게 · 3칸</option>
            </select>
          </Field>
        </div>
        {feedback}
        <div className="modal-actions">
          <Button type="button" onClick={close}>
            취소
          </Button>
          <Button variant="primary" type="submit">
            <Plus size={16} />
            {existing ? '설정 적용' : '위젯 추가'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
