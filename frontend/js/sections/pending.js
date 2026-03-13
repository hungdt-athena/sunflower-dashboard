const PendingSection = {
  elements: {
    unreviewed: document.getElementById('pending-unreviewed-tbody'),
    unconfirmed: document.getElementById('pending-unconfirmed-tbody')
  },

  async render(team) {
    this.elements.unreviewed.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    this.elements.unconfirmed.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    const data = await API.getPending(team);
    
    // Group items by team, sort by count desc, show worst SLA badge per team
    function renderTeamRows(list, tb) {
      if (!list || list.length === 0) {
        tb.innerHTML = '<tr><td colspan="3" class="text-muted text-center">— Clear —</td></tr>';
        return;
      }

      // Group by team
      const byTeam = {};
      list.forEach(item => {
        const t = item.team || 'uncategorized';
        if (!byTeam[t]) byTeam[t] = { count: 0, worstAge: 0, priority: item.priority };
        byTeam[t].count++;
        if (item.age_hours > byTeam[t].worstAge) {
          byTeam[t].worstAge = item.age_hours;
          byTeam[t].priority = item.priority;
        }
      });

      // Sort by count desc
      const sorted = Object.entries(byTeam).sort((a, b) => b[1].count - a[1].count);

      tb.innerHTML = sorted.map(([teamName, info]) => {
        const slaLeft = 4 - info.worstAge;
        let slaHTML = '';
        if (slaLeft < 0) {
          const overH = Math.round(Math.abs(slaLeft));
          const txt = overH >= 24 ? Math.round(overH / 24) + 'd overdue' : overH + 'h overdue';
          slaHTML = `<span class="badge bg-red">${txt}</span>`;
        } else {
          const txt = Math.round(slaLeft) + 'h left';
          slaHTML = `<span class="badge bg-amber">${txt}</span>`;
        }

        const prioColors = { 'High': 'bg-red', 'Medium': 'bg-secondary', 'Low': 'bg-slate-200 text-slate-600' };
        const prioClass = prioColors[info.priority] || 'bg-secondary';

        return `
          <tr>
            <td><strong class="text-slate-800">${teamName}</strong></td>
            <td><span class="pending-count-badge">${info.count}</span></td>
          </tr>
        `;
      }).join('');
    }

    renderTeamRows(data.unreviewed, this.elements.unreviewed);
    renderTeamRows(data.unconfirmed, this.elements.unconfirmed);
  }
};
