import { uuid } from '../../shared/http/validation';
import { supportsProject } from './apiModel';
import type { Widget } from './apiModel';
import type { CategoryFilter } from '../projects/categoryFilter';

export function homeProjectId(value: string | null): string | undefined {
  if (value === null) return undefined;
  return uuid(value.toLowerCase());
}

export function homeWidget(widget: Widget, projectId?: string, category?: CategoryFilter): Widget {
  if (!supportsProject(widget.type)) return widget;
  if (projectId)
    return { ...widget, selection: { kind: 'project', projectId }, selectionState: 'valid' };
  if (category)
    return {
      ...widget,
      selection:
        category === 'all' || category === 'uncategorized'
          ? { kind: category }
          : { kind: 'category', categoryId: category },
      selectionState: 'valid',
    };
  return widget;
}
