const HealthSection = {
  element: document.getElementById('health-container'),

  async render(range) {
    this.element.innerHTML = '<div class="loading">Loading health data...</div>';
    const data = await API.getHealth(range);
    
    let html = '';
    
    function renderList(title, list, formatter = null) {
      if (!list || list.length === 0) return `<div class="health-item"><div class="health-label">${title}</div><div class="health-val text-muted">None</div></div>`;
      let content = list.map(item => {
        if (typeof item === 'string') return `<span>${item}</span>`;
        const val = formatter ? formatter(item) : Object.values(item)[1];
        return `<span><strong>${item.team}</strong> (${val})</span>`;
      }).join(', ');
      return `<div class="health-item"><div class="health-label">${title}</div><div class="health-val">${content}</div></div>`;
    }

    html += renderList('Most unconfirmed', data.mostUnconfirmed);
    html += renderList('Most unreviewed', data.mostUnreviewed);
    html += renderList('High SLA >20%', data.highSla, item => `${Format.number(item.pct)}%`);
    
    if (data.critical.length > 0) {
      html += `<div class="health-item"><div class="health-label summary-red">🔴 Critical Teams</div><div class="health-val"><strong>${data.critical.join(', ')}</strong></div></div>`;
    } else {
      html += `<div class="health-item"><div class="health-label summary-green">🟢 Critical Teams</div><div class="health-val text-muted">None</div></div>`;
    }

    html += renderList('No reviews', data.noReviews);
    html += `<div class="health-item"><div class="health-label">🕰️ Stale Items (>7d)</div><div class="health-val">${data.staleItems > 0 ? `<strong class="summary-red">${data.staleItems}</strong> items` : '<span class="summary-green">0 items</span>'}</div></div>`;

    this.element.innerHTML = html;
  }
};
