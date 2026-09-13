import type { ApiProject, ProjectDraft } from './apiModel';
export type CreateIntent = {
  key: string;
  body: ReturnType<typeof import('./apiModel').createBody>;
  startedAt: number;
};
export type EditorMemory = {
  target: string;
  draft: ProjectDraft;
  baseline?: ApiProject;
  intent?: CreateIntent;
  notice?: string;
};
export type DraftMemory = { editor?: EditorMemory };
