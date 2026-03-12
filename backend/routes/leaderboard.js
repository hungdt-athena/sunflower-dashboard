const express = require('express');
const router = express.Router();
const { getLeaderboard } = require('../db');

router.get('/', (req, res) => {
  const { range = '7d' } = req.query;
  res.json(getLeaderboard(range));
});

module.exports = router;
