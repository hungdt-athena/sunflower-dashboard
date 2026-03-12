const Format = {
  number(num, decimals = 1) {
    if (num === null || num === undefined) return '-';
    // Format without trailing zeros if possible
    return Number(num).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    });
  },
  
  percent(val, total) {
    if (!total) return '0%';
    return `${Math.round((val / total) * 100)}%`;
  },
  
  pct(num) {
    if (num === null || num === undefined) return '-%';
    return `${this.number(num)}%`;
  },
  
  date(isoStr) {
    if (!isoStr) return '-';
    try {
      return new Date(isoStr).toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  },

  ageBadge(days) {
    if (days === null || days === undefined) return '';
    if (days >= 7) return `<span class="badge bg-red ml-2">${days}d 🔴</span>`;
    if (days >= 3) return `<span class="badge bg-amber ml-2">${days}d ⚠️</span>`;
    return `<span class="text-sm ml-2 text-secondary">${days}d</span>`;
  }
};
