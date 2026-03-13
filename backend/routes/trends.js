const express = require('express');
const router = express.Router();
const { getTrends } = require('../db');

router.get('/', (req, res) => {
  const { team, range } = req.query;
  res.json(getTrends(team, range));
});

module.exports = router;
