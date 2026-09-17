import { count, object, oneOf, string, timestamp, uuid } from '../../shared/http/validation';
import { widgetTypes, type WidgetType } from './model';
import { parseSelection, type ProjectSelection } from '../projects/categoryFilter';

export type WidgetSize = 'small' | 'medium' | 'wide';
export type WidgetReferenceState = 'valid' | 'missingCategory';

/** Editable Home representation. Size is supplied by a Dashboard placement. */
export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  size: WidgetSize;
  selection: ProjectSelection;
  selectionState?: WidgetReferenceState;
  referenceState?: WidgetReferenceState;
  limit?: number;
  revision?: number;
  configVersion?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type Placement = { id?: string; widgetId: string; size: WidgetSize };
export type ApiDashboard = {
  id: 'home';
  schemaVersion: 3;
  initialized: boolean;
  layoutRevision: number;
  placements: Placement[];
  widgets: Widget[];
  unplacedWidgets?: Widget[];
};
export type DashboardSave = { layoutRevision: number; widgets: Widget[] };
export type WidgetConfigBody = {
  configVersion: number;
  config: { selection: ProjectSelection; limit?: number };
};
export type WidgetCreateBody = WidgetConfigBody & { type: WidgetType; title: string };
export type WidgetUpdateBody = WidgetConfigBody & { revision: number; title: string };
export type WidgetDataEnvelope = {
  widgetId: string;
  type: WidgetType;
  configRevision: number;
  configVersion: number;
  payloadVersion: number;
  availability: 'ready' | 'empty' | 'unavailable';
  freshness: 'current' | 'stale' | 'unknown';
  readAt: string;
  sourceObservedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  data: unknown;
  page: { total: number; nextCursor: string | null } | null;
  problem: { code: string; retryable: boolean } | null;
};

export const supportsProject = (type: Widget['type']) => type !== 'deploy';

function keys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error('지원하지 않는 위젯 필드입니다.');
}

// Match Java String.trim; ECMAScript trim removes additional Unicode whitespace.
export const dashboardText = (value: string) =>
  value.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '');

function nonBlank(value: string, message: string) {
  if (
    !value ||
    /^[\u0009-\u000d\u001c-\u0020\u1680\u2000-\u2006\u2008-\u200a\u2028\u2029\u205f\u3000]*$/.test(
      value,
    )
  )
    throw new Error(message);
  return value;
}

function parseLimit(value: unknown, type: WidgetType) {
  if (value === undefined) return undefined;
  const limit = count(value);
  if (limit < 1 || limit > 20) throw new Error('표시 개수는 1–20이어야 합니다.');
  if (type === 'links' || type === 'deploy')
    throw new Error('이 위젯은 표시 개수 설정을 지원하지 않습니다.');
  return limit;
}

function parseConfig(
  value: unknown,
  type: WidgetType,
): { selection: ProjectSelection; limit?: number } {
  const config = object(value);
  keys(config, ['selection', 'limit']);
  const selection = parseSelection(config.selection);
  const limit = parseLimit(config.limit, type);
  if (type === 'deploy' && selection.kind !== 'all')
    throw new Error('운영 위젯은 전체 프로젝트 범위만 지원합니다.');
  return { selection, ...(limit === undefined ? {} : { limit }) };
}

function parseType(value: unknown) {
  return oneOf(value, widgetTypes);
}

function parseTitle(value: unknown, label = '위젯 제목') {
  const title = nonBlank(dashboardText(string(value)), `${label}을 확인해 주세요.`);
  if (title.length > 48) throw new Error(`${label}은 48자 이하여야 합니다.`);
  return title;
}

/** Parse the editor-shaped value used for local drafts. */
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
      ...(response ? ['selectionState', 'referenceState'] : []),
    ]);
    const id = nonBlank(dashboardText(string(v.id)), `위젯 ${index + 1} ID를 확인해 주세요.`);
    const title = parseTitle(v.title, `위젯 ${index + 1} 제목`);
    if (ids.has(id)) throw new Error(`위젯 ${index + 1}: 중복 ID를 확인해 주세요.`);
    ids.add(id);
    const type = parseType(v.type);
    const { selection, limit } = parseConfig(
      { selection: v.selection, ...(v.limit === undefined ? {} : { limit: v.limit }) },
      type,
    );
    const referenceState = response
      ? oneOf(v.referenceState ?? v.selectionState, ['valid', 'missingCategory'] as const)
      : undefined;
    if (referenceState === 'missingCategory' && selection.kind !== 'category')
      throw new Error('Invalid missing Category state');
    const size = oneOf(v.size, ['small', 'medium', 'wide'] as const);
    return {
      id,
      type,
      title,
      selection,
      size,
      ...(referenceState ? { referenceState, selectionState: referenceState } : {}),
      ...(limit === undefined ? {} : { limit }),
    };
  });
}

