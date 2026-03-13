const express = require('express');
const router = express.Router();
const { getStats, getPerformanceComparison } = require('../db');

router.get('/', (req, res) => {
  const { team = 'all', range = 'all' } = req.query;
  const stats = getStats(team, range);
  const velocity = getPerformanceComparison(team, range);
  res.json({ ...stats, velocity });
});

module.exports = router;
