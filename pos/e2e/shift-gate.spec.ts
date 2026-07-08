import { test, expect } from '@playwright/test';
import { mockAuthenticatedPosSession } from './helpers/mock-pos-session';

/**
 * Shift-gate e2e stubs API responses. Requires a running bench (`localhost:8004`)
 * and either:
 * - `POS_E2E_AUTH=1` with `playwright/.auth/user.json` from a logged-in session, or
 * - run manual QA per pos/QA.md (recommended for Desk redirect flows).
 *
 * Generate storage state once:
 *   npx playwright codegen http://localhost:8004/login --save-storage=playwright/.auth/user.json
 */
const GATE_METHOD = '**/api/method/ury.ury_pos.api.get_pos_shift_gate**';
const HAS_AUTH_STORAGE = process.env.POS_E2E_AUTH === '1';

const openingGatePayload = {
  message: {
    scenario: 'opening',
    pos_profile: 'Test POS',
    company: 'Test Co',
    branch: 'Main',
    restaurant: null,
    room: 'Hall',
    stale_opening_entry: null,
    draft_opening_entry: null,
    main_cashier: null,
    main_cashier_name: null,
    is_main_cashier: true,
    main_cashier_open: true,
    can_create_opening: true,
    can_close_shift: true,
    open_entry_owner: null,
    open_entry_owner_name: null,
    suggested_opening_balances: [{ mode_of_payment: 'Cash', amount: 500 }],
    business_date: '2026-07-08',
    completed_steps: { closed_previous: true, opened_today: false },
    desk_routes: {
      open_shift:
        '/app/pos-opening-entry/new?ury_return=%2Fpos&pos_profile=Test+POS&company=Test+Co&branch=Main',
      resume_draft: null,
      close_shift: null,
      view_opening: null,
    },
    shift_summary: null,
    allow_start_fresh: true,
  },
};

const okGatePayload = {
  message: {
    ...openingGatePayload.message,
    scenario: 'ok',
    shift_summary: {
      opening_entry: 'POS-OPE-2026-00001',
      period_start: '2026-07-08 05:00:00',
      posting_date: '2026-07-08',
    },
  },
};

test.describe('POS shift gate', () => {
  test.skip(
    !HAS_AUTH_STORAGE,
    'Set POS_E2E_AUTH=1 and playwright/.auth/user.json — see pos/QA.md',
  );

  test.use({
    storageState: HAS_AUTH_STORAGE ? 'playwright/.auth/user.json' : undefined,
  });

  test.beforeEach(async ({ page }) => {
    await mockAuthenticatedPosSession(page);
  });

  test('shows opening gate with primary CTA when shift is not open', async ({ page }) => {
    await page.route(GATE_METHOD, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(openingGatePayload),
      });
    });

    await page.goto('/');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /start your shift/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open pos shift/i })).toBeVisible();
    await expect(page.getByText(/expected opening floats/i)).toBeVisible();
    await expect(page.getByText('Cash')).toBeVisible();
  });

  test('welcome screen after shift opened query when gate is ok', async ({ page }) => {
    await page.route(GATE_METHOD, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(okGatePayload),
      });
    });

    await page.goto('/?shift_opened=1');
    await expect(page.getByRole('heading', { name: /shift opened/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/start taking orders/i)).toBeVisible();
  });

  test('error scenario shows retry without desk navigation', async ({ page }) => {
    await page.route(GATE_METHOD, async (route) => {
      await route.fulfill({ status: 500, body: 'Server error' });
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: /could not verify shift/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /open pos shift/i })).toHaveCount(0);
  });
});
