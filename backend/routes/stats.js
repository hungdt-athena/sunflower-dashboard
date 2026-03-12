const express = require('express');
const router = express.Router();
const { getStats, getVelocityComparison } = require('../db');

router.get('/', (req, res) => {
  const { team = 'all', range = 'all' } = req.query;
  const stats = getStats(team, range);
  const velocity = getVelocityComparison(team);
  res.json({ ...stats, velocity });
});

module.exports = router;
