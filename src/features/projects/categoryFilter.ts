import { object, uuid } from '../../shared/http/validation';

export type CategoryFilter =
  'all' | 'uncategorized' | `${string}-${string}-${string}-${string}-${string}`;
export type ProjectSelection =
  | { kind: 'all' }
  | { kind: 'uncategorized' }
  | { kind: 'project'; projectId: string }
  | { kind: 'category'; categoryId: string };
export type CategoryOption = { id: string; name: string };
export function selectionLabel(selection: ProjectSelection, categories: readonly CategoryOption[]) {
  if (selection.kind === 'category')
    return (
      categories.find((item) => item.id === selection.categoryId)?.name ??
      '사용할 수 없는 개발 분야'
    );
  if (selection.kind === 'project') return '특정 프로젝트';
  return selection.kind === 'uncategorized' ? '미분류' : '전체';
}

function canonicalId(value: unknown) {
  return uuid(typeof value === 'string' ? value.toLowerCase() : value);
}

export function parseCategoryFilter(value: unknown): CategoryFilter {
  if (value === 'all' || value === 'uncategorized') return value;
  return canonicalId(value) as CategoryFilter;
}

export function parseSelection(value: unknown): ProjectSelection {
  const row = object(value);
  const keys = Object.keys(row);
  if ((row.kind === 'all' || row.kind === 'uncategorized') && keys.length === 1)
    return { kind: row.kind };
  if (row.kind === 'project' && keys.length === 2 && keys.includes('projectId'))
    return { kind: 'project', projectId: canonicalId(row.projectId) };
  if (row.kind === 'category' && keys.length === 2 && keys.includes('categoryId'))
    return { kind: 'category', categoryId: canonicalId(row.categoryId) };
  throw new Error('Invalid selection');
}

export function selectionFilter(selection: ProjectSelection): {
  category: CategoryFilter;
  projectId?: string;
} {
  switch (selection.kind) {
    case 'project':
      return { category: 'all', projectId: selection.projectId };
    case 'category':
      return { category: parseCategoryFilter(selection.categoryId) };
    default:
      return { category: selection.kind };
  }
}

export function readCategoryFilter(params: URLSearchParams): CategoryFilter {
  if (params.getAll('category').length > 1 || params.getAll('scope').length > 1)
    throw new Error('분류를 하나만 선택해 주세요.');
  const scope = params.get('scope');
  if (scope !== null && (scope !== 'all' || params.has('category')))
    throw new Error('이전 개발 범위 링크입니다. 개발 분야를 다시 선택해 주세요.');
  return parseCategoryFilter(params.get('category') ?? 'all');
}

export function readProjectFilter(params: URLSearchParams): string | undefined {
  if (params.getAll('projectId').length > 1) throw new Error('프로젝트를 하나만 선택해 주세요.');
  return params.has('projectId') ? canonicalId(params.get('projectId')) : undefined;
}
