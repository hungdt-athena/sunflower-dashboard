window.appData = {
  state: {
    team: 'all',
    range: '7d'
  },
  
  async init() {
    this.setupSSE();
    await this.fetchTeams();
    this.bindEvents();
    
    RiskSection.initWeights();
    TrendsSection.init();
    Drilldown.init();
    
    // Initial sync meta
    const syncMeta = await API.fetchJSON('/sync/meta');
    if (syncMeta && syncMeta.last_synced_at) {
      this.updateSyncTime(syncMeta.last_synced_at);
    }
    
    this.renderAll();
  },

  async fetchTeams() {
    const teams = await API.getTeams();
    const select = document.getElementById('team-filter');
    select.innerHTML = '<option value="all">All Teams</option>' + 
      teams.map(t => `<option value="${t}">${t}</option>`).join('');
  },

  bindEvents() {
    // Team Select
    document.getElementById('team-filter').addEventListener('change', (e) => {
      this.state.team = e.target.value;
      this.renderAll();
    });

    // Time Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active', 'bg-white', 'text-primary', 'border', 'border-slate-200', 'shadow-sm', 'font-bold');
          b.classList.add('font-semibold', 'text-slate-600');
        });
        
        e.target.classList.remove('font-semibold', 'text-slate-600');
        e.target.classList.add('active', 'bg-white', 'text-primary', 'border', 'border-slate-200', 'shadow-sm', 'font-bold');
        
        this.state.range = e.target.dataset.range;
        this.renderAll();
      });
    });

    // Navigation Tabs (Sidebar)
    document.querySelectorAll('.nav-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const btnNode = e.currentTarget;
        const tabId = btnNode.dataset.tab;
        
        const inactiveClasses = ['text-slate-600', 'hover:bg-slate-50', 'border-transparent', 'group'];
        const activeClasses = ['active', 'bg-primary/10', 'text-primary', 'border-primary/20', 'shadow-sm'];

        document.querySelectorAll('.nav-tab-btn').forEach(b => {
          b.classList.remove(...activeClasses);
          b.classList.add(...inactiveClasses);
          const icon = b.querySelector('.material-symbols-outlined');
          if(icon) icon.classList.add('group-hover:text-primary');
          const p = b.querySelector('p');
          if(p) p.classList.add('group-hover:text-primary');
        });
        
        btnNode.classList.remove(...inactiveClasses);
        btnNode.classList.add(...activeClasses);
        
        const activeIcon = btnNode.querySelector('.material-symbols-outlined');
        if(activeIcon) activeIcon.classList.remove('group-hover:text-primary');
        const activeP = btnNode.querySelector('p');
        if(activeP) activeP.classList.remove('group-hover:text-primary');

        // Toggle Tabs
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden', 'block'));
        const activeTab = document.getElementById(tabId);
        if(activeTab) {
          activeTab.classList.remove('hidden');
          activeTab.classList.add('block');
        }

        // Update Title
        if(activeP) {
          document.getElementById('view-title').textContent = activeP.textContent;
        }

        // Toggle Team filter visibility (only visible in KPIs tab)
        document.getElementById('filter-team-container').style.display = (tabId === 'tab-kpis') ? 'flex' : 'none';
      });
    });

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', async () => {
      const btn = document.getElementById('btn-refresh');
      const timeSpan = document.getElementById('last-sync-time');
      
      btn.classList.add('opacity-50', 'pointer-events-none');
      timeSpan.textContent = 'SYNCING...';
      document.getElementById('new-rows-badge').classList.add('badge-hidden');
      
      try {
        await API.syncManual();
        await this.renderAll();
      } catch (err) {
        console.error('Manual sync failed:', err);
      } finally {
        btn.classList.remove('opacity-50', 'pointer-events-none');
        this.updateSyncTime();
      }
    });


  },

  async renderAll() {
    const { team, range } = this.state;
    document.body.style.cursor = 'wait';
    
    try {
      this.updateDateRangeLabel();
      await Promise.all([
        StatsSection.render(team, range),
        HealthSection.render(range),
        RiskSection.render(range),
        PendingSection.render(team),
        LeaderboardSection.render(team, range),
        TrendsSection.render(team, range)
      ]);
      this.updateSyncTime();
    } catch (e) {
      console.error(e);
    } finally {
      document.body.style.cursor = 'default';
    }
  },

  updateDateRangeLabel() {
    const range = this.state.range;
    const today = new Date();
    const fmt = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };

    let text = '';
    if (range === 'today') {
      text = fmt(today);
    } else if (range === 'all') {
      text = 'All Time';
    } else {
      const days = parseInt(range) || 7;
      const past = new Date(today);
      past.setDate(today.getDate() - days);
      text = `${fmt(past)} - ${fmt(today)}`;
    }
    const labelEl = document.getElementById('date-range-text');
    if (labelEl) labelEl.textContent = text;
  },

  renderSection(name) {
    if (name === 'risk') RiskSection.render(this.state.range);
  },

  updateSyncTime(time) {
    if (!time) {
      document.getElementById('last-sync-time').textContent = 'Initial Sync...';
      return;
    }
    const date = new Date(time);
    const HH = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const MM = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    document.getElementById('last-sync-time').textContent = `Data updated through ${HH}:${mm} ${dd}/${MM}/${yyyy}`;
  },

  setupSSE() {
    const ind = document.getElementById('sync-indicator');
    const badge = document.getElementById('new-rows-badge');
    
    const evtSource = new EventSource('/events');
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'connected' || data.type === 'heartbeat') {
          ind.classList.add('online');
        } else if (data.type === 'sync' || data.type === 'full-sync') {
          // Show new rows badge
          badge.textContent = `${data.inserted || data.total} new rows! Click to refresh`;
          badge.classList.remove('badge-hidden');
          this.updateSyncTime(data.timestamp);
        }
      } catch(e) {}
    };
    evtSource.onerror = () => {
      ind.classList.remove('online');
    };
  }
};

// Boot
document.addEventListener('DOMContentLoaded', () => {
  window.appData.init();
});
