import type { TaskMemory } from '../../features/tasks/draftMemory';
import type { AuthSession } from './session';
export function taskHandoff(session: AuthSession) {
  let identity: string | undefined;
  let memory: TaskMemory = {};
  session.subscribe(() => {
    const { state, busy } = session.getSnapshot();
    if (state.kind === 'authenticated' && !busy) {
      const next = state.identity.id + ':' + state.identity.workspace.id;
      if (identity !== next) {
        memory.editor = undefined;
        memory = {};
      }
      identity = next;
    } else if (busy || state.kind === 'unauthenticated' || state.kind === 'disabled') {
      memory.editor = undefined;
      memory = {};
      identity = undefined;
    } else if (memory.editor)
      memory.editor.notice =
        '세션을 다시 확인했습니다. 이전 요청이 저장되었을 수 있으므로 입력 내용을 검토하고 명시적으로 다시 시도해 주세요.';
  });
  return () => memory;
}
