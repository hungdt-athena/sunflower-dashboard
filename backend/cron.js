const fs = require('fs');
const path = require('path');
const db = require('./db');

let runSyncGlobal = null;

function startCronJob() {
  const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
  if (!WEBHOOK_URL) {
    console.log('[Cron] No N8N_WEBHOOK_URL set. Skipping auto-sync.');
    return;
  }

  // Chạy mỗi 5 phút (5 * 60 * 1000 ms)
  const syncInterval = 5 * 60 * 1000;
  console.log(`[Cron] Starting auto-sync every 5 minutes to: ${WEBHOOK_URL}`);

  const runSync = async () => {
    try {
      console.log('[Cron] Fetching data from n8n Webhook...');
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'x-api-key': process.env.SYNC_API_KEY || ''
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data || !data.rows) {
        throw new Error('Invalid data format received from webhook');
      }

      console.log(`[Cron] Received ${data.rows.length} rows. Starting DB sync...`);

      const fingerprint = data.fingerprint || String(Date.now());
      let inserted = 0;
      let updated = 0;
      let deleted = 0;
      let linked = 0;

      // Wipe current data if needed, or incremental sync
      // Given the logic from routes/sync.js payload format:
      // Insert / Update rows
      for (const row of data.rows) {
        const existing = db.getRowById(row.id);
        if (existing) {
          db.updateRow(row);
          updated++;
        } else {
          db.insertRow(row);
          inserted++;
        }
      }

      // Check deletions
      if (data.all_ids && Array.isArray(data.all_ids)) {
        const existingIds = db.getAllIds().map(r => r.id);
        const toDelete = existingIds.filter(id => !data.all_ids.includes(id));
        for (const id of toDelete) {
          db.deleteRow(id);
          deleted++;
        }
      }

      // Link raw and reviewed logic (auto linking)
      linked = db.linkRawAndReviewed();
      db.updateSyncMeta(fingerprint);

      console.log(`[Cron] Sync completed: +${inserted} ~${updated} -${deleted} (Linked: ${linked})`);
      
      // Notify SSE clients
      db.notifySSE({ type: 'full-sync', fingerprint, changes: inserted + updated + deleted });

    } catch (error) {
      console.error('[Cron] Error during auto-sync:', error);
    }
  };

  runSyncGlobal = runSync;
  runSync(); // Chạy ngay lập tức lần đầu
  setInterval(runSync, syncInterval);
}

const triggerSync = async () => {
  if (runSyncGlobal) {
    await runSyncGlobal();
  } else {
    console.log('[Cron] Cron job not started, cannot trigger sync');
  }
};

module.exports = { startCronJob, triggerSync };
