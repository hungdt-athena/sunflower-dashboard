const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/sunflower.db';

// Ensure data directory exists
const dataDir = path.dirname(path.resolve(DB_PATH));
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.resolve(DB_PATH));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id              TEXT PRIMARY KEY,
    logged_at       TEXT NOT NULL,
    title           TEXT,
    tag_name        TEXT,
    team            TEXT,
    docs_url        TEXT,
    type            TEXT NOT NULL,
    status          TEXT,
    raw_logged_at   TEXT,
    reviewed_at     TEXT,
    review_hours    REAL,
    is_sla_breach   INTEGER DEFAULT 0,
    tag_mismatch    INTEGER DEFAULT 0,
    link_confidence TEXT DEFAULT NULL,
    is_deleted      INTEGER DEFAULT 0,
    synced_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sync_meta (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    last_synced_at  TEXT,
    rows_in_sheet   INTEGER DEFAULT 0,
    rows_in_db      INTEGER DEFAULT 0,
    last_new_rows   INTEGER DEFAULT 0,
    last_deleted    INTEGER DEFAULT 0,
    last_updated    INTEGER DEFAULT 0,
    fingerprint     TEXT DEFAULT NULL,
    last_status     TEXT DEFAULT 'ok'
  );

  CREATE INDEX IF NOT EXISTS idx_team       ON logs(team);
  CREATE INDEX IF NOT EXISTS idx_type       ON logs(type);
  CREATE INDEX IF NOT EXISTS idx_status     ON logs(status);
  CREATE INDEX IF NOT EXISTS idx_logged_at  ON logs(logged_at);
  CREATE INDEX IF NOT EXISTS idx_docs_url   ON logs(docs_url);
  CREATE INDEX IF NOT EXISTS idx_is_deleted ON logs(is_deleted);
`);

// Initialize sync_meta if empty
const metaRow = db.prepare('SELECT COUNT(*) as c FROM sync_meta').get();
if (metaRow.c === 0) {
  db.prepare('INSERT INTO sync_meta (id) VALUES (1)').run();
}

// ─── Prepared Statements ───────────────────────────────

const stmts = {
  // Sync
  upsertLog: db.prepare(`
    INSERT INTO logs (id, logged_at, title, tag_name, team, docs_url, type, status, tag_mismatch, is_deleted, synced_at)
    VALUES (@id, @logged_at, @title, @tag_name, lower(@team), @docs_url, @type, @status, @tag_mismatch, 0, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      tag_name = excluded.tag_name,
      team = lower(excluded.team),
      type = excluded.type,
      status = excluded.status,
      tag_mismatch = excluded.tag_mismatch,
      is_deleted = 0,
      synced_at = datetime('now')
  `),

  markDeleted: db.prepare(`
    UPDATE logs SET is_deleted = 1 WHERE id = @id
  `),

  getActiveIds: db.prepare(`
    SELECT id FROM logs WHERE is_deleted = 0
  `),

  // Link raw → reviewed
  findRawByDocsUrl: db.prepare(`
    SELECT id, logged_at FROM logs 
    WHERE docs_url = @docs_url AND type = 'raw' AND is_deleted = 0
    ORDER BY logged_at ASC LIMIT 1
  `),

  updateReviewLink: db.prepare(`
    UPDATE logs SET 
      raw_logged_at = @raw_logged_at,
      reviewed_at = @reviewed_at,
      review_hours = @review_hours,
      is_sla_breach = @is_sla_breach,
      link_confidence = @link_confidence
    WHERE id = @id
  `),

  // Compute review_hours directly from logged_at - parseDateFromStatus(status)
  updateReviewHours: db.prepare(`
    UPDATE logs SET review_hours = @review_hours, is_sla_breach = @is_sla_breach
    WHERE id = @id
  `),

  findReviewedByDocsUrl: db.prepare(`
    SELECT id, logged_at FROM logs
    WHERE docs_url = @docs_url AND type IN ('reviewed', 're-reviewed') AND is_deleted = 0
    ORDER BY logged_at ASC LIMIT 1
  `),

  // Sync meta
  getMeta: db.prepare('SELECT * FROM sync_meta WHERE id = 1'),

  updateMeta: db.prepare(`
    UPDATE sync_meta SET
      last_synced_at = datetime('now'),
      rows_in_sheet = @rows_in_sheet,
      rows_in_db = @rows_in_db,
      last_new_rows = @last_new_rows,
      last_deleted = @last_deleted,
      last_updated = @last_updated,
      fingerprint = @fingerprint,
      last_status = @last_status
    WHERE id = 1
  `),

  // Teams
  getTeams: db.prepare(`
    SELECT DISTINCT team FROM logs WHERE is_deleted = 0 AND team IS NOT NULL AND team != '' ORDER BY team
  `),

  // Count active rows
  countActive: db.prepare('SELECT COUNT(*) as c FROM logs WHERE is_deleted = 0'),
};

// ─── Date Range Helper ─────────────────────────────────

function dateRangeFilter(range) {
  switch (range) {
    case 'today':
      return "AND date(logged_at) = date('now')";
    case '3d':
      return "AND logged_at >= datetime('now', '-3 days')";
    case '7d':
      return "AND logged_at >= datetime('now', '-7 days')";
    case '14d':
      return "AND logged_at >= datetime('now', '-14 days')";
    case '30d':
      return "AND logged_at >= datetime('now', '-30 days')";
    case 'all':
    default:
      return '';
  }
}

function teamFilter(team) {
  if (!team || team === 'all') return '';
  return `AND team = '${team.replace(/'/g, "''")}'`;
}

