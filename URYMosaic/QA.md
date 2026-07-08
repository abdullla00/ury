# URY Mosaic KDS — Manual QA Matrix

Run on site **resturant16** at `http://localhost:8004` unless noted.

Record: tester, date, pass/fail, notes per step.

## Setup

- [ ] Logged in as kitchen user with URY Mosaic access
- [ ] Branch has Kitchen + Bar production units configured
- [ ] POS profile has `kds_production_unit` set
- [ ] Printer routing: Kitchen items → Kitchen KOT, Bar items → Bar KOT

## Kitchen station (`/URYMosaic/Kitchen`)

1. [ ] Board loads with tabs: All, To cook, Ready, Completed
2. [ ] New POS order appears within ~2s (socket) on To cook
3. [ ] Order note banner visible on card when set from POS
4. [ ] Allergy note red banner when set from POS
5. [ ] Modifier sub-lines show labels (not raw codes)
6. [ ] `2×` quantity format for qty > 1
7. [ ] Order-type stripe matches POS (dine-in / takeaway / aggregator)
8. [ ] Elapsed timer shows `13′` then `1h 13′` after 60+ minutes
9. [ ] Delayed stat uses branch `custom_kot_warning_time` threshold
10. [ ] Tap card → serve sheet → Mark served moves to Completed
11. [ ] Mark ready (menu) moves ticket to Ready tab
12. [ ] Per-item strike syncs via `mark_kot_item_ready` (refresh persists)
13. [ ] Recall from Completed returns to To cook
14. [ ] Reprint sends to kitchen printer (if enabled)
15. [ ] Search filters by table / order #
16. [ ] Pin / unpin reorders card to top
17. [ ] New ticket highlight + swipe-up opens serve sheet
18. [ ] Keyboard shortcuts 1–4, w, /, Enter, r, arrows
19. [ ] Socket disconnect → Polling badge; reconnect restores Live
20. [ ] Audio gate: first interaction enables chime on new ticket
21. [ ] Settings: wall default, font large, language ar/fr, station switcher
22. [ ] Wall mode: double-tap serve, Wake Lock, fullscreen, compact toolbar
23. [ ] Multi-screen: serve on screen A removes card on screen B within ~2s

## Bar station (`/URYMosaic/Bar`)

24. [ ] Bar-only items route to Bar board, not Kitchen
25. [ ] Same serve/recall/socket sync as Kitchen

## Expo (`/URYMosaic/Expo`)

26. [ ] Shows Kitchen + Bar tickets on one board
27. [ ] Station badge visible per card

## POS integration

28. [ ] Send to kitchen → toast **Open KDS** opens correct production unit
29. [ ] Guest table order (`TableOrder`) opens branch `kds_production_unit`, not hardcoded Kitchen
30. [ ] POS Orders tab unchanged (billing only — no prep columns)

## Regression

31. [ ] POS build + `yarn ury-mosaic-build` pass
32. [ ] `bench migrate` applied (`add_kds_phase2_fields` patch)

## Playwright (automated smoke)

```bash
cd apps/ury/URYMosaic
MOSAIC_BASE_URL=http://localhost:8004/URYMosaic/Kitchen npx playwright test
```

- [ ] Loads board shell (login modal or tabs visible)
- [ ] Station URL `/URYMosaic/Bar` resolves
