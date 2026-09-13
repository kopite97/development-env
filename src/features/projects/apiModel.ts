import { count, object, oneOf, string, timestamp, uuid } from '../../shared/http/validation';

export type ServerProjectId = string & { readonly serverProjectId: unique symbol };
export type ProjectScope = 'unity' | 'server';
export type ProjectStatus = 'active' | 'archived';
export type ProjectDraft = {
  name: string;
  subtitle: string;
  scope: ProjectScope;
  stack: string;
  progress: number;
  milestone: string;
  repositoryUrl: string;
};
export type ApiProject = Omit<ProjectDraft, 'milestone'> & {
  id: ServerProjectId;
  revision: number;
  createdAt: string;
  updatedAt: string;
  currentMilestone: string;
  status: ProjectStatus;
  colorToken: string;
};
export const serverProjectId = (value: unknown) => uuid(value) as ServerProjectId;
export function parseProject(value: unknown): ApiProject {
  const row = object(value);
  const revision = count(row.revision);
  if (
    !revision ||
    typeof row.progress !== 'number' ||
    !Number.isFinite(row.progress) ||
    row.progress < 0 ||
    row.progress > 100
  )
    throw new Error('Invalid Project');
  const colorToken = string(row.colorToken);
  if (!colorToken) throw new Error('Missing color token');
  return {
    id: serverProjectId(row.id),
    revision,
    createdAt: timestamp(row.createdAt),
    updatedAt: timestamp(row.updatedAt),
    name: string(row.name),
    subtitle: string(row.subtitle),
    scope: oneOf(row.scope, ['unity', 'server']),
    stack: string(row.stack),
    progress: row.progress,
    currentMilestone: string(row.currentMilestone),
    repositoryUrl: string(row.repositoryUrl),
    status: oneOf(row.status, ['active', 'archived']),
    colorToken,
  };
}
export const presentation = (project: ApiProject) => ({
  milestone: project.currentMilestone,
  archived: project.status === 'archived',
  color:
    project.colorToken === 'unity' ? 'forest' : project.colorToken === 'server' ? 'api' : 'neutral',
});
export function projectDraft(project?: ApiProject): ProjectDraft {
  return project
    ? {
        name: project.name,
        subtitle: project.subtitle,
        scope: project.scope,
        stack: project.stack,
        progress: project.progress,
        milestone: project.currentMilestone,
        repositoryUrl: project.repositoryUrl,
      }
    : {
        name: '',
        subtitle: '',
        scope: 'unity',
        stack: '',
        progress: 0,
        milestone: '',
        repositoryUrl: '',
      };
}
export function validateDraft(draft: ProjectDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [key, maximum] of [
    ['name', 100],
    ['stack', 200],
  ] as const)
    if (!draft[key].trim() || draft[key].trim().length > maximum)
      errors[key] = `Required; maximum ${maximum} characters.`;
  if (draft.subtitle.length > 4000) errors.subtitle = 'Maximum 4000 characters.';
  if (draft.milestone.length > 200) errors.milestone = 'Maximum 200 characters.';
  if (!Number.isFinite(draft.progress) || draft.progress < 0 || draft.progress > 100)
    errors.progress = 'Enter a percentage from 0 to 100.';
  const url = draft.repositoryUrl.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || url.length > 2000)
        throw new Error();
    } catch {
      errors.repositoryUrl = 'Enter an absolute HTTP or HTTPS URL (maximum 2000 characters).';
    }
  }
  return errors;
}
export function createBody(draft: ProjectDraft) {
  if (Object.keys(validateDraft(draft)).length) throw new Error('Invalid draft');
  return {
    name: draft.name,
    subtitle: draft.subtitle,
    scope: draft.scope,
    stack: draft.stack,
    progress: draft.progress,
    currentMilestone: draft.milestone,
    repositoryUrl: draft.repositoryUrl,
  };
}
export function patchBody(baseline: ApiProject, draft: ProjectDraft) {
  const before = createBody(projectDraft(baseline));
  const after = createBody(draft);
  const changes: Record<string, string | number> = { revision: baseline.revision };
  for (const key of Object.keys(after) as (keyof typeof after)[])
    if (after[key] !== before[key]) changes[key] = after[key];
  return changes;
}
export type ProjectPage = { items: ApiProject[]; total: number; nextCursor: string | null };
export function parseProjectPage(value: unknown): ProjectPage {
  const row = object(value);
  if (!Array.isArray(row.items)) throw new Error('Invalid page');
  const nextCursor = row.nextCursor === null ? null : string(row.nextCursor);
  if (nextCursor === '') throw new Error('Empty cursor');
  return { items: row.items.map(parseProject), total: count(row.total), nextCursor };
}
