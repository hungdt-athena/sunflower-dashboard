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
    document.getElementById('btn-refresh').addEventListener('click', () => {
      document.getElementById('new-rows-badge').classList.add('badge-hidden');
      this.renderAll();
    });


  },

  async renderAll() {
    const { team, range } = this.state;
    document.body.style.cursor = 'wait';
    
    try {
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

  renderSection(name) {
    if (name === 'risk') RiskSection.render(this.state.range);
  },

  updateSyncTime(time) {
    document.getElementById('last-sync-time').textContent = `Syned: ${time ? Format.date(time) : 'Just now'}`;
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
