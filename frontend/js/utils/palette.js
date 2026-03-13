const Palette = {
  riskValues: {
    'healthy': { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', label: '🟢' },
    'watch':   { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', label: '🟡' },
    'at-risk': { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)', label: '🟠' },
    'critical':{ color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)',  label: '🔴' }
  },

  getRiskColor(band) {
    return this.riskValues[band]?.color || 'var(--text-muted)';
  },

  getRiskLabel(band) {
    return this.riskValues[band]?.label || '⚪';
  },

  theme: {
    text() { return '#0f172a'; },
    muted() { return '#cbd5e1'; },
    grid() { return 'rgba(0,0,0,0.05)'; },
    panel() { return '#ffffff'; }
  },

  // Deterministic color assignment for teams
  teamColors: {},
  colorSequence: [
    '#3b82f6', '#8b5cf6', '#f43f5e', '#10b981', '#f59e0b', 
    '#0ea5e9', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
  ],
  
  getTeamColor(team) {
    if (!this.teamColors[team]) {
      const idx = Object.keys(this.teamColors).length % this.colorSequence.length;
      this.teamColors[team] = this.colorSequence[idx];
    }
    return this.teamColors[team];
  }
};
