const TrendsSection = {
  charts: {},

  init() {
    updateChartTheme();
  },

  async render(team, range) {
    const trends = await API.getTrends(team, range);

    const allTeamsContainer = document.getElementById('all-teams-charts');
    const dailyChartsContainer = document.getElementById('daily-trend-charts');

    if (team === 'all') {
      allTeamsContainer.classList.remove('hidden');
      this.renderPieChart(trends.teamDistribution);
      this.renderStackedChart(trends.teamStatusStacked);
    } else {
      allTeamsContainer.classList.add('hidden');
    }

    if (range === 'today') {
      dailyChartsContainer.classList.add('hidden');
    } else {
      dailyChartsContainer.classList.remove('hidden');
      this.renderDailyChart(trends);
      this.renderSlaChart(trends.dailySla);
      this.renderCycleTimeChart(trends.cycleTimeByTeam);
      this.renderDistChart(trends.reviewTimeDist);
    }
  },

  renderPieChart(data) {
    const ctx = document.getElementById('chart-pie-dist').getContext('2d');
    if (this.charts.pie) this.charts.pie.destroy();

    const total = data.reduce((a, b) => a + b.count, 0);

    const pieLabelsPlugin = {
      id: 'pieLabels',
      afterDraw(chart) {
        if (chart.config.type !== 'doughnut') return;
        const ctx = chart.ctx;
        const meta = chart.getDatasetMeta(0);
        const dataArr = chart.data.datasets[0].data;
        
        ctx.save();
        ctx.font = '11px sans-serif';
        ctx.textBaseline = 'middle';

        meta.data.forEach((element, index) => {
          const val = dataArr[index];
          if (!val) return;
          const pct = Math.round((val / total) * 100);
          const labelText = `${chart.data.labels[index]}: ${val} (${pct}%)`;

          const midAngle = element.startAngle + (element.endAngle - element.startAngle) / 2;
          const radius = element.outerRadius;
          const x = chart.chartArea.left + chart.chartArea.width / 2;
          const y = chart.chartArea.top + chart.chartArea.height / 2;
          
          const extra = 20;
          const startX = x + Math.cos(midAngle) * radius;
          const startY = y + Math.sin(midAngle) * radius;
          const midX = x + Math.cos(midAngle) * (radius + extra);
          const midY = y + Math.sin(midAngle) * (radius + extra);
          
          const alignRight = Math.cos(midAngle) > 0;
          const endX = midX + (alignRight ? 20 : -20);
          
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(midX, midY);
          ctx.lineTo(endX, midY);
          ctx.strokeStyle = '#94a3b8';
          ctx.stroke();

          ctx.fillStyle = '#475569';
          ctx.textAlign = alignRight ? 'left' : 'right';
          ctx.fillText(labelText, endX + (alignRight ? 5 : -5), midY);
        });
        ctx.restore();
      }
    };

    this.charts.pie = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.map(d => d.team),
        datasets: [{
          data: data.map(d => d.count),
          backgroundColor: data.map(d => Palette.getTeamColor(d.team)),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      plugins: [pieLabelsPlugin],
      options: {
        cutout: '55%',
        layout: { padding: 40 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.raw;
                const pct = Math.round((val / total) * 100);
                return ` ${ctx.label}: ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  },

  renderStackedChart(data) {
    const ctx = document.getElementById('chart-status-stacked').getContext('2d');
    if (this.charts.stacked) this.charts.stacked.destroy();

    const rawData = {
      unconfirmed: data.map(d => d.unconfirmed),
      unreviewed: data.map(d => d.unreviewed),
      reviewed: data.map(d => d.reviewed)
    };

    const barLabelsPlugin = {
      id: 'barLabels',
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        
        chart.data.datasets.forEach((dataset, datasetIndex) => {
          const meta = chart.getDatasetMeta(datasetIndex);
          meta.data.forEach((element, index) => {
            const val = dataset.rawValues ? dataset.rawValues[index] : 0;
            if (val > 0) {
              const height = Math.abs(element.base - element.y);
              if (height > 15) {
                const centerX = element.x;
                const centerY = (element.y + element.base) / 2;
                ctx.fillText(val, centerX, centerY);
              }
            }
          });
        });
        ctx.restore();
      }
    };

    this.charts.stacked = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(d => d.team),
        datasets: [
          {
            label: 'Unconfirmed',
            data: [], // populated below
            rawValues: rawData.unconfirmed,
            backgroundColor: '#ef4444' // red-500
          },
          {
            label: 'Unreviewed (In Queue)',
            data: [], // populated below
            rawValues: rawData.unreviewed,
            backgroundColor: '#f59e0b' // amber-500
          },
          {
            label: 'Reviewed',
            data: [], // populated below
            rawValues: rawData.reviewed,
            backgroundColor: '#10b981' // emerald-500
          }
        ]
      },
      plugins: [barLabelsPlugin],
      options: {
        indexAxis: 'x',
        plugins: {
          legend: { position: 'bottom', reverse: true },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const realValue = ctx.dataset.rawValues[ctx.dataIndex];
                return `${ctx.dataset.label}: ${realValue}`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, max: 100, ticks: { callback: v => v + '%' } }
        }
      }
    });

    // Populate 100% stacked percentages
    const totals = data.map(d => (d.unconfirmed + d.unreviewed + d.reviewed) || 1);
    this.charts.stacked.data.datasets[0].data = rawData.unconfirmed.map((v, i) => Math.round((v / totals[i]) * 100) || 0);
    this.charts.stacked.data.datasets[1].data = rawData.unreviewed.map((v, i) => Math.round((v / totals[i]) * 100) || 0);
    this.charts.stacked.data.datasets[2].data = rawData.reviewed.map((v, i) => Math.round((v / totals[i]) * 100) || 0);
    this.charts.stacked.update();
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
    const canvas = document.getElementById('chart-cycle-time');
    const ctx = canvas.getContext('2d');
    if (this.charts.cycle) this.charts.cycle.destroy();

    // Sort teams by total cycle time descending (highest on the left for vertical bar)
    const sorted = [...data].sort((a, b) => {
      const totalA = (a.avg_pending_hours || 0) + (a.avg_confirmed_hours || 0);
      const totalB = (b.avg_pending_hours || 0) + (b.avg_confirmed_hours || 0);
      return totalB - totalA; // descending
    });

    // Reset container height from horizontal logic
    const container = canvas.parentElement;
    container.style.height = '';

    this.charts.cycle = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(d => d.team),
        datasets: [
          {
            label: 'Wait Review (hrs)',
            data: sorted.map(d => Math.round(d.avg_confirmed_hours || 0)),
            backgroundColor: '#3b82f6'
          },
          {
            label: 'Wait Confirmed (hrs)',
            data: sorted.map(d => Math.round(d.avg_pending_hours || 0)),
            backgroundColor: '#fb923c'
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              title: (items) => `Team: ${items[0].label}`,
              footer: (items) => {
                const total = items.reduce((s, i) => s + i.parsed.y, 0);
                return `Total: ${total}h`;
              }
            }
          }
        },
        scales: {
          x: { stacked: true },
          y: { stacked: true, title: { display: true, text: 'Hours' } }
        }
      }
    });
  }
};
