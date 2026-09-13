import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export async function validateLinks({ page, context, origin, sql, output }) {
  const contract = await (await context.request.get('http://127.0.0.1:18080/v3/api-docs')).json();
  const paths = Object.fromEntries(
    Object.entries(contract.paths).filter(([p]) => p.startsWith('/api/v1/links')),
  );
  assert(
    paths['/api/v1/links'].post.parameters.some((p) => p.name === 'Idempotency-Key' && p.required),
  );
  assert.equal(contract.components.schemas.LinkListResponse.properties.nextCursor.type, 'null');
  fs.writeFileSync(
    path.join(output, 'link-contract.json'),
    JSON.stringify(
      {
        paths,
        schemas: Object.fromEntries(
          Object.entries(contract.components.schemas).filter(([k]) => k.includes('Link')),
        ),
      },
      null,
      2,
    ),
  );
  const token = (await (await context.request.get(origin + '/api/v1/auth/csrf')).json()).csrfToken;
  const send = async (method, p, data, status = 200, key) => {
    const response = await context.request.fetch(origin + p, {
      method,
      headers: {
        Origin: origin,
        'X-CSRF-Token': token,
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(data === undefined ? {} : { data }),
    });
    assert.equal(response.status(), status, method + ' ' + p + ' ' + (await response.text()));
    return response.json();
  };
  const base = '/api/v1/links';
  const get = () => send('GET', base + '?scope=all&query=');
  let list = await get();
  assert.equal(list.total, 0);
  assert.equal(list.collectionRevision, 0);
  assert.equal(list.nextCursor, null);
  list = await send('PUT', base + '/order', { collectionRevision: 0, ids: [] });
  assert.equal(list.collectionRevision, 1);
  const key = crypto.randomUUID();
  const body = {
    label: 'GitHub',
    description: '  코드와 저장소  ',
    url: 'https://github.com',
    scope: 'all',
  };
  const original = await send('POST', base, body, 201, key);
  const unity = await send(
    'POST',
    base,
    {
      label: 'Unity Documentation',
      description: '게임 개발 레퍼런스',
      url: 'https://docs.unity3d.com',
      scope: 'unity',
    },
    201,
    crypto.randomUUID(),
  );
  const spring = await send(
    'POST',
    base,
    {
      label: 'Spring Documentation',
      description: '서버 개발 레퍼런스',
      url: 'https://docs.spring.io',
      scope: 'server',
    },
    201,
    crypto.randomUUID(),
  );
  const react = await send(
    'POST',
    base,
    {
      label: 'React Documentation',
      description: '프론트엔드 레퍼런스',
      url: 'https://react.dev',
      scope: 'server',
    },
    201,
    crypto.randomUUID(),
  );
  assert.equal(original.item.description, body.description);
  assert.equal(original.item.position, 0);
  assert.deepEqual(await send('POST', base, body, 201, key), original);
  assert.equal(
    (await send('POST', base, { ...body, label: 'Different' }, 409, key)).code,
    'IDEMPOTENCY_KEY_REUSED',
  );
  await send('POST', base, body, 400);
  await send('GET', base + '?limit=1', undefined, 400);
  await send('GET', base + '?scope=all&scope=unity', undefined, 400);
  const scoped = await send('GET', base + '?scope=unity');
  assert.deepEqual(
    scoped.items.map((l) => l.id),
    [original.item.id, unity.item.id],
  );
  assert.equal(scoped.total, 2);
  const search = await send('GET', base + '?query=' + encodeURIComponent('SPRING.IO'));
  assert.equal(search.total, 1);
  assert.equal(
    (await send('GET', base + '?query=' + encodeURIComponent('개발 레퍼런스'))).total,
    2,
  );
  assert.equal((await send('GET', base + '?query=%25')).total, 0);
  assert.equal((await send('GET', base + '/' + spring.item.id)).id, spring.item.id);
  const patched = await send('PATCH', base + '/' + original.item.id, {
    revision: original.item.revision,
    label: 'GitHub updated',
  });
  assert.equal(patched.item.revision, 2);
  assert.equal(patched.collectionRevision, 6);
  await send('PATCH', base + '/' + original.item.id, { revision: 1, label: 'stale' }, 409);
  await send('PATCH', base + '/' + original.item.id, { revision: 2, position: 9 }, 400);
  const noopPatch = await send('PATCH', base + '/' + original.item.id, { revision: 2 });
  assert.equal(noopPatch.item.revision, 3);
  list = await get();
  const ids = list.items.map((l) => l.id);
  const reversed = [...ids].reverse();
  const ordered = await send('PUT', base + '/order', {
    collectionRevision: list.collectionRevision,
    ids: reversed,
  });
  assert.deepEqual(
    ordered.items.map((l) => l.position),
    [0, 1, 2, 3],
  );
  ordered.items.forEach((l) =>
    assert.equal(l.revision, list.items.find((x) => x.id === l.id).revision + 1),
  );
  await send('PUT', base + '/order', { collectionRevision: list.collectionRevision, ids: [] }, 409);
  await send(
    'PUT',
    base + '/order',
    { collectionRevision: ordered.collectionRevision, ids: [] },
    400,
  );
  await send(
    'PUT',
    base + '/order',
    { collectionRevision: ordered.collectionRevision, ids: [...reversed.slice(0, 3), reversed[0]] },
    400,
  );
  const noop = await send('PUT', base + '/order', {
    collectionRevision: ordered.collectionRevision,
    ids: reversed,
  });
  assert.equal(noop.collectionRevision, ordered.collectionRevision + 1);
  assert.deepEqual(noop.items, ordered.items);
  const removed = noop.items[0];
  await send('DELETE', base + '/' + removed.id + '?revision=0', undefined, 400);
  const deleted = await send('DELETE', base + '/' + removed.id + '?revision=' + removed.revision);
  assert.equal(deleted.deletedId, removed.id);
  await send('DELETE', base + '/' + removed.id + '?revision=' + removed.revision, undefined, 404);
  const gaps = await get();
  assert.deepEqual(
    gaps.items.map((l) => l.position),
    [1, 2, 3],
  );
  const compact = await send('PUT', base + '/order', {
    collectionRevision: gaps.collectionRevision,
    ids: gaps.items.map((l) => l.id),
  });
  assert.deepEqual(
    compact.items.map((l) => l.position),
    [0, 1, 2],
  );
  compact.items.forEach((l, i) => assert.equal(l.revision, gaps.items[i].revision + 1));
  const beforeExternal = await get();
  const external = await send(
    'POST',
    base,
    { label: 'External', url: 'https://example.com/%25_!' },
    201,
    crypto.randomUUID(),
  );
  await send(
    'PUT',
    base + '/order',
    {
      collectionRevision: beforeExternal.collectionRevision,
      ids: beforeExternal.items.map((l) => l.id),
    },
    409,
  );
  assert.equal((await send('GET', base + '?query=' + encodeURIComponent('%25_!'))).total, 1);
  await send('DELETE', base + '/' + external.item.id + '?revision=' + external.item.revision);
  // Restore comparable display data through API; no fixture identity reaches the frontend.
  list = await get();
  const github = list.items.find((l) => l.id === original.item.id);
  await send('PATCH', base + '/' + github.id, {
    revision: github.revision,
    label: 'GitHub',
    description: '코드와 저장소',
  });
  await send(
    'POST',
    base,
    {
      label: 'React Documentation',
      description: '프론트엔드 레퍼런스',
      url: 'https://react.dev',
      scope: 'server',
    },
    201,
    crypto.randomUUID(),
  );
  list = await get();
  const canonical = [
    'GitHub',
    'Unity Documentation',
    'Spring Documentation',
    'React Documentation',
  ].map((name) => list.items.find((l) => l.label === name).id);
  await send('PUT', base + '/order', {
    collectionRevision: list.collectionRevision,
    ids: canonical,
  });
  await page.goto(origin + '/library');
  await expect(page.locator('.quick-links strong')).toHaveCount(4);
  for (const [name, width, height] of [
    ['desktop', 1440, 1000],
    ['mobile', 390, 844],
    ['landscape', 844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: path.join(output, 'link-library-' + name + '.png'),
      fullPage: true,
    });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'GitHub 편집' }).click();
    await expect(page.getByLabel('링크 이름')).toBeFocused();
    await page.screenshot({
      path: path.join(output, 'link-editor-' + name + '.png'),
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '링크 추가', exact: true }).click();
  await page.getByLabel('링크 이름').fill('UI Link');
  await page.getByLabel('URL', { exact: true }).fill('https://example.com/ui');
  await page.getByLabel('설명', { exact: true }).fill('  full text  ');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'UI Link 위로' }).click();
  await expect(page.locator('.quick-links strong').nth(3)).toHaveText('UI Link');
  await page.getByRole('button', { name: 'UI Link 편집' }).click();
  await page.getByLabel('링크 이름').fill('UI changed');
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // External resource mutation forces explicit draft review, with real backend revision authority.
  await page.getByRole('button', { name: 'UI changed 편집' }).click();
  await page.getByLabel('설명', { exact: true }).fill('my draft');
  let ui = (await get()).items.find((l) => l.label === 'UI changed');
  await send('PATCH', base + '/' + ui.id, { revision: ui.revision, label: 'External change' });
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('button', { name: '내 변경 다시 적용' })).toBeVisible();
  await expect(page.getByLabel('설명', { exact: true })).toHaveValue('my draft');
  await page.getByRole('button', { name: '내 변경 다시 적용' }).click();
  await page.getByRole('button', { name: '링크 저장' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // External collection mutation makes the current UI permutation stale; no silent PUT replay.
  const newLink = await send(
    'POST',
    base,
    { label: 'Other tab', url: 'https://example.com/other' },
    201,
    crypto.randomUUID(),
  );
  await page.getByRole('button', { name: 'GitHub 아래로' }).click();
  await expect(page.getByRole('alert')).toContainText('최신 전체 순서');
  await expect(page.getByRole('link', { name: 'Other tab' })).toBeVisible();
  await send('DELETE', base + '/' + newLink.item.id + '?revision=' + newLink.item.revision);
  await page.getByRole('button', { name: '링크 새로고침' }).click();
  await expect(page.getByRole('link', { name: 'Other tab' })).toHaveCount(0);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'External change 삭제' }).click();
  await expect(page.getByRole('link', { name: 'External change' })).toHaveCount(0);
  await page.goto(origin + '/');
  await expect(page.locator('.link-surface .quick-links strong')).toHaveCount(4);
  await expect(page.locator('.link-surface .link-actions')).toHaveCount(0);
  await page.locator('.link-surface').screenshot({ path: path.join(output, 'link-home.png') });
  // Maximum-size acceptance uses this disposable workspace only and normal API creation.
  list = await get();
  for (let i = list.total; i < 500; i++)
    await send(
      'POST',
      base,
      { label: 'Quota ' + i, url: 'https://example.com/quota/' + i },
      201,
      crypto.randomUUID(),
    );
  list = await get();
  assert.equal(list.total, 500);
  assert.equal(list.items.length, 500);
  assert.equal(list.nextCursor, null);
  assert.equal(
    (
      await send(
        'POST',
        base,
        { label: 'Overflow', url: 'https://example.com/overflow' },
        429,
        crypto.randomUUID(),
      )
    ).code,
    'QUOTA_EXCEEDED',
  );
  for (const row of list.items)
    await send('DELETE', base + '/' + row.id + '?revision=' + row.revision);
  assert.deepEqual(await send('POST', base, body, 201, key), original);
  await send('GET', base + '/' + original.item.id, undefined, 404);
  assert.equal((await get()).total, 0);
  assert.equal(sql('select count(*) from links'), '0');
  assert.equal(sql('select count(*) from dashboards'), '0');
  fs.writeFileSync(
    path.join(output, 'links-result.json'),
    JSON.stringify(
      {
        boundary: origin,
        fullCollection: true,
        quota: 500,
        scopeSearch: true,
        crud: true,
        resourceConflict: true,
        collectionConflict: true,
        reorder: true,
        noOp: true,
        gaps: true,
        replayAfterDelete: true,
        ui: true,
        cleaned: true,
      },
      null,
      2,
    ),
  );
  console.log(
    'Links: full collection, CRUD/replay, order/conflicts, 500 quota, browser parity and cleanup passed.',
  );
}
