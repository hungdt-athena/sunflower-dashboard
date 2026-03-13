const HealthSection = {
  element: document.getElementById('health-container'),

  async render(range) {
    this.element.innerHTML = '<div class="loading">Loading health data...</div>';
    const data = await API.getHealth(range);
    
    let html = '';
    
    function teamBadge(name, extra, colorClass) {
      const extraHtml = extra ? `<span class="hbadge-extra">${extra}</span>` : '';
      return `<span class="health-team-badge ${colorClass}">${name}${extraHtml}</span>`;
    }

    function renderCard(title, icon, colorAccent, content, isEmpty) {
      return `
        <div class="health-card ${colorAccent}">
          <div class="health-card-header">
            <span class="health-card-icon">${icon}</span>
            <span class="health-card-title">${title}</span>
          </div>
          <div class="health-card-body ${isEmpty ? 'health-empty' : ''}">
            ${isEmpty ? '—' : content}
          </div>
        </div>`;
    }

    // Most Unconfirmed
    const unc = data.mostUnconfirmed;
    html += renderCard('Most Unconfirmed', '🚨', 'hcard-rose',
      unc && unc.length ? unc.map(i => teamBadge(typeof i === 'string' ? i : i.team, typeof i === 'string' ? null : Object.values(i)[1], 'hbadge-rose')).join('') : null,
      !unc || !unc.length);

    // Most Unreviewed
    const unr = data.mostUnreviewed;
    html += renderCard('Most Unreviewed', '⏳', 'hcard-amber',
      unr && unr.length ? unr.map(i => teamBadge(typeof i === 'string' ? i : i.team, typeof i === 'string' ? null : Object.values(i)[1], 'hbadge-amber')).join('') : null,
      !unr || !unr.length);

    // High SLA >20%
    const sla = data.highSla;
    html += renderCard('High SLA >20%', '📊', 'hcard-orange',
      sla && sla.length ? sla.map(i => teamBadge(i.team, `${Format.number(i.pct)}%`, 'hbadge-orange')).join('') : null,
      !sla || !sla.length);

    // Potential Breachers
    const br = data.potentialBreachers;
    html += renderCard('Potential Breachers (SLA >80%)', '⚠️', 'hcard-red',
      br && br.length ? br.map(i => teamBadge(typeof i === 'string' ? i : i.team, null, 'hbadge-red')).join('') : null,
      !br || !br.length);

    // Gaps vs Benchmark
    const gaps = data.benchmarkGaps;
    html += renderCard('Gaps vs Benchmark', '📉', 'hcard-indigo',
      gaps && gaps.length ? gaps.map(i => teamBadge(i.team, `+${i.gapPct}% slower`, 'hbadge-indigo')).join('') : null,
      !gaps || !gaps.length);

    // Critical Teams
    const isCritical = data.critical && data.critical.length > 0;
    html += renderCard('Critical Teams', '🔴', isCritical ? 'hcard-red' : 'hcard-green',
      isCritical
        ? data.critical.map(t => teamBadge(t, null, 'hbadge-red')).join('')
        : '<span class="health-all-clear">✅ All clear</span>',
      false);

    // No Reviews
    const noRev = data.noReviews;
    html += renderCard('No Reviews', '😴', 'hcard-slate',
      noRev && noRev.length ? noRev.map(i => teamBadge(typeof i === 'string' ? i : i.team, null, 'hbadge-slate')).join('') : null,
      !noRev || !noRev.length);

    // Stale Items
    const stale = data.staleItems || 0;
    html += renderCard('Stale Items (>7d)', '🕰️', stale > 0 ? 'hcard-red' : 'hcard-green',
      stale > 0
        ? `<span class="health-stale-count">${stale}</span><span class="health-stale-label"> items &gt;7 days old</span>`
        : '<span class="health-all-clear">✅ No stale items</span>',
      false);

    this.element.innerHTML = html;
  }
};
