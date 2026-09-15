import { count, object, oneOf, string } from '../../shared/http/validation';
import { widgetTypes, type WidgetType } from './model';
import { parseSelection, type ProjectSelection } from '../projects/categoryFilter';
export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  size: 'small' | 'medium' | 'wide';
  selection: ProjectSelection;
  selectionState?: 'valid' | 'missingCategory';
  limit?: number;
};
export type ApiDashboard = { id: 'home'; schemaVersion: 2; revision: number; widgets: Widget[] };
export type DashboardSave = Omit<ApiDashboard, 'id'>;
export const supportsProject = (type: Widget['type']) => type !== 'deploy';
export function writableWidgets(widgets: Widget[]) {
  return parseWidgets(widgets.map(({ selectionState: _state, ...widget }) => widget));
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error('지원하지 않는 배치 필드입니다.');
}
// Match Java String.trim; ECMAScript trim removes additional Unicode whitespace.
export const dashboardText = (value: string) =>
  value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');
export function parseWidgets(value: unknown, response = false): Widget[] {
  if (!Array.isArray(value)) throw new Error('위젯 목록을 확인해 주세요.');
  const ids = new Set<string>();
  return value.map((raw, index) => {
    const v = object(raw);
    keys(v, [
      'id',
      'type',
      'title',
      'selection',
      'size',
      'limit',
      ...(response ? ['selectionState'] : []),
    ]);
    const id = dashboardText(string(v.id));
    const title = dashboardText(string(v.title));
    if (
      !id ||
      !title ||
      /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]*$/.test(
        id,
      ) ||
      /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]*$/.test(
        title,
      ) ||
      title.length > 48 ||
      ids.has(id)
    )
      throw new Error(`위젯 ${index + 1}: 이름과 중복 ID를 확인해 주세요.`);
    ids.add(id);
    const type = oneOf(v.type, widgetTypes);
    const selection = parseSelection(v.selection);
    const selectionState = response
      ? oneOf(v.selectionState, ['valid', 'missingCategory'] as const)
      : undefined;
    const size = oneOf(v.size, ['small', 'medium', 'wide'] as const);
    const limit = 'limit' in v ? count(v.limit) : undefined;
    if (limit !== undefined && (limit < 1 || limit > 20))
      throw new Error('표시 개수는 1–20이어야 합니다.');
    if (
      (['links', 'deploy'].includes(type) && limit !== undefined) ||
      (type === 'deploy' && selection.kind !== 'all')
    )
      throw new Error('이 위젯은 프로젝트/개수 설정을 지원하지 않습니다.');
    if (response && (v.id !== id || v.title !== title))
      throw new Error('서버 배치 정규화 오류입니다.');
    if (selectionState === 'missingCategory' && selection.kind !== 'category')
      throw new Error('Invalid missing Category state');
    return {
      id,
      type,
      title,
      selection,
      ...(selectionState ? { selectionState } : {}),
      size,
      ...(limit !== undefined ? { limit } : {}),
    };
  });
}
export function parseDashboard(value: unknown): ApiDashboard {
  const v = object(value);
  keys(v, ['id', 'schemaVersion', 'revision', 'widgets']);
  if (v.id !== 'home' || v.schemaVersion !== 2)
    throw new Error('지원하지 않는 Dashboard 형식입니다.');
  return {
    id: 'home',
    schemaVersion: 2,
    revision: count(v.revision),
    widgets: parseWidgets(v.widgets, true),
  };
}
export function saveBody(revision: number, widgets: Widget[]): DashboardSave {
  return { schemaVersion: 2, revision: count(revision), widgets: writableWidgets(widgets) };
}
export const sameWidgets = (a: Widget[], b: Widget[]) =>
  JSON.stringify(writableWidgets(a)) === JSON.stringify(writableWidgets(b));
// Explicit reset only. Reads must always use GET, including virtual revision-zero defaults.
export function serverDefaultWidgets(): Widget[] {
  return parseWidgets([
    {
      id: 'home-overview',
      type: 'overview',
      title: '프로젝트 개요',
      selection: { kind: 'all' },
      size: 'wide',
    },
    {
      id: 'home-board',
      type: 'board',
      title: '작업 보드',
      selection: { kind: 'all' },
      size: 'wide',
    },
    {
      id: 'home-deploy',
      type: 'deploy',
      title: '운영',
      selection: { kind: 'all' },
      size: 'medium',
    },
    {
      id: 'home-links',
      type: 'links',
      title: '바로가기',
      selection: { kind: 'all' },
      size: 'small',
    },
    {
      id: 'home-journal',
      type: 'journal',
      title: '개발 일지',
      selection: { kind: 'all' },
      size: 'medium',
    },
    {
      id: 'home-milestone',
      type: 'milestone',
      title: '마일스톤',
      selection: { kind: 'all' },
      size: 'medium',
    },
  ]);
}
