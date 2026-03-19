# Current State — Flexi React App

> Handoff document for the next AI. Last updated: 2026-03-19.
> Git branch: `feature/time_zones_and_minor_edits`
> Status: pre-delivery audit complete, pending end-to-end QA.

---

## 1. What This App Is

**Factory scheduling SaaS for Italian packaging/printing manufacturing.**
- Two production sites: `ZANICA` and `BUSTO_GAROLFO`
- Two departments: `STAMPA` (printing) and `CONFEZIONAMENTO` (packaging/TC101)
- Operators drag-and-drop production orders (ODPs) onto machine queues; the app schedules them sequentially respecting machine working hours
- ODPs come from an ERP dump table (`orders_master_dump`) synced hourly into `odp_orders` via Supabase pg_cron

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React (NOT Next.js — no `'use client'` directives) |
| Routing | react-router-dom |
| Server state | @tanstack/react-query |
| Global state | Zustand |
| Backend | Supabase (Postgres + RLS + pg_cron + Realtime) |
| Timezone | date-fns-tz — all times are **CET (Europe/Rome)** internally, stored as UTC |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Forms | react-hook-form + yup |
| Tables | @tanstack/react-table + @tanstack/react-virtual |
| Error tracking | Sentry |
| Toasts | sonner |
| UI components | shadcn/ui (Radix UI + Tailwind) |

---

## 3. Supabase Project

**URL:** `https://jyrfznujcyqskpfthrsf.supabase.co`

