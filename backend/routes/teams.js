const express = require('express');
const router = express.Router();
const { stmts } = require('../db');

router.get('/', (req, res) => {
  const teams = stmts.getTeams.all().map(r => r.team);
  res.json(teams);
});

module.exports = router;
