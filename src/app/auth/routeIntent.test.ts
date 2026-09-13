import { expect, it } from 'vitest';
import { consumeLoginError, loginUrl, safeReturnTo } from './routeIntent';
it('encodes deep links and retains supported route query state', () => {
  const intent = '/projects/abc?scope=server&q=two+words&archived=true';
  expect(safeReturnTo(intent)).toBe(intent);
  expect(loginUrl(intent)).toBe('/api/v1/auth/login?returnTo=' + encodeURIComponent(intent));
});
it.each([
  'https://remote.example',
  '//remote.example',
  '/api/v1/me',
  '/oauth2/authorization/google',
  '/%2fremote',
  '/%252fremote',
  '/projects/%2e%2e',
  '/projects/../tasks',
  '/tasks?q=https%3A%2F%2Fremote.example',
  '/tasks?q=%0d%0a',
  '/tasks#fragment',
  '/tasks?q=%',
])('rejects unsafe intent %s', (candidate) => {
  expect(safeReturnTo(candidate)).toBe('/');
});
it('consumes only the fixed failure parameter without losing route state', () => {
  const result = consumeLoginError(
    new URL(
      'https://local.invalid/projects?q=work&authError=login_failed&scope=all&other=keep#local',
    ),
  );
  expect(result.failed).toBe(true);
  expect(result.url.search).toBe('?q=work&scope=all&other=keep');
  expect(result.url.hash).toBe('#local');
  expect(safeReturnTo(result.url.pathname + result.url.search)).toBe('/projects?scope=all&q=work');
  expect(consumeLoginError(new URL('https://local.invalid/?authError=arbitrary')).failed).toBe(
    false,
  );
});
