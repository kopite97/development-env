export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected object');
  return value as Record<string, unknown>;
}
export function string(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Expected string');
  return value;
}
export function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid count');
  return value;
}
export function timestamp(value: unknown): string {
  const result = string(value);
  if (!/^\d{4}-\d\d-\d\dT/.test(result) || !Number.isFinite(Date.parse(result)))
    throw new Error('Invalid timestamp');
  return result;
}
export function uuid(value: unknown): string {
  const result = string(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(result))
    throw new Error('Invalid UUID');
  return result;
}
export function oneOf<T extends string>(value: unknown, values: readonly T[]): T {
  if (!values.some((item) => item === value)) throw new Error('Invalid value');
  return value as T;
}
