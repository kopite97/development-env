import type { AuthSession } from './session';
import type { JournalMemory } from '../../features/journal/draftMemory';

export function journalHandoff(session: AuthSession) {
  let identity: string | undefined;
  let memory: JournalMemory = {};
  const update = () => {
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
    } else if (memory.editor) {
      memory.editor.notice =
        'Session rechecked. Review your draft and explicitly retry; a previous request may have completed.';
    }
  };
  session.subscribe(update);
  update();
  return () => memory;
}
