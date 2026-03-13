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
        tb.innerHTML = '<tr><td colspan="4" class="text-muted text-center">- Clear -</td></tr>';
        return;
      }
      
      tb.innerHTML = list.map(item => {
        const titleShort = item.title.length > 25 ? item.title.substring(0, 25) + '...' : item.title;
        const slaLeft = 4 - item.age_hours;
        
        let slaHTML = '';
        if (slaLeft < 0) {
          const overH = Math.round(Math.abs(slaLeft));
          const txt = overH >= 24 ? Math.round(overH/24)+'d overdue' : overH+'h overdue';
          slaHTML = `<span class="badge bg-red">${txt}</span>`;
        } else {
          const txt = Math.round(slaLeft) + 'h left';
          slaHTML = `<span class="badge bg-amber">${txt}</span>`;
        }
        
        const prioColors = { 'High': 'bg-red text-white', 'Medium': 'bg-secondary', 'Low': 'bg-slate-200 text-slate-600' };
        const prioClass = prioColors[item.priority] || 'bg-secondary';
        
        return `
        <tr>
          <td class="truncate max-w-[120px] text-xs font-medium text-slate-700" title="${item.title.replace(/"/g, '&quot;')}">${titleShort}</td>
          <td><strong>${item.team}</strong></td>
          <td>${slaHTML}</td>
          <td><span class="badge ${prioClass} px-1.5">${item.priority}</span></td>
        </tr>
      `}).join('');
    }

    renderRows(data.unreviewed, this.elements.unreviewed);
    renderRows(data.unconfirmed, this.elements.unconfirmed);
  }
};
