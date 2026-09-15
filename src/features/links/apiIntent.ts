import { createBody, type LinkDraft } from './apiModel';
export type LinkIntent = {
  readonly endpoint?: '/api/v1/links' | '/api/v2/links';
  readonly key: string;
  readonly body: Readonly<LinkDraft>;
  readonly startedAt: number;
};
export function createIntent(draft: LinkDraft, now = Date.now()): LinkIntent {
  return Object.freeze({
    endpoint: '/api/v2/links',
    key: crypto.randomUUID(),
    body: Object.freeze(createBody(draft)),
    startedAt: now,
  });
}
export function retryBody(intent: LinkIntent, now = Date.now()) {
  if (now < intent.startedAt || now - intent.startedAt >= 86400000)
    throw new Error(
      '생성 재시도 기간이 지났습니다. 기존 요청을 검토해 주세요. 중복 방지를 보장할 수 없습니다.',
    );
  return intent.body;
}
