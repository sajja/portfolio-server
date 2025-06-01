const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');

// Error handling function
function handleDbError(res, err) {
  if (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
    return true;
  }
  return false;
}

// Add this helper function near the top of your file
function modifyTime(timeStr) {
  // timeStr: "HH:MM:SS"
  const [h, m, s] = timeStr.split(':').map(Number);

  // Check if time is less than 09:30:00
  let date;
  date = new Date(2000, 0, 1, h, m, s);
  if (h < 9 || (h === 9 && m < 30)) {
    // Add 12 hours
    date.setHours(date.getHours() + 12);
  } 

  const modified = date.toTimeString().slice(0, 8); // "HH:MM:SS"

  // If modified time is over 14:30:00, throw error and print original time
  const [mh, mm, ms] = modified.split(':').map(Number);
  if (mh > 14 || (mh === 14 && mm > 30)) {
    console.error(`Time overflow: original time was ${timeStr} new time ${modified}}` );
    throw new Error(`Modified time exceeds 14:30:00 for original time ${timeStr}`);
  }
  return modified;
}

// GET /api/v1/portfolio/equity
router.get('/equity', async (req, res) => {
  db.all('SELECT symbol, qtty, avg_price, date, comment FROM stocks WHERE qtty > 0', async (err, stocks) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!stocks.length) {
      return res.json({ stocks: [] });
    }

    // For each symbol, check if we have a price in current_stock_values
    db.all('SELECT symbol FROM current_stock_values', async (err, currentRows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      const currentSymbols = new Set(currentRows.map(r => r.symbol));
      for (const stock of stocks) {
        if (!currentSymbols.has(stock.symbol)) {
          try {
            // Fetch from CSE API
            const response = await axios.post(
              'https://www.cse.lk/api/daysTrade',
              new URLSearchParams({ symbol: `${stock.symbol}.N0000` }),
              {
                headers: {
                  'accept': 'application/json, text/plain, */*',
                  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
                }
              }
            );
            const trades = Array.isArray(response.data) ? response.data : [response.data];
            const validTrades = trades.filter(t => t && t.time);

            // Map each trade to include the modified time (+3h and 12h adjustment if needed)
            const tradesWithModifiedTime = validTrades.map(trade => ({
              ...trade,
              modifiedTime: modifyTime(trade.time)
            }));

            // Sort by modifiedTime descending (latest first)
            tradesWithModifiedTime.sort((a, b) => (a.modifiedTime < b.modifiedTime ? 1 : -1));

            // Print each trade's modified time and price
            tradesWithModifiedTime.forEach(trade => {
              console.log(`Symbol: ${stock.symbol}, Trading time (+3h): ${trade.modifiedTime}, Price: ${trade.price}`);
            });
            if (validTrades.length > 0) {
              // Sort by time (HH:MM:SS lexicographically)
              validTrades.sort((a, b) => (a.time > b.time ? 1 : -1));
              const latest = validTrades[validTrades.length - 1];
              console.log(`Symbol: ${stock.symbol}, Last update time: ${latest.time}`);
              // Optionally, you can store the latest price/time in your DB here
            }
          } catch (e) {
            console.log(`Symbol: ${stock.symbol}, Error fetching latest trade`);
          }
        }
      }
      res.json({ stocks });
    });
  });
});

// POST /api/v1/portfolio/equity/:eqtName
router.post('/equity/:eqtName', (req, res) => {
  const { comment } = req.body;
  const eqtName = req.params.eqtName.toUpperCase();

  if (!comment || !eqtName) {
    return res.status(400).json({ error: 'Missing required field: comment or eqtName' });
  }

  db.run(
    'UPDATE stocks SET comment = ? WHERE symbol = ?',
    [comment, eqtName],
    function (err) {
      if (handleDbError(res, err)) return;
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Equity not found' });
      }
      res.json({ message: 'Comment saved successfully', eqtName, comment });
    }
  );
});

// POST /api/v1/portfolio/equity/:name/buy
router.post('/equity/:name/buy', (req, res) => {
  let name = req.params.name.toUpperCase();
  let { qtty, price } = req.body;

  if (
    qtty === undefined || price === undefined ||
    typeof qtty !== 'number' || typeof price !== 'number' ||
    qtty <= 0 || price <= 0
  ) {
    return res.status(400).json({ error: 'Missing or invalid required fields: qtty and price must be positive numbers' });
  }

  const date = new Date().toISOString().split('T')[0];

  db.run(
    'INSERT INTO transactions (stock, type, qtty, price, date) VALUES (?, ?, ?, ?, ?)',
    [name, 'buy', qtty, price, date]
  );

  db.get('SELECT qtty, avg_price FROM stocks WHERE symbol = ?', [name], (err, row) => {
    if (handleDbError(res, err)) return;
    if (row) {
      const oldQtty = row.qtty;
      const oldPrice = row.avg_price;
      const newQtty = oldQtty + qtty;
      const avgPrice = Math.round(((oldQtty * oldPrice) + (qtty * price)) / newQtty * 100) / 100;
      db.run(
        'UPDATE stocks SET qtty = ?, avg_price = ?, date = ? WHERE symbol = ?',
        [newQtty, avgPrice, date, name],
        function (err) {
          if (handleDbError(res, err)) return;
          res.json({ message: 'Stock bought successfully', name, qtty: newQtty, avg_price: avgPrice });
        }
      );
    } else {
      const roundedPrice = Math.round(price * 100) / 100;
      db.run(
        'INSERT INTO stocks (symbol, qtty, avg_price, date) VALUES (?, ?, ?, ?)',
        [name, qtty, roundedPrice, date],
        function (err) {
          if (handleDbError(res, err)) return;
          res.json({ message: 'Stock bought successfully', name, qtty, avg_price: roundedPrice });
        }
      );
    }
  });
});

