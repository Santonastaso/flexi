# Supabase Manual Steps

These are the DB-side changes that need to be run manually in the **Supabase SQL Editor**.
All scripts are idempotent (safe to re-run).

---

## Step 1 — Sequence the midnight cron jobs (prevent race condition)

**Problem:** Jobs 3, 4, and 5 all fire at `0 0 * * *` concurrently. This creates a race where
`delete_orphan_odp_orders` can remove an order that `sync_orders_from_master_dump` hasn't re-inserted yet.
The fix is a single wrapper that runs all four operations in the correct sequence.

Actual job IDs (confirmed from live DB):
| jobid | jobname | what it does |
|---|---|---|
| 1 | master-order-sync | hourly sync — **keep as-is** |
| 3 | cron_delete_completed_orders_master_dump | cleans the dump table |
| 4 | cron_delete_completed_odp_orders | removes completed from odp_orders |
| 5 | delete_orphan_odp_orders_job | removes orphan orders |

**Run this in the SQL Editor:**

```sql
-- 1. Create (or update) the wrapper pipeline function
CREATE OR REPLACE FUNCTION public.midnight_cleanup_pipeline()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Step 1: sync new/updated orders from the dump into odp_orders
  PERFORM public.sync_orders_from_master_dump();
  -- Step 2: remove odp_orders entries no longer present in the dump
  PERFORM public.delete_orphan_odp_orders();
  -- Step 3: remove completed orders from odp_orders (progress >= 100)
  PERFORM public.delete_completed_odp_orders();
  -- Step 4: clean up completed entries from the dump table itself
  PERFORM public.delete_completed_orders_master_dump();
END;
$$;

-- 2. Unschedule the three standalone midnight jobs
SELECT cron.unschedule(3);  -- cron_delete_completed_orders_master_dump
SELECT cron.unschedule(4);  -- cron_delete_completed_odp_orders
SELECT cron.unschedule(5);  -- delete_orphan_odp_orders_job

-- 3. Schedule the single sequential pipeline
SELECT cron.schedule(
  'midnight_cleanup_pipeline',
  '0 0 * * *',
  'SELECT public.midnight_cleanup_pipeline()'
);
```

**Verify:**
```sql
SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobid;
-- Expected: jobid 1 (hourly master-order-sync) + new midnight_cleanup_pipeline job only
```

**Rollback:**
```sql
-- Find the jobid of the new pipeline job
SELECT jobid FROM cron.job WHERE jobname = 'midnight_cleanup_pipeline';
-- Then unschedule it (replace 6 with actual jobid):
SELECT cron.unschedule(6);
DROP FUNCTION IF EXISTS public.midnight_cleanup_pipeline();

-- Re-schedule the originals
SELECT cron.schedule('cron_delete_completed_orders_master_dump', '0 0 * * *', 'SELECT public.delete_completed_orders_master_dump()');
SELECT cron.schedule('cron_delete_completed_odp_orders',         '0 0 * * *', 'SELECT public.delete_completed_odp_orders()');
SELECT cron.schedule('delete_orphan_odp_orders_job',             '0 0 * * *', 'SELECT public.delete_orphan_odp_orders()');
```

---

## Step 2 — Run orphan delete hourly (optional, low risk)

**Problem:** Orphan orders (removed from the ERP dump) are only cleaned up once per day at midnight. If the dump is updated during the day, stale orders stay visible until the next midnight run.

**Run this in the SQL Editor:**

```sql
-- Change the orphan delete to run every hour at :30
-- First unschedule it from the midnight pipeline wrapper (if Step 1 above is done)
-- If Step 1 was NOT done, unschedule it separately first:
-- SELECT cron.unschedule('delete_orphan_odp_orders');

-- Add standalone hourly schedule
SELECT cron.schedule(
  'hourly_delete_orphan_odp_orders',
  '30 * * * *',
  'SELECT public.delete_orphan_odp_orders()'
);
```

