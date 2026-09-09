const express = require('express');
const router = express.Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    service: 'SIGES API — Escola Segura',
    status: 'online',
    version: '1.0.0',
    schema: 'siges.intelligence.v1',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
