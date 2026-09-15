import { count, object, string, timestamp, uuid } from '../../shared/http/validation';

export type CategoryId = string & { readonly categoryId: unique symbol };
export const categoryId = (value: unknown) => uuid(value) as CategoryId;
export type Category = {
  id: CategoryId;
  name: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export function categoryNameError(name: string) {
  const normalized = name.replace(/^[\u0000-\u0020]+|[\u0000-\u0020]+$/g, '').normalize('NFC');
  return !normalized || normalized.length > 100 ? '이름은 1~100자로 입력해 주세요.' : '';
}
export function parseCategory(value: unknown): Category {
  const row = object(value);
  const name = string(row.name),
    revision = count(row.revision);
  if (!revision || categoryNameError(name)) throw new Error('Invalid Category');
  return {
    id: categoryId(row.id),
    name,
    revision,
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
  };
}
export function parseCategories(value: unknown) {
  const row = object(value);
  if (!Array.isArray(row.items)) throw new Error('Invalid Category list');
  const items = row.items.map(parseCategory),
    total = count(row.total);
  if (total !== items.length || new Set(items.map((item) => item.id)).size !== total)
    throw new Error('Incomplete Category collection');
  return { items, total };
}
export type CategoryIntent = { key: string; body: Readonly<{ name: string }>; startedAt: number };
export function categoryIntent(name: string, now = Date.now()): CategoryIntent {
  if (categoryNameError(name)) throw new Error(categoryNameError(name));
  return Object.freeze({ key: crypto.randomUUID(), body: Object.freeze({ name }), startedAt: now });
}
export function categoryRetry(intent: CategoryIntent, now = Date.now()) {
  if (now < intent.startedAt || now - intent.startedAt >= 86400000)
    throw new Error('재시도 기간이 지났습니다. 목록을 확인한 후 생성 요청을 취소해 주세요.');
  return intent.body;
}
export type CategoryMemory = {
  name: string;
  target?: Category;
  mode?: 'delete';
  intent?: CategoryIntent;
  confirmed?: boolean;
  reconcile?: boolean;
  notice?: string;
};