> **Note:** If you did Step 1, the midnight pipeline already calls `delete_orphan_odp_orders`. This hourly schedule is an additional run during the day and is safe — the function is idempotent.

**Rollback:**
```sql
SELECT cron.unschedule('hourly_delete_orphan_odp_orders');
```

---

## Step 3 — Clean up stale PAUSE tasks

**Problem:** PAUSE tasks (`odp_number ILIKE '%PAUSE%'`) can never be deleted by any existing cron:
- `delete_orphan_odp_orders` explicitly skips them (`NOT ILIKE '%PAUSE%'` guard).
- `delete_completed_odp_orders` uses `progress >= 100`, but PAUSE tasks have `quantity=0`, so `progress` is always 0 — they are never deleted.

Result: stale PAUSE tasks accumulate forever. There is currently at least 1 in production with a `scheduled_end_time` in mid-March 2026.

**Run this in the SQL Editor:**

```sql
-- 1. Create the cleanup function
CREATE OR REPLACE FUNCTION public.delete_stale_pause_tasks()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.odp_orders
  WHERE odp_number ILIKE '%PAUSE%'
    AND scheduled_end_time < NOW() - INTERVAL '1 day';
END;
$$;

-- 2. Run it immediately to clear the current stale one
SELECT public.delete_stale_pause_tasks();

-- 3. Schedule it daily at 00:10 (after the midnight pipeline)
SELECT cron.schedule(
  'daily_delete_stale_pause_tasks',
  '10 0 * * *',
  'SELECT public.delete_stale_pause_tasks()'
);
```

**Verify:**
```sql
SELECT odp_number, scheduled_end_time
FROM odp_orders
WHERE odp_number ILIKE '%PAUSE%';
-- Should return 0 rows after the manual run above
```

**Rollback:**
```sql
SELECT cron.unschedule('daily_delete_stale_pause_tasks');
DROP FUNCTION IF EXISTS public.delete_stale_pause_tasks();
```

---

## Step 4 — Create `site_efficiency` table (production site efficiency multiplier)

**Purpose:** Stores the efficiency factor per production site (`ZANICA`, `BUSTO_GAROLFO`).
Used to correct TC101 duration: `duration = quantity / (v_conf × efficiency) + t_setup`.
Currently both sites are at 80% (0.80). Edit the table rows in Supabase to change it.

**Run this in the SQL Editor:**

```sql
-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.site_efficiency (
  work_center  TEXT        PRIMARY KEY,
  efficiency   NUMERIC     NOT NULL DEFAULT 0.80 CHECK (efficiency > 0 AND efficiency <= 1),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Seed initial values (both sites start at 80%)
INSERT INTO public.site_efficiency (work_center, efficiency)
VALUES
  ('ZANICA',        0.80),
  ('BUSTO_GAROLFO', 0.80)
ON CONFLICT (work_center) DO NOTHING;

-- 3. Enable Row Level Security (read-only for anon, full access for authenticated)
ALTER TABLE public.site_efficiency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_efficiency_select" ON public.site_efficiency
  FOR SELECT USING (true);

CREATE POLICY "site_efficiency_modify" ON public.site_efficiency
  FOR ALL USING (auth.role() = 'authenticated');
```

**Verify:**
```sql
SELECT * FROM public.site_efficiency;
-- Expected: 2 rows — ZANICA 0.80, BUSTO_GAROLFO 0.80
```

**To update efficiency for a site:**
```sql
UPDATE public.site_efficiency
SET efficiency = 0.75, updated_at = now()
WHERE work_center = 'ZANICA';
```

---

## Notes

- Run Steps 1, 2, 3 independently — they do not depend on each other.
- Step 1 is the most impactful (fixes the race condition). Steps 2 and 3 are housekeeping.
- All functions are `CREATE OR REPLACE`, so re-running them is safe.
- The ERP dump (`orders_master_dump`) last updated on 2026-03-12. If the dump is stale, check the upstream ERP process that writes to that table — the sync function runs correctly, there is just nothing new to sync.
