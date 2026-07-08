# POS Orders — QA checklist

Manual verification on a site with KOT enabled (`custom_kot_naming_series`, production units).

## Shift gate (POS Opening Entry)

Manual verification on `resturant16` (or your bench site). Run `bench build --app ury` and `npm run build` in `apps/ury/pos`, then hard-refresh `/pos`.

- [ ] No open shift: full-screen gate with **Open POS Shift** → Desk prefilled → Submit → returns to `/pos` with welcome (once per session)
- [ ] Draft opening: amber warning + **Resume & Submit**; optional **Start fresh**; blocked explanation when another shift is open
- [ ] Stale shift: 2-step stepper — close yesterday, then open today; disabled **Open today** until close done
- [ ] Daily POS close enabled: **Close Previous Shift** when yesterday unclosed; 5 AM business-day hint visible
- [ ] Sub cashier before main: waiting screen with main cashier name; copy username + mailto; auto-poll on focus
- [ ] Another cashier's shift: blocked message + **View shift entry**
- [ ] Closing queued: spinner + “may take a moment” copy; **Continue** re-checks
- [ ] Expected opening floats table shows last close amounts (opening / draft)
- [ ] **View previous opening entry** link on outdated/closing when stale entry exists
- [ ] **I've submitted — Continue** re-checks without full reload
- [ ] Desk forms show slim blue return banner + dashboard headline when opened from gate
- [ ] API failure shows **Retry** with backoff timestamp (no Desk navigation until success)
- [ ] Session expired: amber banner on gate after auth failure in Desk flow
- [ ] Welcome: **Start taking orders** copy; header shift pill pulses once after welcome
- [ ] Arabic RTL: gate + welcome layout (`dir=rtl`)

### Automated (shift gate)

Requires bench on `POS_BASE_URL` (default `http://localhost:8004/pos`) and saved login:

```bash
# One-time: log in via Playwright and save session
npx playwright codegen http://localhost:8004/login --save-storage=playwright/.auth/user.json

cd apps/ury/pos && POS_E2E_AUTH=1 npm run test:e2e -- e2e/shift-gate.spec.ts
```

Mocks `get_pos_shift_gate` after auth — does **not** replace full Desk redirect manual tests above.

### Backend unit tests

```bash
cd /path/to/frappe-bench
bench --site resturant16 run-tests --app ury --module ury.ury.api.test_ury_pos_shift_gate
```

## Sidebar

- [ ] Draft, Unbilled visible always
- [ ] With `view_all_status` on: Paid, Consolidated, Return tabs appear
- [ ] Badge counts match list totals (Recently Paid respects `paid_limit`)
- [ ] Tab switch preserves per-tab KOT chip filter (`sessionStorage`)

## Order cards (Draft / Unbilled)

- [ ] Kitchen summary strip shows branch-wide in_kitchen / delayed / not_sent counts
- [ ] Filter chips: All, In kitchen, Delayed, Not sent — counts match API
- [ ] Filter + pagination: delayed orders on page 2 appear when filter active
- [ ] Rush sort: delayed and in-kitchen orders surface first
- [ ] Card shows note (amber) and allergy (red) popovers on icon tap
- [ ] KOT row: icon + colored dot; delayed pulses red
- [ ] Single station: status only; multi-station: `Station · Status`
- [ ] Tap KOT row opens `/URYMosaic/{production}` when setting enabled
- [ ] Long-press opens menu without selecting card; Copy / Reprint / Open KDS
- [ ] Footer: `N items · total`
- [ ] MOD chip when order modified after send

## Detail panel / mobile drawer

- [ ] Billing badge shows Unbilled on Unbilled tab (not Draft)
- [ ] Edit / cancel visible on Unbilled table orders
- [ ] Kitchen block shows `Not sent` when no KOT
- [ ] Labeled **Open KDS — {station}** buttons
- [ ] Note and allergy banners when set

## Search & refresh

- [ ] Search empty state shows message + **Clear search** chip
- [ ] Soft refresh every 30s; refetch on tab focus
- [ ] Status counts API throttled client-side (~30s) unless forced

## Automated

```bash
cd apps/ury/pos && npm run test:e2e -- e2e/orders.spec.ts
```
