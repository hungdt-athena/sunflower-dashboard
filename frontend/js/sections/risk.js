const RiskSection = {
  element: document.getElementById('risk-tbody'),
  weights: {},

  initWeights() {
    ['sla', 'unconfirmed', 'unreviewed', 'avg', 'rerev'].forEach(k => {
      const input = document.getElementById(`w-${k}`);
      const valEl = document.getElementById(`val-w-${k}`);
      input.addEventListener('input', () => {
        valEl.textContent = `${input.value}%`;
        this.updateTotal();
      });
    });

    document.getElementById('btn-apply-weights').addEventListener('click', () => {
      if (this.updateTotal()) window.appData.renderSection('risk');
    });
    
    document.getElementById('btn-close-weights').addEventListener('click', () => {
      document.getElementById('weights-modal').close();
    });
  },

  updateTotal() {
    let total = 0;
    const w = {};
    ['sla', 'unconfirmed', 'unreviewed', 'avg', 'rerev'].forEach(k => {
      const v = parseInt(document.getElementById(`w-${k}`).value, 10) || 0;
      total += v;
      w[`w_${k}`] = v;
    });
    const el = document.getElementById('weights-total');
    el.textContent = `Total: ${total}%`;
    if (total === 100) {
      el.className = 'total-valid';
      this.weights = w;
      return true;
    } else {
      el.className = 'total-invalid';
      return false;
    }
  },

  async render(range) {
    this.element.innerHTML = '<tr><td colspan="3" class="text-center">Loading risk scores...</td></tr>';
    const data = await API.getRisk(range, this.weights);
    
    if (!data || data.length === 0) {
      this.element.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
      return;
    }

    const maxScore = Math.max(...data.map(d => d.score || 0), 100);

    const html = data.map(d => {
      const score = d.score || 0;
      const cLabel = Palette.getRiskLabel(d.band);
      const cBg = Palette.getRiskColor(d.band);
      const wPct = (score / maxScore) * 100;
      
      let trendHTML = '';
      if (d.prevScore !== null && d.prevScore !== undefined) {
        if (score > d.prevScore + 0.1) {
          trendHTML = '<span class="material-symbols-outlined text-[15px] font-bold text-rose-500 ml-1" title="Aggravated compared to previous period">trending_up</span>';
        } else if (score < d.prevScore - 0.1) {
          trendHTML = '<span class="material-symbols-outlined text-[15px] font-bold text-emerald-500 ml-1" title="Improved compared to previous period">trending_down</span>';
        } else {
          trendHTML = '<span class="material-symbols-outlined text-[15px] font-bold text-slate-300 ml-1" title="No change">trending_flat</span>';
        }
      }

      const scoreTooltip = `Risk score tổng hợp từ:\n• SLA breach weight\n• Unconfirmed meetings\n• Unreviewed meetings\n• Avg review hours\n• Re-review rate\n\nScore càng cao = rủi ro càng lớn`;
      const intensityTooltip = `Chiều dài bar = tỉ lệ score so với team cao nhất (${maxScore.toFixed(1)})\n${score.toFixed(1)} / ${maxScore.toFixed(1)} = ${wPct.toFixed(0)}%`;

      return `
        <tr>
          <td><strong>${d.team}</strong></td>
          <td>
            <div class="risk-score-wrapper flex items-center">
              <span class="tooltip-wrapper" style="margin-left:0">
                <span class="score-badge mr-2" style="background: ${cBg}; color: white">${score.toFixed(1)}</span>
                <span class="tooltip-content" style="white-space:pre-line;width:220px">${scoreTooltip}</span>
              </span>
              <span>${cLabel}</span>
              ${trendHTML}
            </div>
          </td>
          <td>
            <span class="tooltip-wrapper" style="margin-left:0;display:block">
              <div class="risk-bar-container">
                <div class="risk-bar" style="width: ${wPct}%; background-color: ${cBg}"></div>
              </div>
              <span class="tooltip-content">${intensityTooltip}</span>
            </span>
          </td>
        </tr>
      `;
    }).join('');

    this.element.innerHTML = html;
  }
};
