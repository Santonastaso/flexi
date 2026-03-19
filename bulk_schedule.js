/**
 * Bulk Schedule — odp_orders LEFT JOIN xlsx (machine assignment) + TC101 duration
 *
 * Logic:
 *   1. Load all odp_orders from DB
 *   2. Load xlsx → build ODP → machine_uuid lookup
 *   3. For each order that has a machine assignment in the xlsx:
 *        - compute duration via TC101 if not already set
 *        - schedule sequentially on that machine, respecting working hours
 *   4. Orders not in the xlsx are untouched
 *
 * Working hours come from machine_availability table (requires service key — RLS blocks anon).
 *
 * Usage:
 *   SUPABASE_SERVICE_KEY=sbp_xxx node bulk_schedule.js --dry-run
 *   SUPABASE_SERVICE_KEY=sbp_xxx node bulk_schedule.js
 */

const { createClient } = require('./flexi-react-app/node_modules/@supabase/supabase-js');
const XLSX = require('./flexi-react-app/node_modules/xlsx');
const { toZonedTime, fromZonedTime } = require('./flexi-react-app/node_modules/date-fns-tz');
const { format } = require('./flexi-react-app/node_modules/date-fns');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://jyrfznujcyqskpfthrsf.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cmZ6bnVqY3lxc2twZnRocnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODM1OTMsImV4cCI6MjA3MDY1OTU5M30.JOZLGHslSQO7wDeFSq7FHAV6_VNtD9DS-gMNUu4rEnM';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || SUPABASE_ANON;
const XLSX_FILE     = path.join(__dirname, 'combined_machines.xlsx');
const ITALY_TZ      = 'Europe/Rome';
const DRY_RUN       = process.argv.includes('--dry-run');

// TC101 phase (CONFEZIONAMENTO): duration = quantity / v_conf + t_setup
const TC101_V_CONF  = 5000;  // pz/h
const TC101_T_SETUP = 1.5;   // h

// ── Machine map: xlsx machine_id → Supabase UUID ──────────────────────────────
const MACHINE_MAP = {
  '1':  '993b5f0a-413e-4678-921f-29268074f0a0',
  '2':  'ad247f0a-d47e-4212-88cd-701dd6e61339',
  '3':  'ee95c7cc-93a1-4698-9896-09116a3657f3',
  '4':  '4f750402-8281-4f2c-a771-fd6ab1e47a7f',
  '5':  '1f8e4003-1cde-48ab-9f31-479ff9298329',
  '7':  '10bd2827-aebc-4bbb-922d-edd0e40e3a3d',
  '8':  '91f16522-82fb-495a-a662-3a987f4e2066',
  '9':  '9e43e3be-17d0-4503-aed9-83ec84d99498',
  '10': '1585fc89-b78a-4284-b522-ed8596beb828',
  '11': 'b5e12af9-57b2-44f7-8848-2cd10d62f381',
  '12': 'aaf7eeed-af26-46db-aa96-9acb6f925027',
  '13': 'da398e9d-599b-4c66-8edf-ee058a04dd46',
  '14': '8fda379d-1add-4aae-8ddf-3ba36e61be9f',
  '15': 'e3f00b58-334a-4899-a874-9e5401d1f99e',
  '16': 'cc965c7f-4281-43f4-8447-7cdafbeb88a1',
  '17': '2880c931-0e67-49ed-9798-453704b1e4f8',
  '18': 'c5322eb9-0dc6-4e2b-a072-85a662a08cac',
  '19': '5979bb55-15f6-478a-aea9-b03484846584',
  '20': '82b0d50b-cdd5-4b14-aa45-6e7edaf3d3d2',
  '21': '688acf67-0f96-4a85-8e16-d87d9caf9224',
  '22': '399ad045-3e98-49e1-a62c-aab92b46472a',
  '23': '9b5ef743-c046-43f4-a2ce-3a7fdffca11f',
  '24': '6a964271-c708-42fe-b6c4-80c95c749174',
  '25': 'b4ab336b-091c-4cd5-bfba-8ba33c4bba27',
  '26': '8354f6d9-8c31-41e4-bc2f-3567d4760a90',
  '27': '8f0225f0-ea56-448d-bf10-c2b60ba107e7',
  '28': '5293e76a-b675-4246-b77a-b833a72ab0ee',
  '29': 'a855174b-a966-40ce-a12f-a93f41660ac6',
  '30': 'ef72a269-0a49-458f-a6f5-d06f14cfbaa0',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeOdp(value) {
  const raw = String(value).trim();
  if (!raw || raw.length <= 4) return raw;
  return raw.slice(4).replace(/^0+/, '') || raw.slice(4);
}

function roundToNext15Min(date) {
  const d = new Date(date);
  const next = Math.ceil(d.getUTCMinutes() / 15) * 15;
  if (next === 60) d.setUTCHours(d.getUTCHours() + 1, 0, 0, 0);
  else d.setUTCMinutes(next, 0, 0);
  return d;
}

function cetHourToUTC(dateStr, cetHour) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day));
  const zoned = toZonedTime(base, ITALY_TZ);
  zoned.setHours(cetHour, 0, 0, 0);
  return fromZonedTime(zoned, ITALY_TZ);
}

