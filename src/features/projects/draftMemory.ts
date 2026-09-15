import type { ApiProject, ProjectDraft } from './apiModel';
import type { CategoryMemory } from './categoryModel';
export type CreateIntent = {
  endpoint?: '/api/v1/projects' | '/api/v2/projects';
  key: string;
  body: Omit<ReturnType<typeof import('./apiModel').createBody>, 'categoryId'> &
    Partial<Pick<ProjectDraft, 'categoryId'>> & { scope?: 'unity' | 'server' };
  startedAt: number;
};
export type EditorMemory = {
  target: string;
  draft: ProjectDraft;
  baseline?: ApiProject;
  intent?: CreateIntent;
  notice?: string;
  confirmedId?: ApiProject['id'];
};
export type DraftMemory = { editor?: EditorMemory; category?: CategoryMemory };
