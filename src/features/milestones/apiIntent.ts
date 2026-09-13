import { createBody, type MilestoneDraft } from './apiModel';
export type MilestoneCreateIntent = {
  readonly key: string;
  readonly body: Readonly<ReturnType<typeof createBody>>;
  readonly startedAt: number;
};
export function createIntent(draft: MilestoneDraft, now = Date.now()): MilestoneCreateIntent {
  return Object.freeze({
    key: crypto.randomUUID(),
    body: Object.freeze(createBody(draft)),
    startedAt: now,
  });
}
export function retryBody(intent: MilestoneCreateIntent, now = Date.now()) {
  if (now < intent.startedAt || now - intent.startedAt >= 86400000)
    throw new Error(
      '생성 재시도 기간이 지났습니다. 중복 방지를 보장할 수 없어 자동 재시도하지 않습니다. 기존 요청을 검토해 주세요.',
    );
  return intent.body;
}
