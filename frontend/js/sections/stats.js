const StatsSection = {
  elements: {
    reviewed: document.getElementById('stat-reviewed'),
    unconfirmed: document.getElementById('stat-need-confirm'),
    unreviewed: document.getElementById('stat-unreviewed'),
    total: document.getElementById('stat-total'),
    rereviewed: document.getElementById('stat-rereviewed'),
    rawdup: document.getElementById('stat-rawdup'),
    tagmismatch: document.getElementById('stat-tagmismatch'),
    avgHours: document.getElementById('stat-avg-hours'),
    medianHours: document.getElementById('stat-median-hours'),
    slaPct: document.getElementById('stat-sla-pct'),
    slaCount: document.getElementById('stat-sla-count'),
    velocity: document.getElementById('stat-velocity'),
    velocityTrend: document.getElementById('stat-velocity-trend'),
    rereviewRate: document.getElementById('stat-rereview-rate')
  },

  async render(team, range) {
    const data = await API.getStats(team, range);
    
    // Dynamic Tooltips
    const teamLabel = team === 'all' ? 'All Teams' : team;
    const rangeLabels = { 'today': 'Today', '3d': 'the last 3 days', '7d': 'the last 7 days', '14d': 'the last 14 days', '30d': 'the last 30 days', 'all': 'all time' };
    const rangeLabel = rangeLabels[range] || range;
    
    document.getElementById('tooltip-unconfirmed').textContent = `Total number of unconfirmed meetings for ${teamLabel} in ${rangeLabel}.`;
    document.getElementById('tooltip-slabreach').textContent = `Total number of reviews exceeding the 4-hour standard timeframe for ${teamLabel} in ${rangeLabel}.`;
    document.getElementById('tooltip-total').textContent = `Total number of meetings for ${teamLabel} in ${rangeLabel}.`;
    document.getElementById('tooltip-reviewed').textContent = `Total number of reviewed meetings for ${teamLabel} in ${rangeLabel}.`;
    document.getElementById('tooltip-unreviewed').textContent = `Total number of unreviewed meetings waiting in queue for ${teamLabel}.`;

    this.elements.reviewed.textContent = data.reviewed;
    this.elements.unconfirmed.textContent = data.needConfirm;
    this.elements.unreviewed.textContent = data.unreviewed;
    this.elements.total.textContent = data.totalMeeting;
    
    this.elements.rereviewed.textContent = `${data.reReviewed} re-rev`;
    this.elements.rawdup.textContent = `${data.rawDup} dup`;
    
    if (data.tagMismatch > 0) {
      this.elements.tagmismatch.textContent = `${data.tagMismatch} mismatches`;
      this.elements.tagmismatch.classList.remove('hidden');
    } else {
      this.elements.tagmismatch.classList.add('hidden');
    }

    this.elements.avgHours.textContent = data.avgReviewTime !== null ? `${data.avgReviewTime}h` : '-';
    this.elements.medianHours.textContent = data.medianReviewTime !== null ? `${data.medianReviewTime}h` : '-';
    
    this.elements.slaPct.textContent = `${data.slaBreachPct}%`;
    this.elements.slaCount.textContent = `${data.slaBreach}/${data.slaTotal} Reviews`;
    if (data.slaBreachPct > 20) this.elements.slaPct.className = 'kpi-value summary-amber';
    else if (data.slaBreachPct > 50) this.elements.slaPct.className = 'kpi-value summary-red';
    else this.elements.slaPct.className = 'kpi-value summary-green';

    if (data.velocity) {
      this.elements.velocity.textContent = data.velocity.velocityPerDay;
      const vt = data.velocity.velocityChange;
      const vr = data.velocity.avgReviewChange;
      const label = data.velocity.label;
      
      let vStr = 'Flat';
      let vCls = 'text-slate-400';
      if (vt > 0) { vStr = `↑ +${vt}% ${label}`; vCls = 'text-emerald-500'; }
      if (vt < 0) { vStr = `↓ ${vt}% ${label}`; vCls = 'text-rose-500'; }
      this.elements.velocityTrend.innerHTML = `<span class="${vCls}">${vStr}</span>`;

      const avgTrendEl = document.getElementById('stat-avg-trend');
      if (avgTrendEl && vr !== null && vr !== undefined) {
        let rStr = 'Flat';
        let rCls = 'text-slate-400';
        if (vr > 0) { rStr = `↑ +${vr}% ${label}`; rCls = 'text-rose-500'; }
        if (vr < 0) { rStr = `↓ ${vr}% ${label}`; rCls = 'text-emerald-500'; }
        avgTrendEl.innerHTML = `<span class="${rCls}">${rStr}</span>`;
      } else if (avgTrendEl) {
        avgTrendEl.innerHTML = '';
      }
    } else {
      this.elements.velocityTrend.innerHTML = '';
      const avgTrendEl = document.getElementById('stat-avg-trend');
      if (avgTrendEl) avgTrendEl.innerHTML = '';
    }
  }
};
