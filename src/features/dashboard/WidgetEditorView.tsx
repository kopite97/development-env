import { Check, Plus } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { scopes, type Scope } from '../projects/scope';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { widgetTypes, type Widget, type WidgetType } from './model';
import { widgetCatalog as registry } from './widgetCatalog';
import {
  parseCategoryFilter,
  type CategoryOption,
  type ProjectSelection,
} from '../projects/categoryFilter';
type ViewWidget = Omit<Widget, 'scope'> & { scope?: Scope; selection?: ProjectSelection };
type WidgetForm = Omit<ViewWidget, 'limit'> & { limitText: string };
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
  typeImmutable = false,
  categories,
}: {
  existing?: ViewWidget;
  categories?: readonly CategoryOption[];
  projects: { id: string; name: string; archived: boolean }[];
  restored?: WidgetForm;
  onDraftChange?: (form: WidgetForm) => void;
  feedback?: ReactNode;
  normalizeTitle?: (value: string) => string;
  unknownProjectLabel?: string;
  typeImmutable?: boolean;
  onSave: (widget: ViewWidget) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<WidgetType>(restored?.type ?? existing?.type ?? 'overview');
  const [scope, setScope] = useState<Scope>(restored?.scope ?? existing?.scope ?? 'all');
  const [title, setTitle] = useState(restored?.title ?? existing?.title ?? registry.overview.title);
  const [size, setSize] = useState<Widget['size']>(restored?.size ?? existing?.size ?? 'medium');
  const initialSelection = restored?.selection ?? existing?.selection;
  const [projectId, setProjectId] = useState(
    initialSelection?.kind === 'project'
      ? initialSelection.projectId
      : (restored?.projectId ?? existing?.projectId ?? ''),
  );
  const [category, setCategory] = useState(
    initialSelection?.kind === 'category'
      ? initialSelection.categoryId
      : initialSelection?.kind === 'uncategorized'
        ? 'uncategorized'
        : 'all',
  );
  const selection: ProjectSelection =
    type === 'deploy'
      ? { kind: 'all' }
      : projectId
        ? { kind: 'project', projectId }
        : category === 'all' || category === 'uncategorized'
          ? { kind: category }
          : { kind: 'category', categoryId: category };
  const [limit, setLimit] = useState(restored?.limitText ?? existing?.limit?.toString() ?? '');
  const [id] = useState(() => restored?.id ?? existing?.id ?? crypto.randomUUID());
  useEffect(() => {
    onDraftChange?.({
      id,
      type,
      ...(categories ? { selection } : { scope }),
      title,
      size,
      ...(!categories && projectId ? { projectId } : {}),
      limitText: limit,
    });
  }, [id, type, scope, title, size, projectId, category, limit, onDraftChange, categories]);
  const supportsProject = categories
    ? type !== 'deploy'
    : ['overview', 'board', 'journal', 'milestone'].includes(type);
  const canDiscard = useUnsavedChanges(
    type !== (existing?.type || 'overview') ||
      scope !== (existing?.scope || 'all') ||
      title !== (existing?.title || registry.overview.title) ||
      size !== (existing?.size || 'medium') ||
      projectId !== (existing?.projectId ?? '') ||
      limit !== (existing?.limit?.toString() ?? '') ||
      (categories !== undefined &&
        JSON.stringify(selection) !== JSON.stringify(existing?.selection ?? { kind: 'all' })),
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
            ...(categories ? { selection } : { scope }),
            title: normalizeTitle(title) || registry[type].title,
            size,
            ...(!categories && supportsProject && projectId ? { projectId } : {}),
            ...(supportsProject && type !== 'links' && limit ? { limit: Number(limit) } : {}),
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
                disabled={typeImmutable && !!existing}
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
          {categories ? (
            <Field label="개발 분야">
              <select
                aria-label="위젯 개발 분야"
                value={category}
                disabled={!!projectId || type === 'deploy'}
                onChange={(e) => setCategory(parseCategoryFilter(e.target.value))}
              >
                <option value="all">전체 프로젝트</option>
                <option value="uncategorized">미분류</option>
                {category !== 'all' &&
                  category !== 'uncategorized' &&
                  !categories.some((item) => item.id === category) && (
                    <option value={category}>사용할 수 없는 개발 분야</option>
                  )}
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
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
          )}
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
              {type !== 'links' && (
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
              )}
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
