/** Provider-independent inputs shared by the legacy and authenticated views. */
export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPresentation = {
  id: string;
  title: string;
  project: string;
  scope: 'unity' | 'server';
  status: TaskStatus;
  priority: '높음' | '보통';
  tag: string;
  projectId?: string;
  description?: string;
  deletedAt?: string | null;
};
export type TaskDraft = {
  title: string;
  projectId: string;
  description: string;
  status: TaskStatus;
  priority: TaskPresentation['priority'];
  tag: string;
};
export type TaskProjectOption = { id: string; name: string; archived: boolean };
export type TaskSaveResult = { ok: true } | { ok: false; message: string };
