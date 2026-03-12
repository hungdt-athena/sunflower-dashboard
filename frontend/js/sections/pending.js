const PendingSection = {
  elements: {
    unreviewed: document.getElementById('pending-unreviewed-tbody'),
    unconfirmed: document.getElementById('pending-unconfirmed-tbody')
  },

  async render(team) {
    this.elements.unreviewed.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    this.elements.unconfirmed.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';

    const data = await API.getPending(team);
    
    function renderRows(list, tb) {
      if (!list || list.length === 0) {
        tb.innerHTML = '<tr><td colspan="3" class="text-muted text-center">- Clear -</td></tr>';
        return;
      }
      
      tb.innerHTML = list.slice(0, 10).map(item => `
        <tr>
          <td><strong>${item.team}</strong></td>
          <td>${item.count}</td>
          <td>${Format.number(item.oldest_days)}d ${Format.ageBadge(item.oldest_days)}</td>
        </tr>
      `).join('');
      
      if (list.length > 10) {
        tb.innerHTML += `<tr><td colspan="3" class="text-center text-muted">+ ${list.length - 10} more teams</td></tr>`;
      }
    }

    renderRows(data.unreviewed, this.elements.unreviewed);
    renderRows(data.unconfirmed, this.elements.unconfirmed);
  }
};
