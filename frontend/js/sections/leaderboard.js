const LeaderboardSection = {
  elements: {
    tbody: document.getElementById('leaderboard-tbody'),
    rawBar: document.getElementById('funnel-raw-bar'),
    rawCount: document.getElementById('funnel-raw-count'),
    confBar: document.getElementById('funnel-confirm-bar'),
    confCount: document.getElementById('funnel-confirm-count'),
    revBar: document.getElementById('funnel-review-bar'),
    revCount: document.getElementById('funnel-review-count'),
    cRate: document.getElementById('funnel-c-rate'),
    rRate: document.getElementById('funnel-r-rate')
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
      this.elements.tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No data</td></tr>';
    } else {
      this.elements.tbody.innerHTML = leaders.slice(0, 10).map(l => {
        let avatarHTML = '';
        if (l.team && typeof l.team === 'string' && l.team.length >= 2) {
          const initial = l.team.substring(0, 2);
          const hash = l.team.charCodeAt(0) + l.team.charCodeAt(l.team.length - 1);
          const hue = hash * 137.508 % 360;
          avatarHTML = `<span class="team-avatar" style="background-color: hsl(${hue}, 70%, 50%)">${initial}</span>`;
        }
        
        return `
        <tr>
          <td class="text-center text-slate-600 font-medium">${this.getMedal(l.rank)}</td>
          <td class="text-left font-bold text-slate-800"><div class="flex items-center">${avatarHTML}<span>${l.team}</span></div></td>
          <td class="text-right">${l.reviewCount}</td>
          <td class="text-right">${l.medianHours}h</td>
          <td class="text-right">${l.cv} <span class="text-xs text-slate-400">(${Math.round(l.score*10)/10})</span></td>
        </tr>
      `}).join('');
    }

    // 2. Funnel
    const funnel = await API.getFunnel(team, range);
    
    this.elements.rawCount.textContent = funnel.raw;
    this.elements.confCount.textContent = funnel.confirmed;
    this.elements.revCount.textContent = funnel.reviewed;
    
    const max = funnel.raw || 1;
    this.elements.confBar.style.width = Math.max((funnel.confirmed / max) * 100, 2) + '%';
    this.elements.revBar.style.width = Math.max((funnel.reviewed / max) * 100, 2) + '%';
    
    this.elements.cRate.textContent = `${funnel.confirmRate}% Conversion`;
    this.elements.rRate.textContent = `${funnel.reviewRate}% Conversion`;
  }
};
