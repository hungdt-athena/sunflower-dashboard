const express = require('express');
const router = express.Router();
const { getPending } = require('../db');

router.get('/', (req, res) => {
  const { team } = req.query;
  res.json(getPending(team));
});

module.exports = router;
