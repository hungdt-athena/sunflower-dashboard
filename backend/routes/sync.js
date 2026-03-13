const express = require('express');
const router = express.Router();
const { db, stmts } = require('../db');

// SSE clients registry (managed by server.js, passed via app.locals)
function getSSEClients(req) {
  return req.app.locals.sseClients || [];
}

function emitSSE(req, data) {
  const clients = getSSEClients(req);
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(msg));
}

/**
 * Helper: Parse "dd/MM/yyyy" from reviewed.status field 
 * and compare with raw.logged_at date part
 */
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

/**
 * Link a reviewed/re-reviewed row to its matching raw row.
 * Strategy:
 *   1. Match by docs_url
 *   2. Confirm by comparing reviewed.status (date) with raw.logged_at (date part)
 *   → Both match = full confidence
 *   → Only one matches = partial confidence
 */
function linkReviewToRaw(row) {
  if (!row.docs_url) return;
  if (row.type !== 'reviewed' && row.type !== 're-reviewed') return;

  const rawRow = stmts.findRawByDocsUrl.get({ docs_url: row.docs_url });
  if (!rawRow) return;

  // reviewed.status contains the date the raw was logged (dd/MM/yyyy or with time)
  // Use this as the "reviewed_at" moment for accurate review_hours calculation.
  // If status isn't parseable, fall back to row.logged_at (when the reviewed entry was logged).
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

/**
 * When a new raw row is inserted, check if a reviewed row already exists
 * and backfill the link
 */
function backfillRawToReview(row) {
  if (!row.docs_url) return;
  if (row.type !== 'raw') return;

  const reviewedRow = stmts.findReviewedByDocsUrl.get({ docs_url: row.docs_url });
  if (!reviewedRow) return;

  const rawTime = new Date(row.logged_at).getTime();
  const reviewTime = new Date(reviewedRow.logged_at).getTime();
  const reviewHours = (reviewTime - rawTime) / (1000 * 60 * 60);

  // Get the reviewed row's status for date matching
  const reviewed = db.prepare('SELECT status FROM logs WHERE id = ?').get(reviewedRow.id);
  const statusDate = parseDateFromStatus(reviewed?.status);
  const dateMatch = datesMatch(row.logged_at, statusDate);
  const confidence = dateMatch ? 'full' : 'partial';

  stmts.updateReviewLink.run({
    id: reviewedRow.id,
    raw_logged_at: row.logged_at,
    reviewed_at: reviewedRow.logged_at,
    review_hours: Math.round(reviewHours * 100) / 100,
    is_sla_breach: reviewHours > 4 ? 1 : 0,
    link_confidence: confidence,
  });
}

/**
 * POST /api/sync
 * Full sync handler: UPSERT all rows + detect deletions
 */
router.post('/', (req, res) => {
  try {
    const { rows, all_ids, fingerprint } = req.body;

    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows must be an array' });
    }

    let inserted = 0;
    let updated = 0;
    let deleted = 0;
    let linked = 0;

    // Wrap in transaction for atomicity
    const syncTransaction = db.transaction(() => {
      // STEP 1: UPSERT all incoming rows
      for (const row of rows) {
        // Check if row already exists
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

        if (existing) {
          updated++;
        } else {
          inserted++;
        }

        // STEP 3: Link raw↔reviewed
        if (row.type === 'reviewed' || row.type === 're-reviewed') {
          linkReviewToRaw(row);
          linked++;
        } else if (row.type === 'raw') {
          backfillRawToReview(row);
        }
      }

      // STEP 2: Detect deletions
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

    const result = { inserted, updated, deleted, linked, total: rows.length };

    // STEP 5: Emit SSE event
    emitSSE(req, { type: 'sync', ...result, timestamp: new Date().toISOString() });

    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Sync error:', err);

    // Update meta with error
    try {
      stmts.updateMeta.run({
        rows_in_sheet: 0,
        rows_in_db: stmts.countActive.get().c,
        last_new_rows: 0,
        last_deleted: 0,
        last_updated: 0,
        fingerprint: null,
        last_status: `error: ${err.message}`,
      });
    } catch (_) {}

    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/sync/full — Admin: wipe DB and resync
 */
router.post('/full', (req, res) => {
  try {
    const { rows, all_ids, fingerprint } = req.body;
    if (!rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'rows must be an array' });
    }

    db.exec('DELETE FROM logs');
    
    let linked = 0;
    const syncTransaction = db.transaction(() => {
      for (const row of rows) {
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

        if (row.type === 'reviewed' || row.type === 're-reviewed') {
          linkReviewToRaw(row);
          linked++;
        } else if (row.type === 'raw') {
          backfillRawToReview(row);
        }
      }

      stmts.updateMeta.run({
        rows_in_sheet: rows.length,
        rows_in_db: rows.length,
        last_new_rows: rows.length,
        last_deleted: 0,
        last_updated: 0,
        fingerprint: fingerprint || null,
        last_status: 'ok',
      });
    });

    syncTransaction();

    emitSSE(req, { type: 'full-sync', total: rows.length, linked, timestamp: new Date().toISOString() });

    res.json({ ok: true, inserted: rows.length, linked });
  } catch (err) {
    console.error('Full sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
