export type User = { id: string; displayName: string };
export type PersonalWorkspace = { id: string; name: string; revision: number };
export type Identity = User & { workspace: PersonalWorkspace };
export type AuthState =
  | { kind: 'checking' }
  | { kind: 'authenticated'; identity: Identity; generation: number }
  | { kind: 'unauthenticated' }
  | { kind: 'disabled' }
  | { kind: 'bootstrap-error'; message: string; requestId?: string };
export function parseIdentity(value: unknown): Identity {
  if (!value || typeof value !== 'object') throw new Error('Invalid identity response');
  const user = value as Record<string, unknown>;
  const workspace = user.workspace;
  const isText = (field: unknown): field is string =>
    typeof field === 'string' && field.trim().length > 0;
  const isId = (field: unknown): field is string =>
    isText(field) && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(field);
  if (!isId(user.id) || !isText(user.displayName) || !workspace || typeof workspace !== 'object')
    throw new Error('Invalid identity response');
  const ws = workspace as Record<string, unknown>;
  if (
    !isId(ws.id) ||
    !isText(ws.name) ||
    typeof ws.revision !== 'number' ||
    !Number.isSafeInteger(ws.revision) ||
    ws.revision < 1
  )
    throw new Error('Invalid workspace response');
  return {
    id: user.id,
    displayName: user.displayName,
    workspace: { id: ws.id, name: ws.name, revision: ws.revision },
  };
}
