const express = require('express');
const router = express.Router();
const db = require('./db');
const axios = require('axios');
const { usdBuyingRateCache } = require('./rateService');

// In-memory cache for CSE API data
const cseDataCache = new Map();



// Error handling function
function handleDbError(res, err) {
  if (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
    return true;
  }
  return false;
}

// Function to check if current time is within trading hours (9:15 AM to 2:30 PM on weekdays)
function isTradingHours() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = now.getHours();
  const minute = now.getMinutes();
  
  // Check if it's a weekday (Monday to Friday)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false; // Weekend
  }
  
  // Check if time is between 9:15 AM and 2:30 PM
  const currentTimeInMinutes = hour * 60 + minute;
  const startTime = 9 * 60 + 15; // 9:15 AM in minutes
  const endTime = 14 * 60 + 30;  // 2:30 PM in minutes
  
  return currentTimeInMinutes >= startTime && currentTimeInMinutes <= endTime;
}

// Function to fetch stock data from CSE API with caching
async function getStockData(symbol) {
  const cachedData = cseDataCache.get(symbol);
  
  // If we're in trading hours, always call the API
  if (isTradingHours()) {
    console.log(`Trading hours - fetching live data for ${symbol}`);
    try {
      const response = await axios.post(
        'https://www.cse.lk/api/companyInfoSummery',
        new URLSearchParams({ symbol: symbol }),
        {
          headers: {
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'en',
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
          }
        }
      );
      
      const stockData = {
        lastTradedPrice: response.data.reqSymbolInfo?.lastTradedPrice || null,
        previousClose: response.data.reqSymbolInfo?.previousClose || null
      };
      
      // Cache the response
      cseDataCache.set(symbol, {
        data: stockData,
        timestamp: new Date().toISOString()
      });
      
      return stockData;
    } catch (error) {
      console.error(`Error fetching live data for ${symbol}:`, error.message);
      // If API call fails, fall back to cache if available
      if (cachedData) {
        console.log(`API failed - using cached data for ${symbol}`);
        return cachedData.data;
      }
      throw error;
    }
  }
  
  // Outside trading hours - use cache if available
  if (cachedData) {
    console.log(`Outside trading hours - using cached data for ${symbol} (cached at: ${cachedData.timestamp})`);
    return cachedData.data;
  }
  
  // Cache is empty and outside trading hours - fetch from API once and cache it
  console.log(`Cache empty and outside trading hours - fetching data for ${symbol}`);
  try {
    const response = await axios.post(
      'https://www.cse.lk/api/companyInfoSummery',
      new URLSearchParams({ symbol: symbol }),
      {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en',
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
      }
    );
    
    const stockData = {
      lastTradedPrice: response.data.reqSymbolInfo?.lastTradedPrice || null,
      previousClose: response.data.reqSymbolInfo?.previousClose || null
    };
    
    // Cache the response
    cseDataCache.set(symbol, {
      data: stockData,
      timestamp: new Date().toISOString()
    });
    
    return stockData;
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error.message);
    throw error;
  }
}



// --- New Util Endpoint for USD Rate ---
router.get('/util/rates/usd', (req, res) => {
  if (usdBuyingRateCache.rate !== null) {
    res.json({
      rate: usdBuyingRateCache.rate,
      lastUpdated: usdBuyingRateCache.timestamp,
    });
  } else {
    res.status(503).json({ 
      error: 'USD rate is not available at the moment. Please try again later.' 
    });
  }
});
// --- End of New Util Endpoint ---

