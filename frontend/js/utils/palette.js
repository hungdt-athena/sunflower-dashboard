const Palette = {
  riskValues: {
    'healthy': { color: 'var(--color-success)', bg: 'var(--color-success-bg)', label: '🟢' },
    'watch':   { color: 'var(--color-amber)', bg: 'var(--color-amber-bg)', label: '🟡' },
    'at-risk': { color: '#fb923c', bg: 'rgba(251, 146, 60, 0.1)', label: '🟠' },
    'critical':{ color: 'var(--color-red)', bg: 'var(--color-red-bg)', label: '🔴' }
  },

  getRiskColor(band) {
    return this.riskValues[band]?.color || 'var(--text-muted)';
  },

  getRiskLabel(band) {
    return this.riskValues[band]?.label || '⚪';
  },

  theme: {
    isDark() { return document.documentElement.classList.contains('dark'); },
    text() { return this.isDark() ? '#f8fafc' : '#0f172a'; },
    muted() { return this.isDark() ? '#475569' : '#cbd5e1'; },
    grid() { return this.isDark() ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; },
    panel() { return this.isDark() ? '#1e293b' : '#ffffff'; }
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
