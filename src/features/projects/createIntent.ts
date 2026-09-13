import { createBody, type ProjectDraft } from './apiModel';
import type { CreateIntent } from './draftMemory';
export function createIntent(draft: ProjectDraft, now = Date.now()): CreateIntent {
  return Object.freeze({
    key: crypto.randomUUID(),
    body: Object.freeze(createBody(draft)),
    startedAt: now,
  });
}
export function retryBody(intent: CreateIntent, now = Date.now()) {
  if (now - intent.startedAt >= 24 * 60 * 60 * 1000 || now < intent.startedAt)
    throw new Error(
      'Creation replay window expired. Review Projects before abandoning this intent and explicitly creating again.',
    );
  return intent.body;
}
