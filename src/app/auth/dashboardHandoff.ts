import type { AuthSession } from './session';
import type { DashboardMemory } from '../../features/dashboard/draftMemory';
import type { TaskMemory } from '../../features/tasks/draftMemory';
export type HomeMemory = DashboardMemory & { tasks: Record<string, TaskMemory> };
export function dashboardHandoff(session: AuthSession) {
  let identity: string | undefined;
  let memory: HomeMemory = { tasks: {} };
  const clear = () => {
    memory.editor = undefined;
    for (const task of Object.values(memory.tasks)) task.editor = undefined;
    memory.tasks = {};
    memory = { tasks: {} };
  };
  const update = () => {
    const { state, busy } = session.getSnapshot();
    if (state.kind === 'authenticated' && !busy) {
      const next = state.identity.id + ':' + state.identity.workspace.id;
      if (identity !== next) clear();
      identity = next;
    } else if (busy || state.kind === 'unauthenticated' || state.kind === 'disabled') {
      clear();
      identity = undefined;
    } else {
      if (memory.editor) {
        memory.editor.notice =
          '세션을 다시 확인했습니다. 초안을 검토해 주세요. 이전 저장이 완료되었을 수 있습니다.';
        if (memory.editor.submitted) memory.editor.review = true;
      }
      for (const task of Object.values(memory.tasks)) {
        if (task.editor)
          task.editor.notice =
            '세션을 다시 확인했습니다. 이전 요청이 저장되었을 수 있으므로 입력 내용을 검토하고 명시적으로 다시 시도해 주세요.';
      }
    }
  };
  session.subscribe(update);
  update();
  return () => memory;
}