export function parseWidgetSnapshot(value: unknown): Widget {
  const v = object(value);
  keys(v, [
    'id',
    'type',
    'title',
    'configVersion',
    'revision',
    'config',
    'referenceState',
    'createdAt',
    'updatedAt',
  ]);
  const id = uuid(v.id);
  const type = parseType(v.type);
  const title = parseTitle(v.title);
  const configVersion = count(v.configVersion);
  if (configVersion < 1) throw new Error('지원하지 않는 Widget 설정 버전입니다.');
  const revision = count(v.revision);
  if (revision < 1) throw new Error('Invalid Widget revision');
  const referenceState = oneOf(v.referenceState, ['valid', 'missingCategory'] as const);
  const config = parseConfig(v.config, type);
  if (referenceState === 'missingCategory' && config.selection.kind !== 'category')
    throw new Error('Invalid missing Category state');
  const createdAt = timestamp(v.createdAt);
  const updatedAt = timestamp(v.updatedAt);
  return {
    id,
    type,
    title,
    size: 'medium',
    selection: config.selection,
    ...(config.limit === undefined ? {} : { limit: config.limit }),
    referenceState,
    selectionState: referenceState,
    revision,
    configVersion,
    createdAt,
    updatedAt,
  };
}

function parsePlacement(value: unknown): Placement {
  const v = object(value);
  keys(v, ['id', 'widgetId', 'size']);
  const id = uuid(v.id);
  const widgetId = uuid(v.widgetId);
  const size = oneOf(v.size, ['small', 'medium', 'wide'] as const);
  return { id, widgetId, size };
}

export function parseDashboard(value: unknown): ApiDashboard {
  const v = object(value);
  keys(v, ['id', 'schemaVersion', 'initialized', 'layoutRevision', 'placements', 'widgets']);
  if (v.id !== 'home' || v.schemaVersion !== 3)
    throw new Error('지원하지 않는 Dashboard 형식입니다.');
  const initialized = v.initialized;
  if (typeof initialized !== 'boolean') throw new Error('Invalid Dashboard initialization state');
  const layoutRevision = count(v.layoutRevision);
  if (!Array.isArray(v.placements) || !Array.isArray(v.widgets))
    throw new Error('Dashboard 배치를 확인해 주세요.');
  if (!initialized && (layoutRevision !== 0 || v.placements.length || v.widgets.length))
    throw new Error('미초기화 Dashboard 응답이 올바르지 않습니다.');
  if (initialized && layoutRevision < 1)
    throw new Error('초기화된 Dashboard revision이 올바르지 않습니다.');
  const snapshots = v.widgets.map(parseWidgetSnapshot);
  const byId = new Map(snapshots.map((widget) => [widget.id, widget]));
  const placements = v.placements.map(parsePlacement);
  const placementIds = placements
    .map((placement) => placement.id)
    .filter((id): id is string => !!id);
  if (new Set(placementIds).size !== placementIds.length) throw new Error('중복된 배치 ID입니다.');
  const placed = new Set<string>();
  const widgets = placements.map((placement) => {
    if (placed.has(placement.widgetId)) throw new Error('중복된 Widget 배치입니다.');
    placed.add(placement.widgetId);
    const widget = byId.get(placement.widgetId);
    if (!widget) throw new Error('배치된 Widget 설정을 찾을 수 없습니다.');
    return { ...widget, size: placement.size };
  });
  return {
    id: 'home',
    schemaVersion: 3,
    initialized,
    layoutRevision,
    placements,
    widgets,
    unplacedWidgets: snapshots.filter((widget) => !placed.has(widget.id)),
  };
}

export function writableWidgets(widgets: Widget[]) {
  return widgets.map(({ id, type, title, selection, size, limit }) => ({
    id,
    type,
    title: dashboardText(title),
    selection,
    size,
    ...(limit === undefined ? {} : { limit }),
  }));
}

export function widgetConfigBody(
  widget: Widget,
  configVersion = widget.configVersion ?? 1,
): WidgetConfigBody {
  return {
    configVersion,
    config: {
      selection: widget.selection,
      ...(widget.limit === undefined ? {} : { limit: widget.limit }),
    },
  };
}

export function createWidgetBody(widget: Widget): WidgetCreateBody {
  return { type: widget.type, title: dashboardText(widget.title), ...widgetConfigBody(widget) };
}

export function updateWidgetBody(widget: Widget): WidgetUpdateBody {
  if (widget.revision === undefined) throw new Error('Widget revision이 없습니다.');
  return {
    revision: widget.revision,
    title: dashboardText(widget.title),
    ...widgetConfigBody(widget),
  };
}

export function saveBody(layoutRevision: number, widgets: Widget[]) {
  const revision = count(layoutRevision);
  return {
    schemaVersion: 3 as const,
    layoutRevision: revision,
    placements: widgets.map(({ id: widgetId, size }) => ({ widgetId, size })),
  };
}

export const sameWidgets = (a: Widget[], b: Widget[]) =>
  JSON.stringify(writableWidgets(a)) === JSON.stringify(writableWidgets(b));

/** Explicit initialization template. Server IDs are allocated by the backend. */
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