function buildUnavailableSlots(availCache, startTime, endTime) {
  const slots = [];
  let cur = new Date(startTime);
  cur.setUTCHours(0, 0, 0, 0);
  const end = new Date(endTime);
  end.setUTCHours(23, 59, 59, 999);
  while (cur <= end) {
    const dateStr = format(cur, 'yyyy-MM-dd');
    for (const h of (availCache[dateStr] || [])) {
      const s = cetHourToUTC(dateStr, parseInt(h));
      slots.push({ start: s, end: new Date(s.getTime() + 3600_000) });
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return slots;
}

function splitTaskAroundUnavailability(startTime, durationHours, unavailableSlots) {
  const segments = [];
  let cur = new Date(startTime);
  let remaining = durationHours;

  // Skip initial unavailable slots
  let moved = true;
  while (moved) {
    moved = false;
    for (const s of unavailableSlots) {
      if (cur >= s.start && cur < s.end) { cur = new Date(s.end); moved = true; break; }
    }
  }

  let iters = 0;
  const maxIters = durationHours * 100;
  while (remaining > 0 && iters < maxIters) {
    const hourStart = new Date(cur);
    const hourEnd   = new Date(cur.getTime() + 3600_000);
    const overlap   = unavailableSlots.find(s => hourStart < s.end && hourEnd > s.start);

    if (!overlap) {
      const last = segments[segments.length - 1];
      if (!last || last.end.getTime() !== hourStart.getTime()) {
        segments.push({ start: new Date(hourStart), end: new Date(hourEnd), duration: 1 });
      } else {
        last.end = new Date(hourEnd);
        last.duration += 1;
      }
      remaining -= 1;
    } else if (hourStart < overlap.start) {
      const partial = (overlap.start.getTime() - hourStart.getTime()) / 3600_000;
      if (partial > 0) {
        const last = segments[segments.length - 1];
        if (!last || last.end.getTime() !== hourStart.getTime()) {
          segments.push({ start: new Date(hourStart), end: new Date(overlap.start), duration: partial });
        } else {
          last.end = new Date(overlap.start);
          last.duration += partial;
        }
        remaining -= partial;
      }
      cur = new Date(overlap.end);
      iters++;
      continue;
    }

    cur.setUTCHours(cur.getUTCHours() + 1);
    iters++;

    let again = true;
    while (again) {
      again = false;
      for (const s of unavailableSlots) {
        if (cur >= s.start && cur < s.end) { cur = new Date(s.end); again = true; break; }
      }
    }
  }

  if (segments.length === 0) throw new Error('No available slots found');
  return { segments, startTime: segments[0].start, endTime: segments[segments.length - 1].end };
}

function computeDuration(order, efficiency = 0.80) {
  if (order.time_remaining != null && order.time_remaining > 0) return order.time_remaining;
  if (order.duration       != null && order.duration > 0)       return order.duration;
  if (order.quantity       != null && order.quantity > 0)       return order.quantity / (TC101_V_CONF * efficiency) + TC101_T_SETUP;
  return null;
}

function buildDescription(segments) {
  return JSON.stringify({
    segments: segments.map(s => ({ start: s.start.toISOString(), end: s.end.toISOString(), duration: s.duration })),
    is_pause: false,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (DRY_RUN) console.log('DRY RUN — no changes will be written\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // ── 1. Load all odp_orders
  console.log('Loading odp_orders...');
  let allOrders = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('odp_orders')
      .select('id, odp_number, duration, time_remaining, quantity, status, scheduled_machine_id')
      .range(from, from + 999);
    if (error) throw new Error('Orders fetch failed: ' + error.message);
    allOrders = allOrders.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`  ${allOrders.length} orders in DB`);

  // ── 2. Load xlsx → build normalizedOdp → { machineUuid, xlsxPosition } lookup
  console.log('\nLoading xlsx machine assignments...');
  const wb   = XLSX.readFile(XLSX_FILE);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`  ${rows.length} rows in xlsx`);

  // machineQueues: machineUuid → [ { xlsxPosition, normalizedOdp } ] in xlsx order
  const machineQueues = {};
  let xlsxNoMachine = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const machineUuid = MACHINE_MAP[String(row.machine_id)];
    if (!machineUuid) { xlsxNoMachine++; continue; }
    if (!machineQueues[machineUuid]) machineQueues[machineUuid] = [];
    machineQueues[machineUuid].push({ xlsxPosition: i, normalizedOdp: String(row.OPD) });
  }
  if (xlsxNoMachine > 0) {
    console.log(`  ${xlsxNoMachine} xlsx rows skipped (machine_id not in Supabase: 49, 50, 51, 52, 54)`);
  }

  // ── 3. Build DB lookup: normalizedOdp → order
  const orderByOdp = {};
  for (const o of allOrders) {
    orderByOdp[normalizeOdp(o.odp_number)] = o;
  }

  // ── 4. Load machine_availability (needs service key)
  const now        = new Date();
  const horizonEnd = new Date(now);
  horizonEnd.setMonth(horizonEnd.getMonth() + 6);
  const startStr   = format(now, 'yyyy-MM-dd');
  const endStr     = format(horizonEnd, 'yyyy-MM-dd');
  const machineIds = Object.keys(machineQueues);

  console.log(`\nLoading machine_availability ${startStr} → ${endStr}...`);
  const { data: availData, error: availErr } = await supabase
    .from('machine_availability')
    .select('machine_id, date, unavailable_hours')
    .in('machine_id', machineIds)
    .gte('date', startStr)
    .lte('date', endStr);

  if (availErr || !availData || availData.length === 0) {
    console.error(availErr ? `  ERROR: ${availErr.message}` : '  0 rows — RLS blocking anon access.');
    console.error('  Re-run with: SUPABASE_SERVICE_KEY=<service_role_key> node bulk_schedule.js');
    process.exit(1);
  }
  console.log(`  ${availData.length} availability records loaded`);

  const availCache = {};
  for (const row of availData) {
    if (!availCache[row.machine_id]) availCache[row.machine_id] = {};
    availCache[row.machine_id][row.date] = row.unavailable_hours || [];
  }

  // ── 5. Load site_efficiency → build per-machine efficiency map
  console.log('\nLoading site_efficiency...');
  const { data: efficiencyData, error: effErr } = await supabase
    .from('site_efficiency')
    .select('work_center, efficiency');
  if (effErr) console.warn('  Could not load site_efficiency (defaulting to 80%):', effErr.message);

  const effByWorkCenter = {};
  for (const r of (efficiencyData || [])) {
    effByWorkCenter[r.work_center] = Number(r.efficiency);
  }

  const { data: machinesData, error: machErr } = await supabase
    .from('machines')
    .select('id, work_center')
    .in('id', machineIds);
  if (machErr) console.warn('  Could not load machines work_center:', machErr.message);

  const efficiencyByMachine = {};
  for (const m of (machinesData || [])) {
    efficiencyByMachine[m.id] = effByWorkCenter[m.work_center] ?? 0.80;
  }
  console.log(`  ${Object.keys(efficiencyByMachine).length} machines mapped, efficiencies: ${
    [...new Set(Object.values(efficiencyByMachine))].map(e => `${Math.round(e * 100)}%`).join(', ')
  }`);

  // ── 6. Schedule per machine
  let totalScheduled = 0;
  let totalCleared   = 0;
  let noMatch        = 0;
  let noDuration     = 0;

  for (const [machineUuid, queue] of Object.entries(machineQueues)) {
    const machineLabel = Object.entries(MACHINE_MAP).find(([, v]) => v === machineUuid)?.[0];
    const machineAvail = availCache[machineUuid] || {};

    // Resolve each xlsx row to a DB order, preserving xlsx order
    const resolved = [];
    for (const { normalizedOdp } of queue) {
      const order = orderByOdp[normalizedOdp];
      if (!order) { noMatch++; continue; }
      const efficiency = efficiencyByMachine[machineUuid] ?? 0.80;
      const duration = computeDuration(order, efficiency);
      if (duration === null) { noDuration++; continue; }
      resolved.push({ order, duration });
    }

    console.log(`\nHoller ${machineLabel}  →  ${queue.length} in xlsx, ${resolved.length} to schedule`);

    if (resolved.length === 0) continue;

    // Clear existing scheduled tasks on this machine
    const existingScheduled = allOrders.filter(
      o => o.scheduled_machine_id === machineUuid && o.status === 'SCHEDULED'
    );
    if (existingScheduled.length > 0) {
      console.log(`  Clearing ${existingScheduled.length} existing tasks...`);
      if (!DRY_RUN) {
        const ids = existingScheduled.map(o => o.id);
        for (let i = 0; i < ids.length; i += 100) {
          const { error } = await supabase
            .from('odp_orders')
            .update({ status: 'NOT SCHEDULED', scheduled_machine_id: null,
                      scheduled_start_time: null, scheduled_end_time: null, description: null })
            .in('id', ids.slice(i, i + 100));
          if (error) console.error('  ERROR clearing:', error.message);
        }
      }
      totalCleared += existingScheduled.length;
    }

    // Schedule sequentially from now
    let currentTime = roundToNext15Min(now);

    for (const { order, duration } of resolved) {
      const estimatedEnd = new Date(currentTime.getTime() + (duration + 7 * 24) * 3600_000);
      const unavailSlots = buildUnavailableSlots(machineAvail, currentTime, estimatedEnd);

      let result;
      try {
        result = splitTaskAroundUnavailability(currentTime, duration, unavailSlots);
      } catch (e) {
        console.error(`  ERROR ${normalizeOdp(order.odp_number)}: ${e.message}`);
        continue;
      }

      const { segments, startTime, endTime } = result;
      const norm = normalizeOdp(order.odp_number);
      console.log(`  ODP ${norm.padEnd(6)}  ${startTime.toISOString().slice(0, 16)} → ${endTime.toISOString().slice(0, 16)}  (${Math.round(duration * 100) / 100}h, ${segments.length} seg)`);

      if (!DRY_RUN) {
        const { error } = await supabase
          .from('odp_orders')
          .update({
            status:               'SCHEDULED',
            scheduled_machine_id: machineUuid,
            scheduled_start_time: startTime.toISOString(),
            scheduled_end_time:   endTime.toISOString(),
            description:          buildDescription(segments),
          })
          .eq('id', order.id);
        if (error) { console.error(`  ERROR writing ${norm}:`, error.message); continue; }
      }

      currentTime = roundToNext15Min(new Date(endTime));
      totalScheduled++;
    }
  }

  // ── 6. Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Scheduled:              ${totalScheduled}`);
  console.log(`Cleared (existing):     ${totalCleared}`);
  console.log(`Skipped — not in DB:    ${noMatch}`);
  if (noDuration > 0)
    console.log(`Skipped — no duration:  ${noDuration}`);
  console.log(`Skipped — no machine:   ${xlsxNoMachine} (xlsx machine_id 49,50,51,52,54)`);
  if (DRY_RUN) console.log('\nDRY RUN — nothing written to DB.');
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
