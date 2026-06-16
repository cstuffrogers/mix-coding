
import { test, expect } from '@playwright/test';
test('prototype loads and navigates', async ({ page }) => {
  await page.goto('file://E:/auto-coding/claude-scene/.claude/prototypes/test-verification-run-1781577017989.html');
  await expect(page.locator('.device')).toBeVisible();
  const navBtns = page.locator('.nav-btn');
  const count = await navBtns.count();
  for (let index = 0; index < count; index++) {
    await navBtns.nth(index).click();
    await expect(page.locator(`.screen[data-screen="${index}"]`)).toBeVisible();
  }
});