// GET /api/v1/portfolio/equity
router.get('/equity', async (req, res) => {
  db.all('SELECT symbol, qtty, avg_price, date, comment FROM stocks WHERE qtty > 0', async (err, stocks) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    if (!stocks.length) {
      return res.json({ stocks: [] });
    }

    const currentRows = stocks;
    console.log('Current active stock symbols:', currentRows.map(r => r.symbol));

    const currentSymbols = new Set(currentRows.map(r => r.symbol));
    const results = []; // <-- Make sure this is defined

    for (const stock of stocks) {
      let lastTradedPrice = null;
      let status = "ok"; // Add status field
      try {
        const stockData = await getStockData(stock.symbol);
        // Use lastTradedPrice if available, otherwise fallback to previousClose
        lastTradedPrice = stockData.lastTradedPrice || stockData.previousClose;
        console.log(`Symbol: ${stock.symbol}, Last traded price: ${stockData.lastTradedPrice}, Previous close: ${stockData.previousClose}, Using: ${lastTradedPrice}`);
      } catch (e) {
        console.log(`Symbol: ${stock.symbol}, Error fetching stock data:`, e.message);
        status = "error";
      }
      results.push({
        symbol: stock.symbol,
        qtty: stock.qtty,
        avg_price: stock.avg_price,
        date: stock.date,
        comment: stock.comment,
        lastTradedPrice
      });
    }
    res.json({ stocks: results });
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

// GET /api/v1/portfolio/equity/dividends
router.get('/equity/dividends', (req, res) => {
  const { from_date, to_date } = req.query;
  
  // Default to_date is current date
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const toDate = to_date || currentDate;
  
  // Build SQL query with optional date filtering
  let sql = 'SELECT id, symbol, amount, date, created_at FROM dividend_history';
  const params = [];
  
  if (from_date || to_date) {
    sql += ' WHERE';
    const conditions = [];
    
    if (from_date) {
      conditions.push(' date >= ?');
      params.push(from_date);
    }
    
    if (to_date) {
      conditions.push(' date <= ?');
      params.push(toDate);
    }
    
    sql += conditions.join(' AND');
  }
  
  sql += ' ORDER BY date DESC, created_at DESC';
  
  db.all(sql, params, (err, dividends) => {
    if (handleDbError(res, err)) return;
    
    res.status(200).json({
      dividends: dividends.map(div => ({
        id: div.id,
        symbol: div.symbol,
        amount: div.amount,
        date: div.date,
        created_at: div.created_at
      })),
      filters: {
        from_date: from_date || null,
        to_date: toDate
      },
      total_records: dividends.length
    });
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
  function calcSummary(transactions, dividends) {
    let totalInvestment = 0;
    let totalProfit = 0;
    let totalSellPrice = 0;
    let totalDividends = 0;
    
    transactions.forEach(tx => {
      if (tx.type === 'buy') {
        totalInvestment += tx.qtty * tx.price;
      } else if (tx.type === 'sell') {
        totalSellPrice += (tx.qtty * tx.price);
      }
    });
    
    // Add dividend payouts to profit calculation
    dividends.forEach(div => {
      totalDividends += div.amount;
    });
    
    console.log('Total sell price:', totalSellPrice, 'Total dividends:', totalDividends);
    const totalReturns = totalSellPrice + totalDividends;
    const profitPercent = totalInvestment > 0
      ? Math.round((totalReturns / totalInvestment) * 10000) / 100
      : 0;
    return {
      total_investment: Math.round(totalInvestment * 100) / 100,
      profit_percent: profitPercent,
      total_dividends: Math.round(totalDividends * 100) / 100
    };
  }
  
  // Fetch both transactions and dividend history
  db.all(`SELECT * FROM transactions`, [], (err, transactions) => {
    if (handleDbError(res, err)) return;
    
    db.all(`SELECT symbol, amount, date FROM dividend_history`, [], (err, dividends) => {
      if (handleDbError(res, err)) return;
      
      const last24 = monthsAgo(24);
      const last12 = monthsAgo(12);
      const last6 = monthsAgo(6);
      
      const tx24 = transactions.filter(tx => tx.date >= last24);
      const tx12 = transactions.filter(tx => tx.date >= last12);
      const tx6 = transactions.filter(tx => tx.date >= last6);
      
      // Filter dividends by payment date (stored in 'date' column)
      const div24 = dividends.filter(div => div.date >= last24);
      const div12 = dividends.filter(div => div.date >= last12);
      const div6 = dividends.filter(div => div.date >= last6);
      
      res.json({
        equity: {
          summary_24_months: calcSummary(tx24, div24),
          summary_12_months: calcSummary(tx12, div12),
          summary_6_months: calcSummary(tx6, div6)
        }
      });
    });
  });
});

// PUT /api/v1/portfolio/equity/:name/dividend
router.put('/equity/:name/dividend', (req, res) => {
  const { name } = req.params;
  const { amount, date } = req.body;
  
  if (!amount || !date || amount <= 0) {
    return res.status(400).json({ 
      error: 'Dividend amount (positive number) and date are required.' 
    });
  }
  
  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return res.status(400).json({ 
      error: 'Date must be in YYYY-MM-DD format.' 
    });
  }
  
  const symbol = name.toUpperCase();
  
  // Check if stock exists in portfolio
  db.get('SELECT symbol FROM stocks WHERE symbol = ?', [symbol], (err, stock) => {
    if (handleDbError(res, err)) return;
    
    if (!stock) {
      return res.status(404).json({ 
        error: `Stock ${symbol} not found in portfolio.` 
      });
    }
    
    // Insert dividend record
    db.run(
      'INSERT INTO dividend_history (symbol, amount, date) VALUES (?, ?, ?)',
      [symbol, amount, date],
      function(err) {
        if (handleDbError(res, err)) return;
        
        res.status(200).json({
          message: 'Dividend recorded successfully',
          symbol: symbol,
          amount: amount,
          date: date,
          id: this.lastID
        });
      }
    );
  });
});

// PUT /api/v1/portfolio/fd
router.put('/fd', (req, res) => {
  const { bankName, principalAmount, interestRate, maturityPeriod } = req.body;
  
  // Validate input data
  if (!bankName || typeof bankName !== 'string' || bankName.trim() === '') {
    return res.status(400).json({ 
      error: 'Bank name is required and must be a non-empty string.' 
    });
  }
  
  if (!principalAmount || typeof principalAmount !== 'number' || principalAmount <= 0) {
    return res.status(400).json({ 
      error: 'Principal amount is required and must be a positive number.' 
    });
  }
  
  if (!interestRate || typeof interestRate !== 'number' || interestRate <= 0) {
    return res.status(400).json({ 
      error: 'Interest rate is required and must be a positive number.' 
    });
  }
  
  if (!maturityPeriod || typeof maturityPeriod !== 'number' || maturityPeriod <= 0 || !Number.isInteger(maturityPeriod)) {
    return res.status(400).json({ 
      error: 'Maturity period is required and must be a positive integer (months).' 
    });
  }
  
  // Calculate dates
  const currentDate = new Date();
  const startDate = currentDate.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const maturityDate = new Date(currentDate);
  maturityDate.setMonth(maturityDate.getMonth() + maturityPeriod);
  const maturityDateStr = maturityDate.toISOString().split('T')[0];
  
  // Calculate maturity value: Principal + (Principal × Interest Rate × Period) / 100 / 12
  const interest = (principalAmount * interestRate * maturityPeriod) / 100 / 12;
  const maturityValue = Math.round((principalAmount + interest) * 100) / 100;
  
  // Insert FD record
  db.run(
    'INSERT INTO fixed_deposits (bank_name, principal_amount, interest_rate, maturity_period, start_date, maturity_date, maturity_value) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [bankName.trim(), principalAmount, interestRate, maturityPeriod, startDate, maturityDateStr, maturityValue],
    function(err) {
      if (handleDbError(res, err)) return;
      
      res.status(201).json({
        message: 'Fixed deposit created successfully',
        id: this.lastID,
        bankName: bankName.trim(),
        principalAmount: principalAmount,
        interestRate: interestRate,
        maturityPeriod: maturityPeriod,
        startDate: startDate,
        maturityDate: maturityDateStr,
        maturityValue: maturityValue
      });
    }
  );
});

// GET /api/v1/portfolio/fd
router.get('/fd', (req, res) => {
  db.all(
    'SELECT id, bank_name, principal_amount, interest_rate, maturity_period, start_date, maturity_date, maturity_value, created_at FROM fixed_deposits ORDER BY created_at DESC',
    [],
    (err, fixedDeposits) => {
      if (handleDbError(res, err)) return;
      
      res.status(200).json({
        fixedDeposits: fixedDeposits.map(fd => ({
          id: fd.id,
          bankName: fd.bank_name,
          principalAmount: fd.principal_amount,
          interestRate: fd.interest_rate,
          maturityPeriod: fd.maturity_period,
          startDate: fd.start_date,
          maturityDate: fd.maturity_date,
          maturityValue: fd.maturity_value,
          createdAt: fd.created_at
        }))
      });
    }
  );
});

// PUT /api/v1/portfolio/fx
router.put('/fx', (req, res) => {
  const { bankName, interestRate, amount, currency } = req.body;
  
  // Validate input data
  if (!bankName || typeof bankName !== 'string' || bankName.trim() === '') {
    return res.status(400).json({ 
      error: 'Bank name is required and must be a non-empty string.' 
    });
  }
  
  if (!interestRate || typeof interestRate !== 'number' || interestRate <= 0) {
    return res.status(400).json({ 
      error: 'Interest rate is required and must be a positive number.' 
    });
  }
  
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ 
      error: 'Amount is required and must be a positive number.' 
    });
  }
  
  if (!currency || typeof currency !== 'string' || currency.trim() === '') {
    return res.status(400).json({ 
      error: 'Currency is required and must be a non-empty string.' 
    });
  }
  
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  // Insert FX record into deposits table
  db.run(
    'INSERT INTO deposits (bank_name, amount, interest_rate, currency, date) VALUES (?, ?, ?, ?, ?)',
    [bankName.trim(), amount, interestRate, currency.trim().toUpperCase(), currentDate],
    function(err) {
      if (handleDbError(res, err)) return;
      
      res.status(201).json({
        message: 'FX deposit created successfully',
        id: this.lastID,
        bankName: bankName.trim(),
        interestRate: interestRate,
        amount: amount,
        currency: currency.trim().toUpperCase(),
        date: currentDate
      });
    }
  );
});

// GET /api/v1/portfolio/fx
router.get('/fx', (req, res) => {
  // Get FX deposits from the deposits table
  db.all(
    'SELECT id, bank_name, amount, interest_rate, currency, date, created_at FROM deposits ORDER BY created_at DESC',
    [],
    (err, fxDeposits) => {
      if (handleDbError(res, err)) return;
      
      res.status(200).json({
        fxDeposits: fxDeposits.map(fx => ({
          id: fx.id,
          bankName: fx.bank_name,
          interestRate: fx.interest_rate,
          amount: fx.amount,
          currency: fx.currency,
          date: fx.date,
          createdAt: fx.created_at
        }))
      });
    }
  );
});

// PUT /api/v1/portfolio/indexfund
router.put('/indexfund', (req, res) => {
  const { amount, rate, fundHolder, fundType } = req.body;

  // Validate input data
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ 
      error: 'Amount is required and must be a positive number.' 
    });
  }

  if (!rate || typeof rate !== 'number' || rate <= 0) {
    return res.status(400).json({ 
      error: 'Rate is required and must be a positive number.' 
    });
  }

  if (!fundHolder || typeof fundHolder !== 'string' || fundHolder.trim() === '') {
    return res.status(400).json({ 
      error: 'Fund holder is required and must be a non-empty string.' 
    });
  }

  if (!fundType || typeof fundType !== 'string' || fundType.trim() === '') {
    return res.status(400).json({ 
      error: 'Fund type is required and must be a non-empty string.' 
    });
  }

  // Insert index fund record
  db.run(
    'INSERT INTO index_fund (amount, rate, fund_holder, fund_type) VALUES (?, ?, ?, ?)',
    [amount, rate, fundHolder.trim(), fundType.trim()],
    function(err) {
      if (handleDbError(res, err)) return;
      
      res.status(201).json({
        message: 'Index fund created successfully',
        id: this.lastID,
        amount,
        rate,
        fundHolder: fundHolder.trim(),
        fundType: fundType.trim()
      });
    }
  );
});