// ─── Stats Queries ─────────────────────────────────────

function getStats(team, range) {
  const tf = teamFilter(team);
  const rf = dateRangeFilter(range);
  const base = `FROM logs WHERE is_deleted = 0 ${tf} ${rf}`;

  // ── Meeting KPIs: all based on type='raw' status ─────────────────────
  // total meeting = raw rows with a recognised status
  const totalMeeting = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw' AND status IN ('pending','confirmed','reviewed')`).get().v;
  // reviewed    = raw rows confirmed AND already reviewed
  const reviewed    = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw' AND status = 'reviewed'`).get().v;
  // unreviewed  = raw rows confirmed but not yet reviewed
  const unreviewed  = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw' AND status = 'confirmed'`).get().v;
  // needConfirm = raw rows not yet confirmed
  const needConfirm = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw' AND status = 'pending'`).get().v;

  // Supplementary counts (display only, not part of meeting totals)
  const reReviewed = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 're-reviewed'`).get().v;
  const rawDup     = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw-dup'`).get().v;

  // ── Review Time: from type='reviewed' rows ────────────────────────────
  // review_hours = reviewed.logged_at − parseDateFromStatus(reviewed.status)
  // (computed during sync and stored in review_hours column)
  const reviewTimeBase = `FROM logs WHERE is_deleted = 0 AND type = 'reviewed' AND review_hours IS NOT NULL AND review_hours >= 0 ${tf} ${rf}`;
  const avgReviewTime  = db.prepare(`SELECT AVG(review_hours) as v ${reviewTimeBase}`).get().v;

  // Median via sorted rows
  const reviewTimeRows = db.prepare(`SELECT review_hours ${reviewTimeBase} ORDER BY review_hours`).all();
  let medianReviewTime = null;
  if (reviewTimeRows.length > 0) {
    const mid = Math.floor(reviewTimeRows.length / 2);
    medianReviewTime = reviewTimeRows.length % 2 !== 0
      ? reviewTimeRows[mid].review_hours
      : (reviewTimeRows[mid - 1].review_hours + reviewTimeRows[mid].review_hours) / 2;
  }

  const slaBreach = db.prepare(`SELECT COUNT(*) as v ${reviewTimeBase} AND is_sla_breach = 1`).get().v;
  const slaTotal  = db.prepare(`SELECT COUNT(*) as v ${reviewTimeBase}`).get().v;
  const slaPct    = slaTotal > 0 ? (slaBreach / slaTotal * 100) : 0;

  // Velocity: type='reviewed' entries per day
  let velocity = null;
  if (range !== 'all') {
    const days = { 'today': 1, '3d': 3, '7d': 7, '14d': 14, '30d': 30 }[range] || 7;
    const reviewedEntries = db.prepare(`SELECT COUNT(*) as v FROM logs WHERE is_deleted = 0 AND type = 'reviewed' ${tf} ${rf}`).get().v;
    velocity = reviewedEntries / days;
  }

  // Re-review rate = re-reviewed / reviewed-entry rows
  const reviewedEntries = db.prepare(`SELECT COUNT(*) as v FROM logs WHERE is_deleted = 0 AND type = 'reviewed' ${tf} ${rf}`).get().v;
  const reReviewRate = reviewedEntries > 0 ? (reReviewed / reviewedEntries * 100) : 0;

  // Duplicate rate
  const dupRate = (totalMeeting + rawDup) > 0 ? (rawDup / (totalMeeting + rawDup) * 100) : 0;

  return {
    reviewed,
    needConfirm,
    unreviewed,
    totalMeeting,
    reReviewed,
    rawDup,
    avgReviewTime:    avgReviewTime    ? Math.round(avgReviewTime    * 100) / 100 : null,
    medianReviewTime: medianReviewTime ? Math.round(medianReviewTime * 100) / 100 : null,
    slaBreach,
    slaBreachPct:  Math.round(slaPct        * 100) / 100,
    velocity:      velocity ? Math.round(velocity * 100) / 100 : null,
    reReviewRate:  Math.round(reReviewRate  * 100) / 100,
    dupRate:       Math.round(dupRate       * 100) / 100,
  };
}

