const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');

// PUT /api/v1/companies/dividend
router.put('/dividend', async (req, res) => {
  try {
    db.all('SELECT name FROM stocks WHERE qtty > 0', [], async (err, rows) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error', details: err.message });
      }
      const ownedSymbols = new Set(rows.map(r => r.name.toUpperCase()));
      const response = await axios.post(
        'https://www.cse.lk/api/smd',
        {
          allCompanies: true,
          allCategories: false,
          categories: ['CASH DIVIDEND']
        },
        {
          headers: {
            'accept': 'application/json, text/plain, */*',
            'content-type': 'application/json; charset=UTF-8'
          }
        }
      );
      const allDividends = response.data?.Announcement?.['CASH DIVIDEND'] || [];
      db.run('DELETE FROM dividend', [], function (delErr) {
        if (delErr) {
          console.error('Database error:', delErr);
          return res.status(500).json({ error: 'Database error', details: delErr.message });
        }
        const insertStmt = db.prepare(
          `INSERT INTO dividend (symbol, xd_date, payment_date, remarks, div_ps)
           VALUES (?, ?, ?, ?, ?)`
        );
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');
          allDividends.forEach(d => {
            insertStmt.run(
              d.symbol,
              d.xd,
              d.payment,
              d.remarks,
              d.votingDivPerShare
            );
          });
          insertStmt.finalize();
          db.run('COMMIT');
        });
        const filtered = allDividends.map(d => ({
          symbol: d.symbol,
          xd: d.xd,
          payment: d.payment,
          remarks: d.remarks,
          div_ps: d.votingDivPerShare,
          own: ownedSymbols.has((d.symbol || '').toUpperCase())
        }));
        res.json({ dividends: filtered });
      });
    });
  } catch (error) {
    console.error('Error fetching dividend data:', error.message);
    res.status(500).json({ error: 'Failed to fetch dividend data', details: error.message });
  }
});

// GET /api/v1/companies/dividend?own=true|false
router.get('/dividend', (req, res) => {
  const ownOnly = req.query.own !== 'false';
  db.all('SELECT name FROM stocks WHERE qtty > 0', [], (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error', details: err.message });
    }
    const ownedSymbols = new Set(rows.map(r => r.name.toUpperCase()));
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