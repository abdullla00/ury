import type { Page } from '@playwright/test';

const mockPosProfileLimited = {
  pos_profile: 'Test POS',
  branch: 'Main',
  company: 'Test Co',
  waiter: 'test@example.com',
  warehouse: 'Stores - TC',
  cashier: 'test@example.com',
  print_format: null,
  qz_print: 0,
  qz_host: null,
  printer: null,
  print_type: 'Network',
  tableAttention: 0,
  paid_limit: 50,
  disable_rounded_total: 0,
  enable_discount: 0,
  multiple_cashier: 0,
  owner: 'test@example.com',
  edit_order_type: 0,
  enable_kot_reprint: 0,
  allow_partial_payment: 0,
  enable_tips: 0,
  tip_item: null,
  kds_production_unit: null,
  kot_warning_time: 15,
  default_pos_screen: 'POS',
  transfer_roles: [],
  view_all_status: 0,
  orders_kot_opens_kds: 1,
};

const mockPosProfileFull = {
  name: 'Test POS',
  company: 'Test Co',
  branch: 'Main',
  restaurant: 'Test Restaurant',
  currency: 'USD',
  warehouse: 'Stores - TC',
  role_allowed_for_billing: [{ role: 'URY Cashier' }],
  payments: [],
  taxes_and_charges: [],
  item_groups: [],
  customer_groups: [],
  countries: [],
  applicable_for_users: [],
};

function json(data: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  };
}

/** Stub Frappe API calls so shift-gate e2e can run without a logged-in bench session. */
export async function mockAuthenticatedPosSession(page: Page): Promise<void> {
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();

    if (url.includes('frappe.auth.get_logged_user')) {
      await route.fulfill(json({ message: 'test@example.com' }));
      return;
    }

    if (url.includes('/api/resource/User/')) {
      await route.fulfill(
        json({
          data: {
            name: 'test@example.com',
            full_name: 'Test Cashier',
            roles: [{ role: 'URY Cashier' }],
          },
        }),
      );
      return;
    }

    if (url.includes('ury.ury_pos.api.getPosProfile')) {
      await route.fulfill(json({ message: mockPosProfileLimited }));
      return;
    }

    if (url.includes('/api/resource/POS%20Profile/') || url.includes('/api/resource/POS Profile/')) {
      await route.fulfill(json({ data: mockPosProfileFull }));
      return;
    }

    if (url.includes('/api/resource/Currency/')) {
      await route.fulfill(json({ data: { name: 'USD', symbol: '$' } }));
      return;
    }

    if (
      url.includes('getRestaurantMenu') ||
      url.includes('get_menu_categories') ||
      url.includes('get_payment_modes') ||
      url.includes('getPaymentModes')
    ) {
      await route.fulfill(json({ message: [] }));
      return;
    }

    if (url.includes('get_pos_shift_info')) {
      await route.fulfill(json({ message: { status: 'closed' } }));
      return;
    }

    if (url.includes('get_occupied_table_count')) {
      await route.fulfill(json({ message: 0 }));
      return;
    }

    await route.continue();
  });
}
