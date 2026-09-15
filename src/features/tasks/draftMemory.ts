import type { ApiTask, createBody } from './apiModel';
import type { TaskDraft } from './presentation';
export type TaskIntent = {
  readonly endpoint?: '/api/v1/tasks' | '/api/v2/tasks';
  readonly key: string;
  readonly body: Readonly<ReturnType<typeof createBody>>;
  readonly startedAt: number;
};
export type TaskEditorMemory = {
  target: string;
  draft: TaskDraft;
  baseline?: ApiTask;
  intent?: TaskIntent;
  notice?: string;
};
export type TaskMemory = { editor?: TaskEditorMemory };
