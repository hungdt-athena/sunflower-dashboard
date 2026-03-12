const Drilldown = {
  dialog: document.getElementById('drilldown-modal'),
  title: document.getElementById('drilldown-title'),
  tbody: document.getElementById('drilldown-body'),
  pageInd: document.getElementById('page-indicator'),
  btnPrev: document.getElementById('btn-prev-page'),
  btnNext: document.getElementById('btn-next-page'),
  
  state: {
    team: 'all',
    range: 'all',
    type: null,
    status: null,
    page: 1,
    limit: 50,
    totalPages: 1
  },

  init() {
    document.getElementById('btn-close-drilldown').addEventListener('click', () => {
      this.dialog.close();
    });

    this.btnPrev.addEventListener('click', () => {
      if (this.state.page > 1) {
        this.fetchData(this.state.page - 1);
      }
    });

    this.btnNext.addEventListener('click', () => {
      if (this.state.page < this.state.totalPages) {
        this.fetchData(this.state.page + 1);
      }
    });
    
    // Add click listeners to all stat cards
    document.querySelectorAll('.stat-clickable').forEach(el => {
      el.addEventListener('click', () => {
        const stat = el.dataset.stat;
        this.openForStat(stat);
      });
    });
  },

  openForStat(statType) {
    this.state.team = window.appData.state.team;
    this.state.range = window.appData.state.range;
    
    let titleStr = "Details";
    this.state.type = null;
    this.state.status = null;
    
    switch (statType) {
      case 'reviewed':
        titleStr = 'Reviewed Items';
        this.state.type = 'reviewed';
        break;
      case 'needConfirm':
        titleStr = 'Unconfirmed Items (Pending)';
        this.state.type = 'raw';
        this.state.status = 'pending';
        break;
      case 'unreviewed':
        titleStr = 'Unreviewed Items (In Queue)';
        this.state.type = 'raw';
        this.state.status = 'confirmed';
        break;
      case 'total':
        titleStr = 'All Raw Logs';
        this.state.type = 'raw';
        break;
      case 'slabreach':
        titleStr = 'SLA Breaches (>4h)';
        this.state.type = 'reviewed';
        // Hack: no explicit backend filter for SLA right now, so we just show reviewed
        break;
    }

    if (this.state.team !== 'all') titleStr += ` — ${this.state.team}`;
    this.title.textContent = titleStr;
    
    this.dialog.showModal();
    this.fetchData(1);
  },

  async fetchData(page) {
    this.state.page = page;
    this.tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Loading...</td></tr>';
    
    try {
      const resp = await API.getRows(this.state);
      this.state.totalPages = resp.pages || 1;
      
      this.pageInd.textContent = `Page ${resp.page} / ${resp.pages}`;
      this.btnPrev.disabled = resp.page <= 1;
      this.btnNext.disabled = resp.page >= resp.pages;

      if (resp.data.length === 0) {
        this.tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No records found.</td></tr>';
        return;
      }

      this.tbody.innerHTML = resp.data.map(r => `
        <tr>
          <td><span class="text-sm">${Format.date(r.logged_at)}</span></td>
          <td>${r.title || '<i class="text-muted">No title</i>'}</td>
          <td><span class="badge" style="background:${Palette.getTeamColor(r.team)}; color:white">${r.team}</span></td>
          <td>${r.type}</td>
          <td>
            ${r.status === 'pending' ? '<span class="badge bg-red">Pending</span>' : 
              r.status === 'confirmed' ? '<span class="badge bg-amber">Confirmed</span>' : 
              r.status ? `<span class="badge bg-secondary">${r.status}</span>` : '-'}
          </td>
          <td>${r.review_hours ? `<b>${r.review_hours}h</b>` : '-'}</td>
          <td>${r.docs_url ? `<a href="${r.docs_url}" target="_blank" style="color:var(--color-blue)">Link ↗</a>` : '-'}</td>
        </tr>
      `).join('');
    } catch (e) {
      this.tbody.innerHTML = `<tr><td colspan="7" class="text-center summary-red">Error loading data.</td></tr>`;
    }
  }
};
