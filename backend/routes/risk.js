const express = require('express');
const router = express.Router();
const { getRiskScores } = require('../db');

router.get('/', (req, res) => {
  const { range = '7d' } = req.query;
  
  // Parse custom weights from query if provided
  let weights = null;
  if (req.query.w_sla || req.query.w_unconfirmed || req.query.w_unreviewed || req.query.w_avg || req.query.w_rerev) {
    weights = {
      sla: parseFloat(req.query.w_sla) || 0.30,
      unconfirmed: parseFloat(req.query.w_unconfirmed) || 0.25,
      unreviewed: parseFloat(req.query.w_unreviewed) || 0.20,
      avgHours: parseFloat(req.query.w_avg) || 0.15,
      reReview: parseFloat(req.query.w_rerev) || 0.10,
    };
    
    // Normalize to sum to 1.0
    const total = Object.values(weights).reduce((s, v) => s + v, 0);
    if (total > 0) {
      for (const k of Object.keys(weights)) {
        weights[k] = weights[k] / total;
      }
    }
  }

  res.json(getRiskScores(range, weights));
});

module.exports = router;
