import { test, expect, type Page } from '@playwright/test';

async function failMilestoneStorage(page: Page, fail: boolean) {
  await page.evaluate((fail) => {
    const state = window as unknown as { originalSet?: typeof Storage.prototype.setItem };
    state.originalSet ??= Storage.prototype.setItem;
    Storage.prototype.setItem = fail
      ? function (key, value) {
          if (key === 'devspace.milestones.v1')
            throw new DOMException('Full', 'QuotaExceededError');
          state.originalSet!.call(this, key, value);
        }
      : state.originalSet;
  }, fail);
}

test('milestones import legacy goals and create, edit, complete and reopen across detail and home', async ({
  page,
}) => {
  await page.goto('/projects/forest');
  const region = page.getByRole('region', { name: '프로젝트 마일스톤' });
  await expect(region.locator('.milestone')).toContainText('플레이 가능한 데모');
  await expect(region.locator('.milestone')).toContainText('기한 없음');
  await region.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByRole('dialog', { name: '마일스톤 추가', exact: true })).toBeVisible();
  await page.getByLabel('목표 제목').fill('새 목표');
  await page.getByLabel('목표 기한 (선택)').fill('2026-09-01');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(region.locator('.milestone').first()).toContainText('새 목표');
  await expect(region.locator('.milestone').first()).toContainText('기한 지남');
  await region.getByRole('button', { name: '새 목표 수정' }).click();
  await page.getByLabel('목표 제목').fill('수정 목표');
  await page.getByLabel('목표 기한 (선택)').fill('2026-10-01');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await page.getByRole('button', { name: '나의 홈', exact: true }).click();
  await expect(page.locator('.milestones')).toContainText('수정 목표');
  await expect(page.locator('.milestones')).toContainText('2026-10-01');
  await page.reload();
  await page.getByRole('button', { name: '수정 목표 완료', exact: true }).click();
  await expect(page.locator('.milestones')).not.toContainText('수정 목표');
  await page.getByLabel('마일스톤 상태 필터').selectOption('done');
  await page.getByRole('button', { name: '수정 목표 재개', exact: true }).click();
  await page.goto('/projects/forest');
  await expect(region.locator('.milestone').first()).toContainText('수정 목표');
  await page.getByRole('button', { name: '수정 목표 수정' }).click();
  await page.getByLabel('목표 기한 (선택)').fill('');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await page.reload();
  await expect(region.locator('.milestone').filter({ hasText: '수정 목표' })).toContainText(
    '기한 없음',
  );
});

test('failed milestone writes retain data and drafts with discard and navigation protection', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('.project-row').filter({ hasText: 'Forest of Echoes' }).click();
  await page.getByRole('button', { name: '플레이 가능한 데모 수정', exact: true }).click();
  await page.getByLabel('목표 제목').fill('보호할 목표');
  await failMilestoneStorage(page, true);
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('입력 내용은 유지');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('목표 제목')).toHaveValue('보호할 목표');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/\/projects\/forest$/);
  await expect(page.getByLabel('목표 제목')).toHaveValue('보호할 목표');
  expect(
    await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }),
  ).toBe(true);
  await failMilestoneStorage(page, false);
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  await failMilestoneStorage(page, true);
  await page.getByRole('button', { name: '보호할 목표 완료', exact: true }).click();
  await expect(page.getByRole('button', { name: '보호할 목표 완료', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toBeVisible();
  await failMilestoneStorage(page, false);
  await page.getByRole('button', { name: '보호할 목표 완료', exact: true }).click();
  await page.reload();
  await page.getByLabel('마일스톤 상태 필터').selectOption('done');
  await expect(page.getByRole('button', { name: '보호할 목표 재개' })).toBeVisible();
  await page.getByRole('button', { name: '보호할 목표 수정' }).click();
  await page.getByLabel('목표 제목').fill('버릴 변경');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '취소', exact: true }).click();
  await expect(page.getByRole('button', { name: '보호할 목표 수정' })).toBeVisible();
});

test('empty saved milestones stay empty; long new goals fit mobile and respect widget project/count', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('devspace.milestones.v1', '[]'));
  await page.reload();
  await expect(page.locator('.milestone')).toHaveCount(0);
  await page.getByRole('button', { name: '배치 편집', exact: true }).click();
  await page.getByRole('button', { name: '다가오는 마일스톤 설정', exact: true }).click();
  await page.getByLabel('특정 프로젝트').selectOption('api');
  await page.getByLabel('표시 개수').fill('1');
  await page.getByRole('button', { name: '설정 적용' }).click();
  await page.getByRole('button', { name: '배치 저장' }).click();
  await page.setViewportSize({ width: 390, height: 500 });
  const title = '긴목표'.repeat(60);
  await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  await page.getByLabel('목표 제목').fill(title);
  await expect(page.getByRole('combobox', { name: '프로젝트', exact: true })).toHaveValue('api');
  await page.getByRole('button', { name: '마일스톤 저장' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(page.locator('.milestone')).toHaveCount(1);
  await expect(page.locator('.milestone')).toContainText(title);
  await page.getByRole('button', { name: 'Devspace API 상세 보기' }).click();
  await expect(page.getByRole('region', { name: '프로젝트 마일스톤' })).toContainText(title);
});

test('mobile menu traps focus, closes with Escape/overlay/navigation and restores the trigger', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 500 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: '메뉴 열기' });
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  const menu = page.getByRole('dialog', { name: '작업실 메뉴' });
  const close = menu.getByRole('button', { name: '메뉴 닫기', exact: true });
  await expect(close).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.main-shell')).toHaveAttribute('inert', '');
  await page.keyboard.press('Shift+Tab');
  await expect(menu.locator('.profile')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.locator('.nav-overlay').click({ position: { x: 370, y: 100 } });
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole('button', { name: '개발 일지', exact: true }).click();
  await expect(page).toHaveURL(/\/journals$/);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.setViewportSize({ width: 1280, height: 600 });
  await expect(page.locator('.main-shell')).not.toHaveAttribute('inert', '');
  await expect(page.locator('.nav-overlay')).toHaveCount(0);
  await expect(page.locator('.sidebar .nav-item.active')).toBeFocused();
});

test('profile and editor dialogs have names, contain keyboard focus, and progress bars have project names', async ({
  page,
}) => {
  await page.goto('/');
  const progress = page.getByRole('progressbar');
  for (let i = 0; i < (await progress.count()); i++) {
    await expect(progress.nth(i)).toHaveAttribute('aria-label', /진행률$/);
    await expect(progress.nth(i)).toHaveAttribute('aria-valuenow', /\d+/);
  }
  await page.setViewportSize({ width: 390, height: 500 });
  const trigger = page.getByRole('button', { name: '메뉴 열기' });
  await trigger.click();
  await page.locator('.profile').click();
  const profile = page.getByRole('dialog', { name: '개인 작업실 안내' });
  await expect(profile).toBeVisible();
  await expect(page.getByRole('dialog', { name: '작업실 메뉴' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.goto('/projects/forest');
  await expect(page.getByRole('progressbar', { name: 'Forest of Echoes 진행률' })).toBeVisible();
  await page.getByRole('button', { name: '마일스톤 추가', exact: true }).click();
  const modal = page.getByRole('dialog', { name: '마일스톤 추가', exact: true });
  await expect(page.getByLabel('목표 제목')).toBeFocused();
  await modal.getByRole('button', { name: '닫기', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: '마일스톤 저장' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '마일스톤 추가', exact: true })).toBeFocused();
});
