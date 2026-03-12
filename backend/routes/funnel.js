const express = require('express');
const router = express.Router();
const { getFunnel } = require('../db');

router.get('/', (req, res) => {
  const { team, range = 'all' } = req.query;
  res.json(getFunnel(team, range));
});

module.exports = router;
