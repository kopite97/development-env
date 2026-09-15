import { createBody } from './apiModel';
import type { TaskDraft } from './presentation';
import type { TaskIntent } from './draftMemory';
export function createIntent(draft: TaskDraft, now = Date.now()): TaskIntent {
  return Object.freeze({
    endpoint: '/api/v2/tasks',
    key: crypto.randomUUID(),
    body: Object.freeze(createBody(draft)),
    startedAt: now,
  });
}
export function retryBody(intent: TaskIntent, now = Date.now()) {
  if (now < intent.startedAt || now - intent.startedAt >= 86400000)
    throw new Error(
      '생성 재시도 기간이 지났습니다. 목록에서 생성 여부를 확인한 후 새 작업을 시작해 주세요.',
    );
  return intent.body;
}
