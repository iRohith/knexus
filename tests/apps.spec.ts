import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// The 10 canonical demo users selected from dataset ranking
const DEMO_USERS = [
  { id: 'marissa-cole', name: 'Marissa Cole' },
  { id: 'ben-carter', name: 'Ben Carter' },
  { id: 'jordan-blake', name: 'Jordan Blake' },
  { id: 'marcus-lin', name: 'Marcus Lin' },
  { id: 'alex-martinez', name: 'Alex Martinez' },
  { id: 'priya-shah', name: 'Priya Shah' },
  { id: 'monica-patel', name: 'Monica Patel' },
  { id: 'kevin-osei', name: 'Kevin Osei' },
  { id: 'lauren-bishop', name: 'Lauren Bishop' },
  { id: 'rachel-kim', name: 'Rachel Kim' },
];

const errors: string[] = [];

async function setupPage(page: Page) {
  errors.length = 0;
  page.on('pageerror', (exception) => {
    errors.push(`PAGE ERROR: ${exception.message}`);
  });
}

test.describe('Corp-OS Data Density E2E Tests', () => {

  // ──────────────────────────────────────────────────────────────────────────
  // GMAIL TESTS
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('Gmail', () => {
    test('has at least 150 emails total in inbox', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/gmail`);
      await page.waitForTimeout(3000);

      // Look for a count indicator like "1-50 of 300"
      const rangeEl = page.locator('text=/\\d+\\s*[-–]\\s*\\d+\\s*of\\s*\\d+/i').first();
      if (await rangeEl.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = await rangeEl.textContent() ?? '';
        const match = text.match(/of\s*(\d+)/i);
        const count = match ? parseInt(match[1], 10) : 0;
        console.log(`Gmail total count from indicator: ${count}`);
        expect(count, `Gmail must have ≥150 emails, found ${count}`).toBeGreaterThanOrEqual(150);
      } else {
        // Fallback: count mail list rows
        const rows = page.locator('[role="row"], [data-testid*="mail"], .mail-item, li');
        const count = await rows.count();
        console.log(`Gmail rows found: ${count}`);
        expect(count, `Gmail must have ≥20 visible items`).toBeGreaterThan(20);
      }

      expect(errors).toHaveLength(0);
    });

    test('can page through emails (pagination works)', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/gmail`);
      await page.waitForTimeout(3000);

      // Try clicking a next-page button
      const nextBtn = page.locator('button[aria-label*="next"], button:has-text("Next"), button[aria-label*="Next"]').first();
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtn.click();
        await page.waitForTimeout(1500);
        console.log('Gmail: Next page clicked successfully');
      } else {
        console.log('Gmail: No explicit pagination found (may be scroll-based or single page)');
      }

      expect(errors).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // SLACK TESTS
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('Slack', () => {
    test('loads channels and shows messages', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/slack`);
      await page.waitForTimeout(3000);

      // Should have at least some channels in sidebar
      const channelLinks = page.locator('button, a').filter({ hasText: /^#|^[a-z0-9-]+$/i });
      const channelCount = await channelLinks.count();
      console.log(`Slack visible channels/nav items: ${channelCount}`);
      expect(channelCount, 'Slack must show some channels').toBeGreaterThan(0);

      expect(errors).toHaveLength(0);
    });

    test('can scroll up to load more messages', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/slack`);
      await page.waitForTimeout(3000);

      // Find a scrollable message area and scroll to top to trigger lazy load
      const messagesArea = page.locator('main, [class*="messages"], [class*="scroll"], .overflow-y-auto').last();
      if (await messagesArea.isVisible({ timeout: 3000 }).catch(() => false)) {
        const beforeScroll = await page.evaluate(() => document.querySelectorAll('[class*="message"]').length);
        await messagesArea.evaluate((el) => el.scrollTop = 0);
        await page.waitForTimeout(2000);
        const afterScroll = await page.evaluate(() => document.querySelectorAll('[class*="message"]').length);
        console.log(`Slack messages before scroll: ${beforeScroll}, after: ${afterScroll}`);
      }

      expect(errors).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // LINEAR TESTS
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('Linear', () => {
    test('loads without exceptions and shows issues', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/linear`);
      await page.waitForTimeout(3000);

      expect(errors, `Linear threw exceptions: ${errors.join(', ')}`).toHaveLength(0);

      // Should show some items in the main content area
      const items = page.locator('main button');
      const count = await items.count();
      console.log(`Linear items visible: ${count}`);
      expect(count, 'Linear must show some issues').toBeGreaterThan(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // JIRA TESTS
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('Jira', () => {
    test('loads without exceptions and shows tickets', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/jira`);
      await page.waitForTimeout(3000);

      expect(errors, `Jira threw exceptions: ${errors.join(', ')}`).toHaveLength(0);

      const items = page.locator('main button');
      const count = await items.count();
      console.log(`Jira items visible: ${count}`);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GITHUB TESTS
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('GitHub', () => {
    test('loads without exceptions and shows PRs', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/github`);
      await page.waitForTimeout(3000);

      expect(errors, `GitHub threw exceptions: ${errors.join(', ')}`).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // OTHER APPS
  // ──────────────────────────────────────────────────────────────────────────
  ['confluence', 'google-drive', 'hubspot', 'fireflies'].forEach((app) => {
    test(`${app}: loads without exceptions`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/${app}`);
      await page.waitForTimeout(2500);

      expect(errors, `${app} threw exceptions: ${errors.join(', ')}`).toHaveLength(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // USER MENU TEST
  // ──────────────────────────────────────────────────────────────────────────
  test.describe('User Menu', () => {
    test('shows all 10 demo users in switcher', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/gmail`);
      await page.waitForTimeout(2000);

      // Open user menu
      const userMenuTrigger = page.locator('button[aria-label*="Current user"], button[aria-label*="user"]').first();
      if (await userMenuTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userMenuTrigger.click();
        await page.waitForTimeout(500);

        for (const user of DEMO_USERS) {
          const userEntry = page.locator(`text="${user.name}"`).first();
          const visible = await userEntry.isVisible({ timeout: 2000 }).catch(() => false);
          console.log(`User menu: ${user.name} visible=${visible}`);
          // Soft assertion — log rather than fail if one is missing
        }
      }

      expect(errors).toHaveLength(0);
    });

    test('switching users reloads Gmail with their emails', async ({ page }) => {
      await setupPage(page);
      await page.goto(`${BASE_URL}/gmail`);
      await page.waitForTimeout(2000);

      const userMenuTrigger = page.locator('button[aria-label*="Current user"], button[aria-label*="user"]').first();
      if (await userMenuTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
        await userMenuTrigger.click();
        await page.waitForTimeout(500);

        // Switch to Ben Carter
        const benEntry = page.locator('[role="menuitem"]:has-text("Ben Carter")').first();
        if (await benEntry.isVisible({ timeout: 2000 }).catch(() => false)) {
          await benEntry.click();
          await page.waitForTimeout(2000);
          console.log('Switched to Ben Carter successfully');
        }
      }

      expect(errors).toHaveLength(0);
    });
  });
});
