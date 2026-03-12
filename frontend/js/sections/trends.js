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

    const [trends, heatmap] = await Promise.all([
      API.getTrends(team, days),
      API.getHealth(range) // We'll just borrow the trend data... actually wait, the heatmap API exists
    ]);

    this.renderDailyChart(trends.daily);
    this.renderDistChart(trends.distribution);
    this.renderSlaChart(trends.daily);
  },

  renderDailyChart(data) {
    const ctx = document.getElementById('chart-daily').getContext('2d');
    if (this.charts.daily) this.charts.daily.destroy();

    this.charts.daily = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.date),
        datasets: [
          {
            label: 'Reviewed',
            data: data.map(d => d.reviewedCount),
            backgroundColor: Palette.getRiskColor('healthy'),
            borderRadius: 4
          },
          {
            label: 'Logged',
            data: data.map(d => d.loggedCount),
            backgroundColor: Palette.theme.muted(),
            borderRadius: 4
          }
        ]
      },
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { stacked: false },
          y: { stacked: false, beginAtZero: true }
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
          backgroundColor: Palette.getRiskColor('watch'),
          borderRadius: 4
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
        labels: data.map(d => d.date),
        datasets: [{
          label: 'SLA Pass Rate (%)',
          data: data.map(d => 100 - d.slaBreachPct),
          borderColor: Palette.getRiskColor('healthy'),
          backgroundColor: Palette.getRiskColor('healthy'),
          tension: 0.3,
          fill: false,
          pointRadius: 3
        }]
      },
      options: {
        scales: {
          y: { min: 0, max: 100, ticks: { callback: v => v + '%' } }
        }
      }
    });
  }
};
