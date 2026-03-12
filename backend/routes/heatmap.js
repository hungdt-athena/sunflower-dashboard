const express = require('express');
const router = express.Router();
const { getHeatmap } = require('../db');

router.get('/', (req, res) => {
  const { team } = req.query;
  res.json(getHeatmap(team));
});

module.exports = router;
