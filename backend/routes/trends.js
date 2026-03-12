const express = require('express');
const router = express.Router();
const { getTrends } = require('../db');

router.get('/', (req, res) => {
  const { team, days = 30 } = req.query;
  res.json(getTrends(team, parseInt(days)));
});

module.exports = router;