**Anon key** is hardcoded in `src/services/supabase/client.js` — intentional per Supabase architecture (it's a public key; RLS enforces security).

### Known Tables

| Table | Purpose | RLS notes |
|---|---|---|
| `machines` | Machine definitions — `id, machine_name, work_center, department, machine_type, status, active_shifts, standard_speed, setup_time_standard, min/max_web_width, min/max_bag_height` | Anon key **blocked** for some ops; use service key for bulk ops |
| `odp_orders` | Production orders — `id, odp_number, article_code, quantity, duration, time_remaining, status, scheduled_machine_id, scheduled_start_time, scheduled_end_time, description, delivery_date, nome_cliente, work_center, department, ...` | Permissive SELECT for anon |
| `machine_availability` | Precomputed unavailable CET hours per machine per date — `machine_id, date, unavailable_hours (int[])` — 22k+ rows | **Anon key silently blocked (returns 0 rows, no error)** — requires service role key |
| `phases` | Phase definitions — `name, department, work_center, v_stampa, t_setup_stampa, costo_h_stampa, v_conf, t_setup_conf, costo_h_conf, numero_persone` | Normal |
| `orders_master_dump` | Raw ERP export — source of truth for ODPs | Read only |
| `site_efficiency` | **NEW (2026-03-19)** — `work_center (PK), efficiency (NUMERIC, 0.80 default), updated_at` | SELECT open to anon, INSERT/UPDATE/DELETE requires authenticated |

### site_efficiency current values
```
ZANICA        → 0.80 (80%)
BUSTO_GAROLFO → 0.80 (80%)
```
To change: `UPDATE site_efficiency SET efficiency = 0.75 WHERE work_center = 'ZANICA';`

### Supabase Cron Jobs (pg_cron)
See `SUPABASE_MANUAL_STEPS.md` for full SQL. Summary of what should be running:
- **Job 1** `master-order-sync` — hourly — syncs ERP dump → odp_orders
- **midnight_cleanup_pipeline** — 00:00 daily — sequential: sync → delete_orphan → delete_completed_odp → delete_completed_master_dump (fixes race condition)
- **hourly_delete_orphan_odp_orders** — every :30 — removes stale orphaned orders
- **daily_delete_stale_pause_tasks** — 00:10 daily — removes PAUSE tasks past their end_time

**To verify jobs are installed:**
```sql
SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;
```

### ODP Status Enum
`'NOT SCHEDULED'` → `'SCHEDULED'` → `'IN_PROGRESS'` → `'COMPLETED'` / `'CANCELLED'`

Note: `'IN PROGRESS'` (with space) is in `constants.js` but the DB check constraint uses the exact string — verify this matches. The scheduler code uses `'IN_PROGRESS'` in some places and `'IN PROGRESS'` in others — **this is a potential mismatch to verify.**

---

## 4. Architecture

```
src/
├── pages/                    # Route-level pages
│   ├── SpotifySchedulerPage  # Main scheduling UI (drag-and-drop queues)
│   ├── BacklogListPage       # ODP list with XLSX export
│   ├── BacklogFormPage       # ODP create/edit (wraps BacklogForm)
│   ├── MachineOverviewPage   # Per-machine queue table view
│   ├── MachineryListPage     # Machine CRUD list
│   ├── PhasesListPage        # Phase CRUD list
│   ├── MachineCalendarPage   # Machine calendar (FullCalendar)
│   ├── SchedulerPage         # Older scheduler — may be legacy
│   └── HomePage              # Dashboard/metrics
│
├── components/
│   ├── GanttChart.jsx        # Custom Gantt — segments, drag-and-drop
│   ├── QueueTaskCard.jsx     # Task card in queue column
│   ├── TaskPoolDataTable.jsx # Pool of unscheduled tasks
│   ├── DataTable.jsx         # Generic filterable table
│   ├── BacklogForm.jsx       # ODP create/edit form with phase calc
│   └── MachineQueueColumn.jsx
│
├── store/
│   ├── useMainStore.js       # App init, realtime subscriptions, polling
│   ├── useUIStore.js         # selectedWorkCenter, editMode, loadingStates
│   ├── useSchedulerStore.js  # Wraps SpotifyQueueScheduler + MachineAvailabilityManager
│   └── scheduling/
│       ├── spotifyQueueScheduler.js  # Core scheduling class (THE brain)
│       └── machineAvailability.js   # Machine availability helpers
│
├── hooks/
│   ├── useQueries.js         # All React Query hooks (useMachines, useOrders, useSiteEfficiency, …)
│   ├── useProductionCalculations.js  # Duration/cost formulas
│   └── usePhaseSearch.js     # Phase search/select in BacklogForm
│
├── services/
│   ├── api.js                # ApiService class — all Supabase queries
│   └── supabase/client.js    # Supabase client init
│
└── utils/
    ├── dateFormatting.js     # formatDeliveryDate, formatScheduledTime, ITALY_TIMEZONE, cetHourToUTC
    ├── taskSegments.js       # getTaskSegments — parses description JSON into segments
    └── calendarConstants.js  # WORK_START_HOUR, SLOTS_PER_HOUR, etc.
```

---

## 5. Scheduling Logic (Critical — Read This)

### SpotifyQueueScheduler

The scheduler lives in `src/store/scheduling/spotifyQueueScheduler.js`. It is a class instantiated once inside `useSchedulerStore`. All queue operations read/write directly to Supabase (no local cache — React Query is the cache layer).

**Key methods:**
- `getQueue(machineId, allOrders)` — filters allOrders for machine, status IN ['SCHEDULED', 'IN_PROGRESS'], sorted by start time
- `getGreedyAnchor(machineId, allOrders, excludeTaskId?)` — finds where to start scheduling (last task's end, or now if queue empty). Skips IN_PROGRESS tasks correctly.
- `rescheduleFromAnchor(machineId, tasks, anchor)` — recomputes times sequentially from anchor. **Preserves IN_PROGRESS status** (does not overwrite to SCHEDULED).
- `scheduleTaskAtEnd(machineId, taskId, allOrders, allMachines)` — drag-and-drop scheduling
- `reorderQueue(machineId, taskIds, allOrders)` — after manual sort
- `removeFromQueue(machineId, taskId, allOrders)` — unschedules task + reschedules remaining
- `createPauseTask(machineId, durationHours, allMachines, allOrders)` — creates a fake PAUSE ODP
- `splitTaskAroundUnavailability(startTime, durationHours, machineId)` — builds segments that skip unavailable CET hours

**Duration used in scheduling:** `time_remaining` (if > 0) → `duration` → fallback 1h. Does NOT apply efficiency (efficiency only applies when duration is initially calculated from quantity via TC101/phase formula).

**PAUSE tasks:** `odp_number LIKE '%PAUSE%'`, `quantity = 0`, `description` JSON has `is_pause: true`.

### Duration Calculation (BacklogForm / bulk_schedule.js)

**TC101 formula (CONFEZIONAMENTO):** `duration = quantity / (v_conf × efficiency) + t_setup_conf`
**STAMPA formula:** `duration = (bag_step × quantity / 1000) / (v_stampa × efficiency) + t_setup_stampa`

Efficiency comes from `site_efficiency` table keyed by `work_center`.

In `useProductionCalculations.js`: `calculateProductionMetrics(phase, quantity, bagStep, efficiency = 0.80)`
In `BacklogForm.jsx`: fetches `useSiteEfficiency()`, looks up `siteEfficiencyMap[workCenter]`, passes to above.
In `bulk_schedule.js`: fetches `site_efficiency` + `machines` tables at startup, builds UUID→efficiency map.

### Timezone Rules

**All times stored in Supabase are UTC.** The app converts to CET (Europe/Rome) for display.

- `ITALY_TIMEZONE = 'Europe/Rome'` (handles CET UTC+1 and CEST UTC+2 DST automatically)
- `machine_availability.unavailable_hours` stores **CET hours** (0-23)
- `cetHourToUTC(dateStr, cetHour)` in `dateFormatting.js` converts CET hour → UTC Date
- `formatDeliveryDate(isoString)` → `dd/MM/yyyy` in Italy tz — use **everywhere** for delivery dates
- `formatScheduledTime(isoString)` → `dd/MM HH:mm` in Italy tz
- `isSameDay` must always wrap args in `toZonedTime(date, ITALY_TIMEZONE)` — bare `isSameDay` gives wrong result for overnight tasks

---

## 6. Bugs Fixed in This Session (2026-03-19)

### BUG 1 — CRITICAL: Duplicate `removeFromQueue` (was breaking removes silently)

**File:** `src/store/scheduling/spotifyQueueScheduler.js`

JS class fields: a second `removeFromQueue = async (taskId)` stub (1-arg) was silently overriding the proper 3-arg implementation. **Fixed:** deleted the stub. Now only the 3-arg version exists.

Effect before fix:
- **QueueTaskCard** called `removeTaskFromQueue(machineId, task.id, allOrders)` → stub received `machineId` as taskId → updated wrong record → **silent no-op, task stayed in queue**
- **GanttChart** called `removeTaskFromQueue(event.id)` → task was unscheduled but **queue gap not filled** (no reschedule)

**GanttChart also fixed** (`src/components/GanttChart.jsx` ~line 435): now calls `removeTaskFromQueue(machine.id, event.id, allOrders)` correctly.

### BUG 2 — MEDIUM: `getQueue` excluded IN_PROGRESS tasks

**File:** `src/store/scheduling/spotifyQueueScheduler.js` line 29

Filter was `status === 'SCHEDULED'`. Changed to `['SCHEDULED', 'IN_PROGRESS'].includes(task.status)`.

Also: `rescheduleFromAnchor` was unconditionally setting `status: 'SCHEDULED'` on every task — now preserves IN_PROGRESS: `status: task.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'SCHEDULED'`

### BUG 3 — MEDIUM: `isSameDay` without CET timezone

**File:** `src/components/GanttChart.jsx` (4 occurrences, lines ~129, 130, 207, 208)

Tasks spanning UTC midnight (22:00-02:00 CET) rendered on wrong Gantt column. Fixed by wrapping both args in `toZonedTime(date, ITALY_TIMEZONE)`.

### BUG 4 — MEDIUM: `delivery_date` displayed 1 day early

`new Date('2026-03-20')` parses as UTC midnight = 23:00 March 19 CET → displayed as March 19.

**Files fixed:**
- `src/pages/BacklogListPage.jsx` — table column + XLSX export (uses `formatInItalyTimezone`)
- `src/pages/MachineOverviewPage.jsx` — table column + tooltip
- `src/components/TaskPoolDataTable.jsx` — tooltip
- `src/components/QueueTaskCard.jsx` — tooltip

All now use `formatDeliveryDate()` / `formatInItalyTimezone()`. Unused `import { format } from 'date-fns'` removed from all 4 files.

### BUG 5 — MINOR: DataTable filter falsy check

**File:** `src/components/DataTable.jsx` line 49

`!itemValue` was excluding rows where column value is `0` (e.g., PAUSE tasks with `quantity=0`). Changed to `itemValue == null`.

---

## 7. Features Added in This Session (2026-03-19)

### Feature 1 — Site Efficiency Multiplier

**Purpose:** Duration calculation now multiplies speed by an efficiency factor (currently 80% for both sites) from the `site_efficiency` Supabase table.

**Formula change:**
- Before: `quantity / v_conf + t_setup`
- After: `quantity / (v_conf × efficiency) + t_setup`

**Files changed:**
- `SUPABASE_MANUAL_STEPS.md` — Step 4: SQL to create `site_efficiency` table (user confirmed created)
- `src/services/api.js` — `getSiteEfficiency()` method added
- `src/hooks/useQueries.js` — `useSiteEfficiency()` hook + `queryKeys.siteEfficiency` added
- `src/hooks/useProductionCalculations.js` — `calculateProductionMetrics` now accepts `efficiency` (default 0.80); applied to both STAMPA and CONFEZIONAMENTO
- `src/components/BacklogForm.jsx` — imports `useSiteEfficiency`, looks up efficiency by `workCenter`, passes to `calculateProductionMetrics`
- `bulk_schedule.js` — fetches `site_efficiency` + `machines` tables; `computeDuration(order, efficiency)` applies efficiency to TC101 formula

### Feature 2 — Pause Dropdown 1h to 100h

**File:** `src/pages/SpotifySchedulerPage.jsx`

Old: hardcoded options `[0.5, 1, 2, 4, 8, 12, 16, 24]` hours.
New: `Array.from({ length: 100 }, (_, i) => i + 1)` → options 1h through 100h.

---

## 8. Files NOT Changed (Reference)

| File | What it does — do not break |
|---|---|
| `src/utils/dateFormatting.js` | All timezone utilities — do not modify |
| `src/utils/taskSegments.js` | Parses `description` JSON segments for Gantt rendering |
| `src/store/scheduling/machineAvailability.js` | Reads from `machine_availability` table |
| `bulk_schedule.js` | One-time bulk scheduling script (run from CLI with `SUPABASE_SERVICE_KEY=xxx node bulk_schedule.js`) |
| `SUPABASE_MANUAL_STEPS.md` | All manual SQL steps for DB setup — Steps 1-4 should all be run |

---

## 9. What MUST Be Validated Before Delivery

### End-to-end functional tests (manual, in the browser)

- [ ] **Remove from queue (QueueTaskCard):** Click remove on a queued task → task disappears from queue, subsequent tasks shift up to fill the gap
- [ ] **Remove from Gantt (x button):** Click x on a Gantt task → task is unscheduled AND subsequent tasks reschedule to fill the gap
- [ ] **IN_PROGRESS status preserved:** While a task is IN_PROGRESS, add or remove another task in the same machine queue → the IN_PROGRESS task keeps its status
- [ ] **Overnight Gantt rendering:** A task scheduled 22:00-02:00 CET should appear entirely on the correct CET day column (not split to next day)
- [ ] **Delivery date display:** An order with `delivery_date = '2026-03-20'` should show **20/03/2026** everywhere — not 19/03/2026
- [ ] **Pause dropdown:** The Spotify pause dropdown shows hours 1 through 100
- [ ] **ODP duration calculation in BacklogForm:** Create/edit ODP, select a CONFEZIONAMENTO phase, enter quantity, click Calculate → duration should reflect 80% efficiency (i.e., ~25% longer than without efficiency)
- [ ] **DataTable filter with PAUSE tasks:** Apply any column filter in the Task Pool while PAUSE tasks are visible — PAUSE tasks should remain visible

### Supabase / infrastructure checks

- [ ] Verify `site_efficiency` table exists with 2 rows (ZANICA, BUSTO_GAROLFO at 0.80)
- [ ] Verify RLS on `site_efficiency`: anon key can SELECT, cannot INSERT/UPDATE/DELETE
- [ ] Verify all cron jobs from `SUPABASE_MANUAL_STEPS.md` Steps 1-4 are installed (`SELECT jobid, jobname, schedule FROM cron.job ORDER BY jobid;`)
- [ ] Run `SUPABASE_SERVICE_KEY=xxx node bulk_schedule.js --dry-run` and verify efficiency is logged correctly per machine

---

## 10. Known Risks / Things to Investigate

### HIGH
- **`'IN_PROGRESS'` vs `'IN PROGRESS'` string mismatch:** `constants.js` defines `IN_PROGRESS: 'IN PROGRESS'` (with space). The scheduler code and some filters use `'IN_PROGRESS'` (with underscore). Verify which string the DB constraint actually enforces — if they don't match, the IN_PROGRESS guard in `getQueue` won't work. Check: `SELECT status, count(*) FROM odp_orders GROUP BY status;`

### MEDIUM
- **`SchedulerPage.jsx`** — appears to be a legacy page. Verify if it's still reachable via routing and if it uses any of the patched utilities (isSameDay, etc.)
- **`MachineCalendarPage.jsx`** — uses FullCalendar. Check if it has any UTC/CET date rendering issues similar to BUG 3
- **`description` JSON parsing** — the `description` field on `odp_orders` stores segments as JSON. If any order has a malformed description (from a failed schedule), Gantt rendering may throw. `taskSegments.js` handles this, but verify error boundaries are in place
- **Efficiency for STAMPA in bulk_schedule.js** — `bulk_schedule.js` applies efficiency only to TC101 (CONFEZIONAMENTO). STAMPA orders also go through `computeDuration` which hits `order.duration` or `order.time_remaining` first — so efficiency only matters for orders with null duration. STAMPA orders rarely have null duration (they have a phase-based duration set). **Verify this assumption is correct.**

### LOW
- **Supabase anon key hardcoded** — intentional per architecture, but confirm the key in `client.js` matches what's deployed
- **Sentry DSN** — check `src/services/sentry.js` has the correct DSN and is initialized properly for production
- **LocalStorage keys** — `spotifySchedulerAuth`, `spotifySchedulerFilters`, `selectedWorkCenter` — verify these don't cause stale-state issues between users if the same browser is reused
- **React Query staleTime** — `useSiteEfficiency` has 5min stale time. If efficiency is updated in Supabase, the UI won't reflect it for up to 5 minutes. Consider adding a manual refetch button in a settings page if needed.

---

## 11. How to Run

```bash
# Dev server
cd flexi-react-app
npm install
npm run dev

# Bulk scheduling (requires Supabase service key)
cd /path/to/ship
SUPABASE_SERVICE_KEY=sbp_xxx node bulk_schedule.js --dry-run   # preview
SUPABASE_SERVICE_KEY=sbp_xxx node bulk_schedule.js              # execute
```

The app has a simple password gate (`'1234'`) on the Spotify Scheduler page — intentional, confirmed by user.

---

## 12. Key Code Patterns

### Scheduling a task (drag-and-drop)
```
SpotifySchedulerPage drag end
  → useSchedulerStore.scheduleTaskAtEndOfQueue(machineId, taskId, allOrders, allMachines)
  → SpotifyQueueScheduler.scheduleTaskAtEnd
  → splitTaskAroundUnavailability (respects machine_availability CET unavailable hours)
  → apiService.updateOdpOrder (writes segments JSON to description field)
  → queryClient.refetchQueries(['orders'])
```

### Removing a task
```
QueueTaskCard remove button OR GanttChart x button
  → useSchedulerStore.removeTaskFromQueue(machineId, taskId, allOrders)
  → SpotifyQueueScheduler.removeFromQueue
  → apiService.updateOdpOrder(taskId, { status: 'NOT SCHEDULED', scheduled_machine_id: null, ... })
  → getGreedyAnchor (excludes removed task, finds new start point)
  → rescheduleFromAnchor (recomputes times for all remaining tasks)
  → queryClient.refetchQueries(['orders'])
```

### Duration calculation in BacklogForm
```
User selects phase → clicks Calculate
  → useSiteEfficiency() → siteEfficiencyMap[workCenter] (e.g., 0.80)
  → calculateProductionMetrics(phase, quantity, bagStep, efficiency)
  → CONFEZIONAMENTO: quantity / (v_conf × 0.80) + t_setup_conf
  → STAMPA: (bag_step × quantity / 1000) / (v_stampa × 0.80) + t_setup_stampa
  → setCalculationResults → shown in UI → saved to odp_orders.duration on submit
```

---

## 13. Git State

Branch: `feature/time_zones_and_minor_edits`
Main branch: `main`

Files modified vs main (at session start — additional changes made in this session):
- `flexi-react-app/src/components/GanttChart.jsx`
- `flexi-react-app/src/components/QueueTaskCard.jsx`
- `flexi-react-app/src/components/TaskPoolDataTable.jsx`
- `flexi-react-app/src/pages/BacklogListPage.jsx`
- `flexi-react-app/src/pages/MachineOverviewPage.jsx`
- `flexi-react-app/src/store/scheduling/spotifyQueueScheduler.js`

Added this session (not yet committed):
- `flexi-react-app/src/services/api.js` (getSiteEfficiency)
- `flexi-react-app/src/hooks/useQueries.js` (useSiteEfficiency)
- `flexi-react-app/src/hooks/useProductionCalculations.js` (efficiency param)
- `flexi-react-app/src/components/BacklogForm.jsx` (uses useSiteEfficiency)
- `flexi-react-app/src/pages/SpotifySchedulerPage.jsx` (pause dropdown)
- `flexi-react-app/src/components/DataTable.jsx` (filter fix)
- `bulk_schedule.js` (efficiency in computeDuration)
- `SUPABASE_MANUAL_STEPS.md` (Step 4 added)
- `current_state.md` (this file)
- `SUPABASE_MANUAL_STEPS.md`
- `bulk_schedule.js`
- `combined_machines.xlsx`
- `supabase/` directory
