import { ArrowDown, ArrowUp, GripVertical, Settings2, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge, Button } from '../../shared/ui/controls';
import type { Widget } from './model';
import { widgetCatalog as registry } from './widgetCatalog';

type Props = {
  widget: Widget;
  children: ReactNode;
  editing: boolean;
  index: number;
  total: number;
  dragging: boolean;
  onDrag: (id: string | null) => void;
  onDrop: () => void;
  onMove: (offset: number) => void;
  onEdit: () => void;
  onRemove: () => void;
};

export function WidgetFrame({
  widget,
  children,
  editing,
  index,
  total,
  dragging,
  onDrag,
  onDrop,
  onMove,
  onEdit,
  onRemove,
}: Props) {
  const Icon = registry[widget.type].icon;
  return (
    <section
      className={`widget widget-${widget.size} ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => {
        if (editing) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (editing) onDrop();
      }}
    >
      {editing && (
        <div className="widget-edit-controls">
          <button
            className="drag-handle"
            draggable
            aria-label={`${widget.title} 드래그 이동`}
            onDragStart={(e) => {
              onDrag(widget.id);
              e.dataTransfer.setData('text/plain', widget.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => onDrag(null)}
          >
            <GripVertical size={16} />
          </button>
          <span>{index + 1}</span>
          <Button
            variant="ghost"
            aria-label={`${widget.title} 앞으로 이동`}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp size={14} />
          </Button>
          <Button
            variant="ghost"
            aria-label={`${widget.title} 뒤로 이동`}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown size={14} />
          </Button>
          <Button variant="ghost" aria-label={`${widget.title} 설정`} onClick={onEdit}>
            <Settings2 size={14} />
          </Button>
          <Button variant="ghost" aria-label={`${widget.title} 제거`} onClick={onRemove}>
            <Trash2 size={14} />
          </Button>
        </div>
      )}
      <header className="widget-header">
        <div>
          <Icon size={17} />
          <h2>{widget.title}</h2>
        </div>
        <Badge
          tone={
            widget.scope === 'unity' ? 'purple' : widget.scope === 'server' ? 'blue' : 'neutral'
          }
        >
          {widget.scope === 'all' ? '전체' : widget.scope === 'unity' ? 'Unity' : '서버 · 웹'}
        </Badge>
      </header>
      {children}
    </section>
  );
}