// ─── Health ────────────────────────────────────────────

function getHealth(range) {
  const rf = dateRangeFilter(range);
  const base = `FROM logs WHERE is_deleted = 0 ${rf}`;

  // Team-level aggregates
  const teams = db.prepare(`SELECT DISTINCT team ${base} AND team IS NOT NULL AND team != ''`).all().map(r => r.team);
  
  const teamStats = {};
  for (const t of teams) {
    teamStats[t] = getStats(t, range);
  }

  // Most unconfirmed
  const mostUnconfirmed = Object.entries(teamStats)
    .sort((a, b) => b[1].needConfirm - a[1].needConfirm)
    .filter(([, s]) => s.needConfirm > 0)
    .slice(0, 3)
    .map(([name, s]) => ({ team: name, count: s.needConfirm }));

  // Most unreviewed
  const mostUnreviewed = Object.entries(teamStats)
    .sort((a, b) => b[1].unreviewed - a[1].unreviewed)
    .filter(([, s]) => s.unreviewed > 0)
    .slice(0, 3)
    .map(([name, s]) => ({ team: name, count: s.unreviewed }));

  // High SLA breach (>20%)
  const highSla = Object.entries(teamStats)
    .filter(([, s]) => s.slaBreachPct > 20 && s.reviewed > 0)
    .sort((a, b) => b[1].slaBreachPct - a[1].slaBreachPct)
    .map(([name, s]) => ({ team: name, pct: s.slaBreachPct }));

  // Critical: SLA >50% AND (pending>=3 OR unreviewed>=3)
  const critical = Object.entries(teamStats)
    .filter(([, s]) => s.slaBreachPct > 50 && (s.needConfirm >= 3 || s.unreviewed >= 3))
    .map(([name]) => name);

  // No reviews
  const noReviews = Object.entries(teamStats)
    .filter(([, s]) => s.reviewed === 0 && s.totalMeeting > 0)
    .map(([name]) => name);

  // Stale items (>7 days, any range)
  const staleItems = db.prepare(`
    SELECT COUNT(*) as v FROM logs 
    WHERE is_deleted = 0 AND type = 'raw' 
    AND status IN ('pending', 'confirmed')
    AND logged_at < datetime('now', '-7 days')
  `).get().v;

  return {
    mostUnconfirmed,
    mostUnreviewed,
    highSla,
    critical,
    noReviews,
    staleItems,
  };
}

