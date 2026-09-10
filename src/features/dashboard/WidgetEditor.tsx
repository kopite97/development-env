import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button, Field, Modal } from '../../shared/ui/controls';
import { scopes, type Scope } from '../projects/scope';
import { useUnsavedChanges } from '../../shared/hooks/useUnsavedChanges';
import { widgetTypes, type Widget, type WidgetType } from './model';
import { widgetCatalog as registry } from './widgetCatalog';
export function WidgetEditor({
  existing,
  onSave,
  onClose,
}: {
  existing?: Widget;
  onSave: (widget: Widget) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<WidgetType>(existing?.type || 'overview');
  const [scope, setScope] = useState<Scope>(existing?.scope || 'all');
  const [title, setTitle] = useState(existing?.title || registry.overview.title);
  const [size, setSize] = useState<Widget['size']>(existing?.size || 'medium');
  const canDiscard = useUnsavedChanges(
    type !== (existing?.type || 'overview') ||
      scope !== (existing?.scope || 'all') ||
      title !== (existing?.title || registry.overview.title) ||
      size !== (existing?.size || 'medium'),
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
            id: existing?.id || crypto.randomUUID(),
            type,
            scope,
            title: title.trim() || registry[type].title,
            size,
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
            <select value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
              {Object.entries(scopes).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="위젯 너비">
            <select value={size} onChange={(e) => setSize(e.target.value as Widget['size'])}>
              <option value="small">작게 · 1칸</option>
              <option value="medium">보통 · 2칸</option>
              <option value="wide">넓게 · 3칸</option>
            </select>
          </Field>
        </div>
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
