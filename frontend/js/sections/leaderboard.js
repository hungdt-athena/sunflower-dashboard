const LeaderboardSection = {
  elements: {
    tbody: document.getElementById('leaderboard-tbody'),
    rawBar: document.getElementById('funnel-raw-bar'),
    rawCount: document.getElementById('funnel-raw-count'),
    confBar: document.getElementById('funnel-confirm-bar'),
    confCount: document.getElementById('funnel-confirm-count'),
    confPct: document.getElementById('funnel-confirm-pct'),
    revBar: document.getElementById('funnel-review-bar'),
    revCount: document.getElementById('funnel-review-count'),
    revPct: document.getElementById('funnel-review-pct'),
    cRate: document.getElementById('funnel-c-rate'),
    rRate: document.getElementById('funnel-r-rate'),
    avgConfirm: document.getElementById('funnel-avg-confirm'),
    avgReview: document.getElementById('funnel-avg-review')
  },

  getMedal(rank) {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `<span class="text-muted">${rank}</span>`;
  },

  async render(team, range) {
    // 1. Leaderboard
    this.elements.tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
    const leaders = await API.getLeaderboard(range);
    
    if (leaders.length === 0) {
      this.elements.tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No data</td></tr>';
    } else {
      this.elements.tbody.innerHTML = leaders.slice(0, 10).map(l => `
        <tr>
          <td>${this.getMedal(l.rank)}</td>
          <td class="text-left"><strong>${l.team}</strong></td>
          <td>${l.reviewCount}</td>
          <td>${l.medianHours}h</td>
        </tr>
      `).join('');
    }

    // 2. Funnel
    const funnel = await API.getFunnel(team, range);
    
    this.elements.rawCount.textContent = funnel.raw;
    this.elements.confCount.textContent = funnel.confirmed;
    this.elements.revCount.textContent = funnel.reviewed;
    
    const max = funnel.raw || 1;
    this.elements.confBar.style.width = Math.max((funnel.confirmed / max) * 100, 2) + '%';
    this.elements.revBar.style.width = Math.max((funnel.reviewed / max) * 100, 2) + '%';
    
    this.elements.confPct.textContent = Format.percent(funnel.confirmed, funnel.raw);
    this.elements.revPct.textContent = Format.percent(funnel.reviewed, funnel.raw);
    
    this.elements.cRate.textContent = `${funnel.confirmRate}% Conversion`;
    this.elements.rRate.textContent = `${funnel.reviewRate}% Conversion`;

    this.elements.avgConfirm.textContent = funnel.avgWaitConfirm !== null ? funnel.avgWaitConfirm + 'h' : '-';
    this.elements.avgReview.textContent = funnel.avgWaitReview !== null ? funnel.avgWaitReview + 'h' : '-';
  }
};
