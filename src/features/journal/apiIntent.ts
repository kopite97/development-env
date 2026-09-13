import { createBody, type JournalDraft } from './apiModel';

export type JournalCreateIntent = {
  readonly key: string;
  readonly body: Readonly<ReturnType<typeof createBody>>;
  readonly startedAt: number;
};

export function createIntent(draft: JournalDraft, now = Date.now()): JournalCreateIntent {
  return Object.freeze({
    key: crypto.randomUUID(),
    body: Object.freeze(createBody(draft)),
    startedAt: now,
  });
}

export function retryBody(intent: JournalCreateIntent, now = Date.now()) {
  if (now < intent.startedAt || now - intent.startedAt >= 86400000)
    throw new Error(
      '생성 재시도 기간이 지났습니다. 목록에서 생성 여부를 확인한 후 새 일지를 시작해 주세요.',
    );
  return intent.body;
}
