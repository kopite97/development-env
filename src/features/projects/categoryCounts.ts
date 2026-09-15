import { count, object, uuid } from '../../shared/http/validation';
export function parseCategoryCounts(value: unknown) {
  const row = object(value),
    totals = object(row.totals);
  if (!Array.isArray(row.items)) throw new Error('Invalid Category counts');
  const items = row.items.map((value) => {
    const item = object(value);
    return {
      categoryId: item.categoryId === null ? null : uuid(item.categoryId),
      active: count(item.active),
      archived: count(item.archived),
    };
  });
  if (
    new Set(items.map((item) => item.categoryId)).size !== items.length ||
    !items.some((item) => item.categoryId === null)
  )
    throw new Error('Invalid Category buckets');
  const result = {
    items,
    totals: { active: count(totals.active), archived: count(totals.archived) },
  };
  for (const field of ['active', 'archived'] as const)
    if (items.reduce((sum, item) => sum + item[field], 0) !== result.totals[field])
      throw new Error('Invalid Category total');
  return result;
}
