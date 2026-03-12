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
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.state.range = e.target.dataset.range;
        this.renderAll();
      });
    });

    // Theme toggle
    document.getElementById('btn-theme').addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      updateChartTheme();
    });

    // Refresh
    document.getElementById('btn-refresh').addEventListener('click', () => {
      document.getElementById('new-rows-badge').classList.add('badge-hidden');
      this.renderAll();
    });

    // CMD Palette Esc
    document.getElementById('cmd-input').addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.getElementById('cmd-palette').close();
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
