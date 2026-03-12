const express = require('express');
const router = express.Router();
const { getRows } = require('../db');

router.get('/', (req, res) => {
  const { team, type, status, range, page, limit, search } = req.query;
  res.json(getRows({
    team,
    type,
    status,
    range,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    search,
  }));
});

module.exports = router;
