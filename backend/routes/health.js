const express = require('express');
const router = express.Router();
const { getHealth } = require('../db');

router.get('/', (req, res) => {
  const { range = '7d' } = req.query;
  res.json(getHealth(range));
});

module.exports = router;
