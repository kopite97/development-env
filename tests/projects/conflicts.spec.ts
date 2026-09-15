import { test, expect, setup, project, id } from './fixtures';
test('failed conflict reload and repeated conflict retain the draft without automatic writes', async ({
  page,
}) => {
  await setup(page);
  let current = project(1),
    failRead = false,
    writes = 0;
  await page.route('**/api/v2/projects/' + id(1), (route) => {
    if (route.request().method() === 'GET')
      return failRead ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: current });
    writes++;
    current = { ...current, revision: current.revision + 1, subtitle: 'Concurrent ' + writes };
    failRead = writes === 1;
    return route.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT' } });
  });
  await page.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('Retain draft');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(
    page.getByText('Latest Project could not be loaded. Retry reconciliation before editing.'),
  ).toBeVisible();
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toHaveValue('Retain draft');
  expect(writes).toBe(1);
  failRead = false;
  await page.getByRole('button', { name: '최신 프로젝트 다시 확인' }).click();
  await page.getByRole('button', { name: '내 변경 다시 적용' }).click();
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(
    page.getByText(
      'This Project changed elsewhere. Review the latest version before reapplying your edits.',
    ),
  ).toBeVisible();
  await expect(page.getByLabel('프로젝트 이름', { exact: true })).toHaveValue('Retain draft');
  expect(writes).toBe(2);
});
test('two browser tabs cannot silently overwrite each other', async ({ page, context }) => {
  const second = await context.newPage();
  await setup(page);
  await setup(second);
  let current = project(1),
    writes = 0;
  await context.route('**/api/v2/projects/' + id(1), (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: current });
    const body = route.request().postDataJSON();
    writes++;
    if (body.revision !== current.revision)
      return route.fulfill({ status: 409, json: { code: 'REVISION_CONFLICT' } });
    current = { ...current, ...body, revision: current.revision + 1 };
    return route.fulfill({ json: current });
  });
  await page.goto('/projects/' + id(1));
  await second.goto('/projects/' + id(1));
  await page.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await second.getByRole('button', { name: '프로젝트 편집', exact: true }).click();
  await page.getByLabel('프로젝트 이름', { exact: true }).fill('First tab');
  await second.getByLabel('프로젝트 이름', { exact: true }).fill('Second tab');
  await page.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(page.getByRole('heading', { name: 'First tab', exact: true })).toBeVisible();
  await second.getByRole('button', { name: '프로젝트 저장' }).click();
  await expect(
    second.getByText(
      'This Project changed elsewhere. Review the latest version before reapplying your edits.',
    ),
  ).toBeVisible();
  expect(writes).toBe(2);
  expect(current.name).toBe('First tab');
});
