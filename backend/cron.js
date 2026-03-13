const { db, stmts } = require('./db');

// ─── Same link helpers as sync.js ────────────────────────
function parseDateFromStatus(statusStr) {
  if (!statusStr) return null;
  const m = statusStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[\s\-]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!m) return null;
  const d = m[1].padStart(2, '0');
  const mo = m[2].padStart(2, '0');
  const y = m[3];
  const h = (m[4] || '00').padStart(2, '0');
  const min = (m[5] || '00').padStart(2, '0');
  const s = (m[6] || '00').padStart(2, '0');
  return `${y}-${mo}-${d}T${h}:${min}:${s}+07:00`;
}

function datesMatch(isoDate1, parsedDate2) {
  if (!isoDate1 || !parsedDate2) return false;
  return isoDate1.substring(0, 10) === parsedDate2.substring(0, 10);
}

function linkReviewToRaw(row) {
  if (!row.docs_url) return;
  if (row.type !== 'reviewed' && row.type !== 're-reviewed') return;
  const rawRow = stmts.findRawByDocsUrl.get({ docs_url: row.docs_url });
  if (!rawRow) return;
  // reviewed.status = date the raw meeting was logged (= when it was "reviewed")
  // Use statusDate as the reviewed_at moment; fallback to row.logged_at
  const statusDate = parseDateFromStatus(row.status);
  const dateMatch = datesMatch(rawRow.logged_at, statusDate);
  const confidence = dateMatch ? 'full' : 'partial';
  const reviewedAtIso = statusDate || row.logged_at;
  const rawTime = new Date(rawRow.logged_at).getTime();
  const reviewTime = new Date(reviewedAtIso).getTime();
  const reviewHours = (reviewTime - rawTime) / (1000 * 60 * 60);
  stmts.updateReviewLink.run({
    id: row.id,
    raw_logged_at: rawRow.logged_at,
    reviewed_at: reviewedAtIso,
    review_hours: Math.round(reviewHours * 100) / 100,
    is_sla_breach: reviewHours > 4 ? 1 : 0,
    link_confidence: confidence,
  });
}

function backfillRawToReview(row) {
  if (!row.docs_url) return;
  if (row.type !== 'raw') return;
  const reviewedRow = stmts.findReviewedByDocsUrl.get({ docs_url: row.docs_url });
  if (!reviewedRow) return;
  const reviewed = db.prepare('SELECT status, logged_at FROM logs WHERE id = ?').get(reviewedRow.id);
  const statusDate = parseDateFromStatus(reviewed?.status);
  const dateMatch = datesMatch(row.logged_at, statusDate);
  const confidence = dateMatch ? 'full' : 'partial';
  const reviewedAtIso = statusDate || reviewed?.logged_at || reviewedRow.logged_at;
  const rawTime = new Date(row.logged_at).getTime();
  const reviewTime = new Date(reviewedAtIso).getTime();
  const reviewHours = (reviewTime - rawTime) / (1000 * 60 * 60);
  stmts.updateReviewLink.run({
    id: reviewedRow.id,
    raw_logged_at: row.logged_at,
    reviewed_at: reviewedAtIso,
    review_hours: Math.round(reviewHours * 100) / 100,
    is_sla_breach: reviewHours > 4 ? 1 : 0,
    link_confidence: confidence,
  });
}

// ─── Core sync function ───────────────────────────────────
function syncFromData(data, sseClients = []) {
  const { rows, all_ids, fingerprint } = data;

  if (!rows || !Array.isArray(rows)) {
    throw new Error('Invalid data: rows must be an array');
  }

  let inserted = 0;
  let updated = 0;
  let deleted = 0;
  let linked = 0;

  const syncTransaction = db.transaction(() => {
    // STEP 1: UPSERT all rows
    for (const row of rows) {
      const existing = db.prepare('SELECT id FROM logs WHERE id = ?').get(row.id);
      stmts.upsertLog.run({
        id: row.id,
        logged_at: row.logged_at,
        title: row.title || null,
        tag_name: row.tag_name || null,
        team: row.team || null,
        docs_url: row.docs_url || null,
        type: row.type,
        status: row.status || null,
        tag_mismatch: row.tag_mismatch ? 1 : 0,
      });

      if (existing) updated++;
      else inserted++;

      // STEP 2: Link raw↔reviewed
      if (row.type === 'reviewed' || row.type === 're-reviewed') {
        linkReviewToRaw(row);
        linked++;
      } else if (row.type === 'raw') {
        backfillRawToReview(row);
      }
    }

    // STEP 3: Detect deletions
    if (all_ids && Array.isArray(all_ids)) {
      const incomingSet = new Set(all_ids);
      const existingIds = stmts.getActiveIds.all().map(r => r.id);
      for (const existId of existingIds) {
        if (!incomingSet.has(existId)) {
          stmts.markDeleted.run({ id: existId });
          deleted++;
        }
      }
    }

    // STEP 4: Update sync_meta
    const activeCount = stmts.countActive.get().c;
    stmts.updateMeta.run({
      rows_in_sheet: rows.length,
      rows_in_db: activeCount,
      last_new_rows: inserted,
      last_deleted: deleted,
      last_updated: updated,
      fingerprint: fingerprint || null,
      last_status: 'ok',
    });
  });

  syncTransaction();

  // STEP 5: Emit SSE
  const result = { inserted, updated, deleted, linked, total: rows.length };
  const sseMsg = `data: ${JSON.stringify({ type: 'sync', ...result, timestamp: new Date().toISOString() })}\n\n`;
  sseClients.forEach(client => client.write(sseMsg));

  return result;
}

// ─── Cron global ref ─────────────────────────────────────
let runSyncGlobal = null;

function startCronJob(app) {
  const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  if (!WEBHOOK_URL) {
    console.log('[Cron] No N8N_WEBHOOK_URL set. Skipping auto-sync.');
    return;
  }

  // 5 phút
  const syncInterval = 5 * 60 * 1000;
  console.log(`[Cron] Starting auto-sync every 5 minutes`);

  const runSync = async () => {
    try {
      console.log('[Cron] Fetching data from n8n Webhook...');
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();

      // n8n trả về 1 item array bọc ngoài hoặc json trực tiếp
      const payload = Array.isArray(data) ? data[0] : data;

      console.log(`[Cron] Received ${payload?.rows?.length ?? '?'} rows. Starting DB sync...`);

      const sseClients = app?.locals?.sseClients || [];
      const result = syncFromData(payload, sseClients);
      console.log(`[Cron] Sync completed: +${result.inserted} ~${result.updated} -${result.deleted} linked:${result.linked}`);

    } catch (error) {
      console.error('[Cron] Error during auto-sync:', error.message);
    }
  };

  runSyncGlobal = runSync;
  runSync(); // Run immediately
  setInterval(runSync, syncInterval);
}

const triggerSync = async (app) => {
  if (runSyncGlobal) {
    await runSyncGlobal();
  } else {
    console.log('[Cron] Not started yet');
  }
};

module.exports = { startCronJob, triggerSync };
