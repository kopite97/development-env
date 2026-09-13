import type { AuthSession } from './session';

export function connectAuthHints(session: AuthSession): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel('devspace-auth');
  } catch {
    return () => {};
  }
  channel.onmessage = (event) => {
    if (event.data === 'changed') session.receiveHint();
  };
  session.setNotifier(() => {
    try {
      channel.postMessage('changed');
    } catch {
      /* Resumption still verifies cookies. */
    }
  });
  return () => {
    session.setNotifier(() => {});
    channel.close();
  };
}