// GET /api/v1/portfolio/indexfund
router.get('/indexfund', (req, res) => {
  db.all(
    'SELECT id, amount, rate, fund_holder, fund_type, created_at FROM index_fund ORDER BY created_at DESC',
    [],
    (err, indexFunds) => {
      if (handleDbError(res, err)) return;
      
      res.status(200).json({
        indexFunds: indexFunds.map(fund => ({
          id: fund.id,
          amount: fund.amount,
          rate: fund.rate,
          fundHolder: fund.fund_holder,
          fundType: fund.fund_type,
          createdAt: fund.created_at
        }))
      });
    }
  );
});

// PUT /api/v1/portfolio/indexfund/:id
router.put('/indexfund/:id', (req, res) => {
  const { id } = req.params;
  const { amount, rate, fundHolder, fundType } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid ID format.' });
  }

  // For PUT, we expect all fields to be present for a full update
  if (amount === undefined || rate === undefined || fundHolder === undefined || fundType === undefined) {
    return res.status(400).json({ error: 'All fields (amount, rate, fundHolder, fundType) are required for an update.' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number.' });
  }

  if (typeof rate !== 'number' || rate <= 0) {
    return res.status(400).json({ error: 'Rate must be a positive number.' });
  }

  if (typeof fundHolder !== 'string' || fundHolder.trim() === '') {
    return res.status(400).json({ error: 'Fund holder must be a non-empty string.' });
  }

  if (typeof fundType !== 'string' || fundType.trim() === '') {
    return res.status(400).json({ error: 'Fund type must be a non-empty string.' });
  }

  const sql = `UPDATE index_fund SET amount = ?, rate = ?, fund_holder = ?, fund_type = ? WHERE id = ?`;
  const params = [amount, rate, fundHolder.trim(), fundType.trim(), id];

  db.run(sql, params, function (err) {
    if (handleDbError(res, err)) return;
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Index fund not found.' });
    }
    res.status(200).json({ message: 'Index fund updated successfully.' });
  });
});




// GET /api/v1/portfolio/cache/status - Debug endpoint to view cache status
router.get('/cache/status', (req, res) => {
  const tradingHours = isTradingHours();
  const cacheEntries = {};
  
  for (const [symbol, data] of cseDataCache.entries()) {
    cacheEntries[symbol] = {
      timestamp: data.timestamp,
      ageMinutes: Math.round((new Date() - new Date(data.timestamp)) / (1000 * 60)),
      lastTradedPrice: data.data.lastTradedPrice,
      previousClose: data.data.previousClose
    };
  }
  
  res.json({
    isTradingHours: tradingHours,
    totalCacheEntries: cseDataCache.size,
    cacheEntries: cacheEntries,
    message: tradingHours ? 'Currently in trading hours (9:15 AM - 2:30 PM) - API calls will be made' : 'Outside trading hours - using cache when available'
  });
});

// DELETE /api/v1/portfolio/cache - Debug endpoint to clear cache
router.delete('/cache', (req, res) => {
  const clearedEntries = cseDataCache.size;
  cseDataCache.clear();
  console.log(`Cache cleared - removed ${clearedEntries} entries`);
  
  res.json({
    message: 'Cache cleared successfully',
    clearedEntries
  });
});

module.exports = router;
