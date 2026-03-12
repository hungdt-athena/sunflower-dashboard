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
    
    if (data.length === 0) {
      this.element.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No data available</td></tr>';
      return;
    }

    const maxScore = Math.max(...data.map(d => d.score), 100);

    const html = data.map(d => {
      const cLabel = Palette.getRiskLabel(d.band);
      const cBg = Palette.getRiskColor(d.band);
      const wPct = (d.score / maxScore) * 100;

      return `
        <tr>
          <td><strong>${d.team}</strong></td>
          <td>
            <div class="risk-score-wrapper">
              <span class="score-badge" style="background: ${cBg}; color: white">${d.score.toFixed(1)}</span>
              <span class="ml-2">${cLabel}</span>
            </div>
          </td>
          <td>
            <div class="risk-bar-container">
              <div class="risk-bar" style="width: ${wPct}%; background-color: ${cBg}"></div>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.element.innerHTML = html;
  }
};