// ─── Risk Score ────────────────────────────────────────

function getRiskScores(range, weights = null) {
  const w = weights || {
    sla: 0.30,
    unconfirmed: 0.25,
    unreviewed: 0.20,
    avgHours: 0.15,
    reReview: 0.10,
  };

  const rf = dateRangeFilter(range);
  const base = `FROM logs WHERE is_deleted = 0 ${rf}`;
  const teams = db.prepare(`SELECT DISTINCT team ${base} AND team IS NOT NULL AND team != ''`).all().map(r => r.team);

  const results = [];
  for (const t of teams) {
    const s = getStats(t, range);
    if (s.totalMeeting === 0 && s.reviewed === 0) continue;

    const total = s.totalMeeting || 1;
    const slaComponent = s.slaBreachPct * w.sla;
    const unconfirmedComponent = (s.needConfirm / total * 100) * w.unconfirmed;
    const unreviewedComponent = (s.unreviewed / total * 100) * w.unreviewed;
    const avgHComponent = Math.min((s.avgReviewTime || 0) / 24 * 100, 100) * w.avgHours;
    const reReviewComponent = s.reReviewRate * w.reReview;

    let score = slaComponent + unconfirmedComponent + unreviewedComponent + avgHComponent + reReviewComponent;
    score = Math.min(Math.round(score * 100) / 100, 100);

    let band;
    if (score <= 25) band = 'healthy';
    else if (score <= 50) band = 'watch';
    else if (score <= 75) band = 'at-risk';
    else band = 'critical';

    results.push({
      team: t,
      score,
      band,
      components: {
        sla: Math.round(slaComponent * 100) / 100,
        unconfirmed: Math.round(unconfirmedComponent * 100) / 100,
        unreviewed: Math.round(unreviewedComponent * 100) / 100,
        avgHours: Math.round(avgHComponent * 100) / 100,
        reReview: Math.round(reReviewComponent * 100) / 100,
      },
      stats: s,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}

// ─── Pending Lists ─────────────────────────────────────

function getPending(team) {
  const tf = teamFilter(team);

  const unconfirmed = db.prepare(`
    SELECT team, COUNT(*) as count,
      MIN(logged_at) as oldest,
      ROUND(julianday('now') - julianday(MIN(logged_at)), 1) as oldest_days
    FROM logs 
    WHERE is_deleted = 0 AND type = 'raw' AND status = 'pending' ${tf}
    GROUP BY team ORDER BY count DESC
  `).all();

  const unreviewedList = db.prepare(`
    SELECT team, COUNT(*) as count,
      MIN(logged_at) as oldest,
      ROUND(julianday('now') - julianday(MIN(logged_at)), 1) as oldest_days
    FROM logs 
    WHERE is_deleted = 0 AND type = 'raw' AND status = 'confirmed' ${tf}
    GROUP BY team ORDER BY count DESC
  `).all();

  return { unconfirmed, unreviewed: unreviewedList };
}

// ─── Trends ────────────────────────────────────────────

function getTrends(team, days = 30) {
  const tf = teamFilter(team);

  // Daily review counts
  const dailyReviews = db.prepare(`
    SELECT date(logged_at) as day, COUNT(*) as count
    FROM logs 
    WHERE is_deleted = 0 AND type = 'reviewed' 
    AND logged_at >= datetime('now', '-${days} days') ${tf}
    GROUP BY date(logged_at) ORDER BY day
  `).all();

  // Daily SLA compliance
  const dailySla = db.prepare(`
    SELECT date(logged_at) as day,
      COUNT(*) as total,
      SUM(CASE WHEN is_sla_breach = 0 THEN 1 ELSE 0 END) as within_sla,
      ROUND(SUM(CASE WHEN is_sla_breach = 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as compliance_pct
    FROM logs
    WHERE is_deleted = 0 AND type = 'reviewed' AND review_hours IS NOT NULL
    AND logged_at >= datetime('now', '-${days} days') ${tf}
    GROUP BY date(logged_at) ORDER BY day
  `).all();

  // Daily raw logs
  const dailyRaw = db.prepare(`
    SELECT date(logged_at) as day, COUNT(*) as count
    FROM logs 
    WHERE is_deleted = 0 AND type = 'raw'
    AND logged_at >= datetime('now', '-${days} days') ${tf}
    GROUP BY date(logged_at) ORDER BY day
  `).all();

  // Review time distribution (histogram bins)
  const reviewTimeDist = db.prepare(`
    SELECT 
      CASE 
        WHEN review_hours <= 1 THEN '0-1h'
        WHEN review_hours <= 4 THEN '1-4h'
        WHEN review_hours <= 8 THEN '4-8h'
        WHEN review_hours <= 24 THEN '8-24h'
        ELSE '>24h'
      END as bucket,
      COUNT(*) as count
    FROM logs
    WHERE is_deleted = 0 AND type = 'reviewed' AND review_hours IS NOT NULL
    AND logged_at >= datetime('now', '-${days} days') ${tf}
    GROUP BY bucket
  `).all();

  return { dailyReviews, dailySla, dailyRaw, reviewTimeDist };
}

// ─── Leaderboard ───────────────────────────────────────

function getLeaderboard(range) {
  const rf = dateRangeFilter(range);

  const leaderboard = db.prepare(`
    SELECT team,
      COUNT(*) as review_count,
      AVG(review_hours) as avg_hours,
      MIN(review_hours) as min_hours
    FROM logs
    WHERE is_deleted = 0 AND type = 'reviewed' AND review_hours IS NOT NULL ${rf}
    AND team IS NOT NULL AND team != ''
    GROUP BY team
    HAVING review_count >= 1
    ORDER BY avg_hours ASC
  `).all();

  // Compute median per team
  return leaderboard.map((t, i) => {
    const rows = db.prepare(`
      SELECT review_hours FROM logs
      WHERE is_deleted = 0 AND type = 'reviewed' AND review_hours IS NOT NULL ${rf}
      AND team = ?
      ORDER BY review_hours
    `).all(t.team);

    const mid = Math.floor(rows.length / 2);
    const median = rows.length % 2 !== 0
      ? rows[mid].review_hours
      : (rows[mid - 1].review_hours + rows[mid].review_hours) / 2;

    return {
      rank: i + 1,
      team: t.team,
      reviewCount: t.review_count,
      avgHours: Math.round(t.avg_hours * 100) / 100,
      medianHours: Math.round(median * 100) / 100,
      minHours: Math.round(t.min_hours * 100) / 100,
    };
  });
}

// ─── Funnel ────────────────────────────────────────────

function getFunnel(team, range) {
  const tf = teamFilter(team);
  const rf = dateRangeFilter(range);
  const base = `FROM logs WHERE is_deleted = 0 ${tf} ${rf}`;

  // All raw meetings with a recognised status
  const raw      = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw' AND status IN ('pending','confirmed','reviewed')`).get().v;
  // Confirmed = meetings confirmed (+ already reviewed, which implies confirmed)
  const confirmed = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw' AND status IN ('confirmed','reviewed')`).get().v;
  // Reviewed = raw meetings whose status was updated to 'reviewed'
  const reviewed  = db.prepare(`SELECT COUNT(*) as v ${base} AND type = 'raw' AND status = 'reviewed'`).get().v;

  return {
    raw,
    confirmed,
    reviewed,
    confirmRate: raw > 0 ? Math.round(confirmed / raw * 1000) / 10 : 0,
    reviewRate:  confirmed > 0 ? Math.round(reviewed / confirmed * 1000) / 10 : 0,
  };
}

// ─── Heatmap ───────────────────────────────────────────

function getHeatmap(team) {
  const tf = teamFilter(team);

  const data = db.prepare(`
    SELECT 
      CAST(strftime('%w', logged_at) AS INTEGER) as day_of_week,
      CAST(strftime('%H', logged_at) AS INTEGER) as hour,
      COUNT(*) as count
    FROM logs
    WHERE is_deleted = 0 AND type = 'raw' ${tf}
    AND logged_at >= datetime('now', '-30 days')
    GROUP BY day_of_week, hour
  `).all();

  return data;
}

// ─── Drill-down Rows ───────────────────────────────────

function getRows(filters = {}) {
  const { team, type, status, range, page = 1, limit = 50, search } = filters;
  const conditions = ['is_deleted = 0'];
  
  if (team && team !== 'all') conditions.push(`team = '${team.replace(/'/g, "''")}'`);
  if (type) conditions.push(`type = '${type.replace(/'/g, "''")}'`);
  if (status) conditions.push(`status = '${status.replace(/'/g, "''")}'`);
  if (search) conditions.push(`title LIKE '%${search.replace(/'/g, "''")}%'`);

  const rf = dateRangeFilter(range);
  const where = conditions.join(' AND ') + ' ' + rf;
  const offset = (page - 1) * limit;

  const rows = db.prepare(`
    SELECT id, logged_at, title, tag_name, team, docs_url, type, status,
           review_hours, is_sla_breach, link_confidence,
           ROUND(julianday('now') - julianday(logged_at), 1) as days_old
    FROM logs WHERE ${where}
    ORDER BY logged_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `).all();

  const total = db.prepare(`SELECT COUNT(*) as v FROM logs WHERE ${where}`).get().v;

  return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

// ─── Performance Comparison ──────────────────────────────

function getPerformanceComparison(team, range) {
  if (range === '3d' || range === 'all') return null;

  const tf = teamFilter(team);
  let currentRangeSql = '';
  let prevRangeSql = '';
  let days = 1;
  let label = '';

  if (range === 'today') {
    currentRangeSql = "AND date(logged_at) = date('now')";
    prevRangeSql = "AND date(logged_at) = date('now', '-1 day')";
    days = 1;
    label = 'vs yesterday';
  } else if (range === '7d') {
    currentRangeSql = "AND logged_at >= datetime('now', '-7 days')";
    prevRangeSql = "AND logged_at >= datetime('now', '-14 days') AND logged_at < datetime('now', '-7 days')";
    days = 7;
    label = 'vs LW';
  } else if (range === '30d') {
    currentRangeSql = "AND logged_at >= datetime('now', '-30 days')";
    prevRangeSql = "AND logged_at >= datetime('now', '-60 days') AND logged_at < datetime('now', '-30 days')";
    days = 30;
    label = 'vs LM';
  } else {
    return null;
  }

  const current = db.prepare(`
    SELECT COUNT(*) as v, AVG(review_hours) as avg_h
    FROM logs 
    WHERE is_deleted = 0 AND type = 'reviewed' ${tf} ${currentRangeSql}
  `).get();

  const prev = db.prepare(`
    SELECT COUNT(*) as v, AVG(review_hours) as avg_h
    FROM logs 
    WHERE is_deleted = 0 AND type = 'reviewed' ${tf} ${prevRangeSql}
  `).get();

  const currentCount = current.v;
  const prevCount = prev.v;
  const currentAvg = current.avg_h;
  const prevAvg = prev.avg_h;

  const velocityChange = prevCount > 0 ? ((currentCount - prevCount) / prevCount * 100) : (currentCount > 0 ? 100 : 0);
  
  let avgReviewChange = null;
  if (prevAvg != null && currentAvg != null && prevAvg > 0) {
      avgReviewChange = ((currentAvg - prevAvg) / prevAvg) * 100;
  } else if (prevAvg == null && currentAvg != null) {
      avgReviewChange = 100;
  }

  return {
    velocityPerDay: Math.round((currentCount / days) * 100) / 100,
    velocityChange: Math.round(velocityChange * 100) / 100,
    avgReviewChange: avgReviewChange !== null ? Math.round(avgReviewChange * 100) / 100 : null,
    label
  };
}

module.exports = {
  db,
  stmts,
  getStats,
  getHealth,
  getRiskScores,
  getPending,
  getTrends,
  getLeaderboard,
  getFunnel,
  getHeatmap,
  getRows,
  getPerformanceComparison,
  dateRangeFilter,
  teamFilter,
};