// POST /api/v1/portfolio/equity/:name/sell
router.post('/equity/:name/sell', (req, res) => {
  let name = req.params.name.toUpperCase();
  let { qtty, price } = req.body;

  if (
    qtty === undefined || price === undefined ||
    typeof qtty !== 'number' || typeof price !== 'number' ||
    qtty <= 0 || price <= 0
  ) {
    return res.status(400).json({ error: 'Missing or invalid required fields: qtty and price must be positive numbers' });
  }

  const date = new Date().toISOString().split('T')[0];

  db.get('SELECT qtty, avg_price FROM stocks WHERE symbol = ?', [name], (err, row) => {
    if (handleDbError(res, err)) return;
    if (!row) {
      return res.status(400).json({ error: 'Cannot sell stock that does not exist' });
    }
    if (qtty > row.qtty) {
      return res.status(400).json({ error: 'Cannot sell more than owned quantity' });
    }
    let newQtty = row.qtty - qtty;
    const profitLoss = Math.round(((price - row.avg_price) * qtty) * 100) / 100;

    db.run(
      'INSERT INTO transactions (stock, type, qtty, price, date, profit_loss) VALUES (?, ?, ?, ?, ?, ?)',
      [name, 'sell', qtty, price, date, profitLoss]
    );

    db.run(
      'UPDATE stocks SET qtty = ?, avg_price = ?, date = ? WHERE symbol = ?',
      [newQtty, row.avg_price, date, name],
      function (err) {
        if (handleDbError(res, err)) return;
        res.json({ message: 'Stock sold successfully', name, qtty: newQtty, profit_loss: profitLoss });
      }
    );
  });
});

// GET /api/v1/portfolio/equity/transactions
router.get('/equity/transactions', (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT stock, type, qtty, price, date, profit_loss FROM transactions';
  const params = [];
  if (type === 'buy' || type === 'sell') {
    sql += ' WHERE type = ?';
    params.push(type);
  }
  sql += ' ORDER BY date DESC';
  db.all(sql, params, (err, transactions) => {
    if (handleDbError(res, err)) return;
    res.json({ transactions });
  });
});

// GET /api/v1/portfolio/equity/:name
router.get('/equity/:name', (req, res) => {
  const name = req.params.name;
  const showTransactions = req.query.show_transactions === 'true';
  db.get('SELECT symbol, qtty, avg_price, date, comment FROM stocks WHERE symbol = ?', [name], (err, stock) => {
    if (handleDbError(res, err)) return;
    if (!stock) {
      return res.status(404).json({ error: 'Stock not found' });
    }
    if (!showTransactions) {
      return res.json(stock);
    }
    db.all('SELECT type, qtty, price, date FROM transactions WHERE stock = ? ORDER BY date DESC', [name], (err, transactions) => {
      if (handleDbError(res, err)) return;
      res.json({
        ...stock,
        transactions
      });
    });
  });
});

// GET /api/v1/portfolio/equity/:name/transactions
router.get('/equity/:name/transactions', (req, res) => {
  const name = req.params.name;
  db.all(
    'SELECT type, qtty, price, date, profit_loss FROM transactions WHERE stock = ? ORDER BY date DESC',
    [name],
    (err, transactions) => {
      if (handleDbError(res, err)) return;
      res.json({ stock: name, transactions });
    }
  );
});

// GET /api/v1/portfolio/summary
router.get('/summary', (req, res) => {
  const now = new Date();
  function monthsAgo(months) {
    const d = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    return d.toISOString().split('T')[0];
  }
  function calcSummary(transactions) {
    let totalInvestment = 0;
    let totalProfit = 0;
    transactions.forEach(tx => {
      if (tx.type === 'buy') {
        totalInvestment += tx.qtty * tx.price;
      } else if (tx.type === 'sell' && tx.profit_loss != null) {
        totalProfit += tx.profit_loss;
      }
    });
    const profitPercent = totalInvestment > 0
      ? Math.round((totalProfit / totalInvestment) * 10000) / 100
      : 0;
    return {
      total_investment: Math.round(totalInvestment * 100) / 100,
      profit_percent: profitPercent
    };
  }
  db.all(`SELECT * FROM transactions`, [], (err, transactions) => {
    if (handleDbError(res, err)) return;
    const last24 = monthsAgo(24);
    const last12 = monthsAgo(12);
    const last6 = monthsAgo(6);
    const tx24 = transactions.filter(tx => tx.date >= last24);
    const tx12 = transactions.filter(tx => tx.date >= last12);
    const tx6 = transactions.filter(tx => tx.date >= last6);
    res.json({
      equity: {
        summary_24_months: calcSummary(tx24),
        summary_12_months: calcSummary(tx12),
        summary_6_months: calcSummary(tx6)
      }
    });
  });
});

module.exports = router;
