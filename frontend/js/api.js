/**
 * Global API state and fetch wrappers
 */
const API = {
  baseUrl: '/api',
  
  async fetchJSON(endpoint, params = {}) {
    try {
      const url = new URL(this.baseUrl + endpoint, window.location.origin);
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
          url.searchParams.append(key, params[key]);
        }
      });
      
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  async getMeta()     { return this.fetchJSON('/meta'); },
  async getTeams()    { return this.fetchJSON('/teams'); },
  
  async getStats(t,r) { return this.fetchJSON('/stats', { team: t, range: r }); },
  async getHealth(r)  { return this.fetchJSON('/health', { range: r }); },
  async getRisk(r, w) { return this.fetchJSON('/risk', { range: r, ...w }); },
  async getPending(t) { return this.fetchJSON('/pending', { team: t }); },
  async getLeaderboard(r) { return this.fetchJSON('/leaderboard', { range: r }); },
  async getFunnel(t,r){ return this.fetchJSON('/funnel', { team: t, range: r }); },
  async getTrends(t,d){ return this.fetchJSON('/trends', { team: t, days: d }); },
  
  async getRows(args) { return this.fetchJSON('/rows', args); }
};
