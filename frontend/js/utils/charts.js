// Chart.js global defaults
Chart.defaults.font.family = "'Inter', -apple-system, sans-serif";
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.plugins.tooltip.mode = 'index';
Chart.defaults.plugins.tooltip.intersect = false;
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#fff';
Chart.defaults.plugins.tooltip.bodyColor = '#cbd5e1';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.1)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 10;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.padding = 20;

function updateChartTheme() {
  Chart.defaults.color = Palette.theme.text();
  Chart.defaults.scale.grid.color = Palette.theme.grid();
  const tb = Palette.theme.text();
  for (const id in Chart.instances) {
    const chart = Chart.instances[id];
    if (chart.options.scales?.x) {
      chart.options.scales.x.ticks.color = tb;
      chart.options.scales.x.grid.color = Palette.theme.grid();
    }
    if (chart.options.scales?.y) {
      chart.options.scales.y.ticks.color = tb;
      chart.options.scales.y.grid.color = Palette.theme.grid();
    }
    chart.update();
  }
}
