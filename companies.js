const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const DividentExtract = require('./DividentExtract');

// PUT /api/v1/companies/dividend
router.put('/dividend', async (req, res) => {
  try {
    db.all('SELECT symbol FROM stocks WHERE qtty > 0', [], async (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      const ownedSymbols = new Set(rows.map(r => r.symbol.toUpperCase()));
      const allDividends = await DividentExtract.fetchAllDividends();
      try {
        await DividentExtract.insertDividendsToDb(db, allDividends);
      } catch (dbErr) {
        console.error('Database error:', dbErr);
        return res.status(500).json({ error: 'Database error', details: dbErr.message });
      }
      const filtered = DividentExtract.filterAndMarkOwned(allDividends, ownedSymbols);
      res.json({ dividends: filtered });
    });
  } catch (error) {
    console.error('Error fetching dividend data:', error.message);
    res.status(500).json({ error: 'Failed to fetch dividend data', details: error.message });
  }
});

// GET /api/v1/companies/dividend?own=true|false
router.get('/dividend', (req, res) => {
  const ownOnly = req.query.own !== 'false';
  db.all('SELECT symbol FROM stocks WHERE qtty > 0', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    const ownedSymbols = new Set(rows.map(r => r.symbol.toUpperCase()));
    db.all('SELECT symbol, xd_date, payment_date, remarks, div_ps FROM dividend', [], (err, dividends) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      const withOwn = dividends.map(d => ({
        ...d,
        own: ownedSymbols.has((d.symbol || '').toUpperCase())
      }));
      const result = ownOnly ? withOwn.filter(d => d.own) : withOwn;
      res.json({ dividends: result });
    });
  });
});

module.exports = router;