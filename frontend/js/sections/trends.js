const TrendsSection = {
  charts: {},

  init() {
    updateChartTheme();
  },

  async render(team, range) {
    let days = 30; // default for 'all' or '30d'
    if (range === '7d') days = 7;
    if (range === '3d') days = 3;
    if (range === 'today') days = 1;

    const [trends] = await Promise.all([
      API.getTrends(team, days)
    ]);

    this.renderDailyChart(trends);
    this.renderSlaChart(trends.dailySla);
    this.renderCycleTimeChart(trends.cycleTimeByTeam);
    this.renderDistChart(trends.reviewTimeDist);
  },

  renderDailyChart(data) {
    const ctx = document.getElementById('chart-daily').getContext('2d');
    if (this.charts.daily) this.charts.daily.destroy();

    // Align dates from dailyRaw and dailyReviews
    const labels = Array.from(new Set([...data.dailyRaw.map(d => d.day), ...data.dailyReviews.map(d => d.day)])).sort();
    
    const rawMap = Object.fromEntries(data.dailyRaw.map(d => [d.day, d.count]));
    const revMap = Object.fromEntries(data.dailyReviews.map(d => [d.day, d.count]));

    this.charts.daily = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Logged (Meeting)',
            data: labels.map(l => rawMap[l] || 0),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4
          },
          {
            label: 'Reviewed Done',
            data: labels.map(l => revMap[l] || 0),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  },

  renderDistChart(data) {
    const ctx = document.getElementById('chart-dist').getContext('2d');
    if (this.charts.dist) this.charts.dist.destroy();

    this.charts.dist = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.bucket),
        datasets: [{
          label: 'Reviews',
          data: data.map(d => d.count),
          backgroundColor: '#8b5cf6',
          borderRadius: 6,
          barThickness: 40
        }]
      },
      options: {
        scales: { y: { beginAtZero: true } }
      }
    });
  },

  renderSlaChart(data) {
    const ctx = document.getElementById('chart-sla').getContext('2d');
    if (this.charts.sla) this.charts.sla.destroy();

    this.charts.sla = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.day),
        datasets: [{
          label: 'SLA Pass Rate (%)',
          data: data.map(d => d.compliance_pct),
          borderColor: '#f43f5e',
          backgroundColor: '#f43f5e',
          tension: 0.3,
          fill: false,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        scales: {
          y: { 
            min: 0, 
            max: 100, 
            ticks: { callback: v => v + '%' } 
          }
        }
      }
    });
  },

  renderCycleTimeChart(data) {
    const ctx = document.getElementById('chart-cycle-time').getContext('2d');
    if (this.charts.cycle) this.charts.cycle.destroy();

    this.charts.cycle = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.team),
        datasets: [
          {
            label: 'Wait Confirmed (hrs)',
            data: data.map(d => Math.round(d.avg_pending_hours || 0)),
            backgroundColor: '#fb923c'
          },
          {
            label: 'Wait Review (hrs)',
            data: data.map(d => Math.round(d.avg_confirmed_hours || 0)),
            backgroundColor: '#3b82f6'
          }
        ]
      },
      options: {
        indexAxis: 'y',
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          x: { stacked: true, title: { display: true, text: 'Hours' } },
          y: { stacked: true }
        }
      }
    });
  }
};
