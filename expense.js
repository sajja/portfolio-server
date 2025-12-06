const express = require('express');
const router = express.Router();
const db = require('./db');

// Error handling function
function handleDbError(res, err) {
  if (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Database error', details: err.message });
    return true;
  }
  return false;
}

// Function to get current month date range
function getCurrentMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  return {
    start: firstDay.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0]
  };
}

// Function to get last 3 months date range
function getLast3MonthsRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // 3 months ago
  const threeMonthsAgo = new Date(year, month - 2, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  return {
    start: threeMonthsAgo.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0]
  };
}

// Validate date format (YYYY-MM-DD)
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  const timestamp = date.getTime();
  
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return false;
  
  return dateString === date.toISOString().split('T')[0];
}

// Validate UUID format (basic validation)
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Initialize expenses table with UUID column if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    uuid TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating expenses table:', err);
  } else {
    console.log('Expenses table ready');
    
    // After table creation, add columns if they don't exist
    addMissingColumns();
  }
});

// Function to add missing columns in sequence
function addMissingColumns() {
  // Add UUID column to existing expenses table if it doesn't exist (without UNIQUE constraint)
  db.run(`
    ALTER TABLE expenses ADD COLUMN uuid TEXT
  `, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding UUID column:', err);
    }
    
    // Add created_at column after UUID column (without DEFAULT CURRENT_TIMESTAMP for ALTER TABLE)
    db.run(`
      ALTER TABLE expenses ADD COLUMN created_at DATETIME
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Error adding created_at column:', err);
      }
      
      // Create unique index after both columns are added
      db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_uuid ON expenses(uuid)
      `, (err) => {
        if (err && !err.message.includes('already exists')) {
          console.error('Error creating UUID index:', err);
        } else if (!err) {
          console.log('UUID index ready');
        }
      });
    });
  });
}

// POST /api/v1/expense - Record a single expense
router.post('/', (req, res) => {
  const { uuid, date, category, subcategory, amount, description } = req.body;
  
  // Validate required fields
  if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
    return res.status(400).json({ 
      error: 'UUID is required and must be a non-empty string.' 
    });
  }
  
  // Validate UUID format
  if (!isValidUUID(uuid.trim())) {
    return res.status(400).json({ 
      error: 'UUID must be in valid format (e.g., 123e4567-e89b-12d3-a456-426614174000).' 
    });
  }
  
  if (!date || !isValidDate(date)) {
    return res.status(400).json({ 
      error: 'Date is required and must be in YYYY-MM-DD format.' 
    });
  }
  
  if (!category || typeof category !== 'string' || category.trim() === '') {
    return res.status(400).json({ 
      error: 'Category is required and must be a non-empty string.' 
    });
  }
  
  if (!subcategory || typeof subcategory !== 'string' || subcategory.trim() === '') {
    return res.status(400).json({ 
      error: 'Subcategory is required and must be a non-empty string.' 
    });
  }
  
  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ 
      error: 'Amount is required and must be a positive number.' 
    });
  }
  
  // Description is optional, but if provided should be a string
  if (description !== undefined && typeof description !== 'string') {
    return res.status(400).json({ 
      error: 'Description must be a string if provided.' 
    });
  }
  
  const cleanDescription = description ? description.trim() : null;
  
  // Check if UUID already exists to prevent duplicates
  db.get('SELECT uuid FROM expenses WHERE uuid = ?', [uuid.trim()], (err, existingExpense) => {
    if (handleDbError(res, err)) return;
    
    if (existingExpense) {
      return res.status(409).json({ 
        error: 'Transaction with this UUID already exists.' 
      });
    }
    
    // Insert expense record
    const currentTimestamp = new Date().toISOString();
    db.run(
      'INSERT INTO expenses (uuid, date, category, subcategory, amount, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uuid.trim(), date, category.trim(), subcategory.trim(), amount, cleanDescription, currentTimestamp],
      function(err) {
        if (handleDbError(res, err)) return;
        
        res.status(201).json({
          message: 'Expense recorded successfully',
          id: this.lastID,
          uuid: uuid.trim(),
          date: date,
          category: category.trim(),
          subcategory: subcategory.trim(),
          amount: amount,
          description: cleanDescription,
          createdAt: currentTimestamp
        });
      }
    );
  });
});

// GET /api/v1/expense - List all expenses with optional time filtering
router.get('/', (req, res) => {
  const { from_date, to_date, category, subcategory } = req.query;
  
  // Default to current month if no dates provided
  const currentMonth = getCurrentMonthRange();
  const fromDate = from_date || currentMonth.start;
  const toDate = to_date || currentMonth.end;
  
  // Validate date formats if provided
  if (from_date && !isValidDate(from_date)) {
    return res.status(400).json({ 
      error: 'from_date must be in YYYY-MM-DD format.' 
    });
  }
  
  if (to_date && !isValidDate(to_date)) {
    return res.status(400).json({ 
      error: 'to_date must be in YYYY-MM-DD format.' 
    });
  }
  
  // Build SQL query with filters
  let sql = 'SELECT id, uuid, date, category, subcategory, amount, description, created_at FROM expenses WHERE 1=1';
  const params = [];
  
  // Date filtering
  if (fromDate) {
    sql += ' AND date >= ?';
    params.push(fromDate);
  }
  
  if (toDate) {
    sql += ' AND date <= ?';
    params.push(toDate);
  }
  
  // Category filtering
  if (category && typeof category === 'string' && category.trim() !== '') {
    sql += ' AND category = ?';
    params.push(category.trim());
  }
  
  // Subcategory filtering
  if (subcategory && typeof subcategory === 'string' && subcategory.trim() !== '') {
    sql += ' AND subcategory = ?';
    params.push(subcategory.trim());
  }
  
  sql += ' ORDER BY date DESC, created_at DESC';
  
  db.all(sql, params, (err, expenses) => {
    if (handleDbError(res, err)) return;
    
    // Calculate summary statistics
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const categoryBreakdown = {};
    const subcategoryBreakdown = {};
    
    expenses.forEach(expense => {
      // Category breakdown
      if (!categoryBreakdown[expense.category]) {
        categoryBreakdown[expense.category] = 0;
      }
      categoryBreakdown[expense.category] += expense.amount;
      
      // Subcategory breakdown
      const key = `${expense.category} - ${expense.subcategory}`;
      if (!subcategoryBreakdown[key]) {
        subcategoryBreakdown[key] = 0;
      }
      subcategoryBreakdown[key] += expense.amount;
    });
    
    res.status(200).json({
      expenses: expenses.map(expense => ({
        id: expense.id,
        uuid: expense.uuid,
        date: expense.date,
        category: expense.category,
        subcategory: expense.subcategory,
        amount: expense.amount,
        description: expense.description,
        createdAt: expense.created_at
      })),
      summary: {
        totalRecords: expenses.length,
        totalAmount: Math.round(totalAmount * 100) / 100,
        dateRange: {
          from: fromDate,
          to: toDate
        },
        categoryBreakdown,
        subcategoryBreakdown
      },
      filters: {
        from_date: fromDate,
        to_date: toDate,
        category: category || null,
        subcategory: subcategory || null
      }
    });
  });
});

// GET /api/v1/expense/categories - Get all unique categories and subcategories
router.get('/categories', (req, res) => {
  db.all(
    'SELECT DISTINCT category, subcategory FROM expenses ORDER BY category, subcategory',
    [],
    (err, categories) => {
      if (handleDbError(res, err)) return;
      
      // Group subcategories by category
      const categoryMap = {};
      categories.forEach(item => {
        if (!categoryMap[item.category]) {
          categoryMap[item.category] = [];
        }
        categoryMap[item.category].push(item.subcategory);
      });
      
      res.status(200).json({
        categories: categoryMap,
        totalCategories: Object.keys(categoryMap).length,
        totalSubcategories: categories.length
      });
    }
  );
});

// GET /api/v1/expense/category/:name - Get transactions for a specific category with date filtering
router.get('/category/:name', (req, res) => {
  const categoryName = req.params.name;
  const { from_date, to_date } = req.query;
  
  // Validate category name
  if (!categoryName || typeof categoryName !== 'string' || categoryName.trim() === '') {
    return res.status(400).json({ 
      error: 'Category name is required and must be a non-empty string.' 
    });
  }
  
  // Default to current month if no dates provided
  const currentMonth = getCurrentMonthRange();
  const fromDate = from_date || currentMonth.start;
  const toDate = to_date || currentMonth.end;
  
  // Validate date formats if provided
  if (from_date && !isValidDate(from_date)) {
    return res.status(400).json({ 
      error: 'from_date must be in YYYY-MM-DD format.' 
    });
  }
  
  if (to_date && !isValidDate(to_date)) {
    return res.status(400).json({ 
      error: 'to_date must be in YYYY-MM-DD format.' 
    });
  }
  
  // Query to get transactions for the specific category
  const sql = `
    SELECT 
      uuid,
      date,
      category,
      subcategory,
      amount,
      description,
      created_at
    FROM expenses 
    WHERE category = ? AND date >= ? AND date <= ?
    ORDER BY subcategory, date DESC
  `;
  
  db.all(sql, [categoryName.trim(), fromDate, toDate], (err, transactions) => {
    if (handleDbError(res, err)) return;
    
    // If no transactions found for this category
    if (transactions.length === 0) {
      return res.status(404).json({
        error: `No transactions found for category '${categoryName.trim()}' in the specified date range.`,
        category: categoryName.trim(),
        dateRange: {
          from: fromDate,
          to: toDate
        }
      });
    }
    
    // Group transactions by subcategory
    const subcategoryGroups = {};
    let categoryTotal = 0;
    let totalTransactions = 0;
    
    transactions.forEach(transaction => {
      const { subcategory, amount } = transaction;
      
      // Initialize subcategory group if it doesn't exist
      if (!subcategoryGroups[subcategory]) {
        subcategoryGroups[subcategory] = {
          transactions: [],
          subtotal: 0,
          count: 0
        };
      }
      
      // Add transaction to appropriate subcategory group
      subcategoryGroups[subcategory].transactions.push({
        uuid: transaction.uuid,
        date: transaction.date,
        amount: transaction.amount,
        description: transaction.description,
        createdAt: transaction.created_at
      });
      
      // Update totals
      subcategoryGroups[subcategory].subtotal += amount;
      subcategoryGroups[subcategory].count += 1;
      categoryTotal += amount;
      totalTransactions += 1;
    });
    
    // Convert subcategories to array format and sort by subtotal (descending)
    const subcategoriesArray = Object.keys(subcategoryGroups).map(subcategoryName => ({
      name: subcategoryName,
      subtotal: subcategoryGroups[subcategoryName].subtotal,
      transactionCount: subcategoryGroups[subcategoryName].count,
      transactions: subcategoryGroups[subcategoryName].transactions
    })).sort((a, b) => b.subtotal - a.subtotal);
    
    res.status(200).json({
      category: categoryName.trim(),
      dateRange: {
        from: fromDate,
        to: toDate
      },
      summary: {
        totalSubcategories: subcategoriesArray.length,
        totalTransactions: totalTransactions,
        categoryTotal: categoryTotal,
        averagePerTransaction: totalTransactions > 0 ? (categoryTotal / totalTransactions) : 0
      },
      subcategories: subcategoriesArray
    });
  });
});

// GET /api/v1/expense/summary - Get aggregated data by subcategories (default: last 3 months)
router.get('/summary', (req, res) => {
  const { from_date, to_date, category } = req.query;
  
  // Default to last 3 months if no dates provided
  const last3Months = getLast3MonthsRange();
  const fromDate = from_date || last3Months.start;
  const toDate = to_date || last3Months.end;
  
  // Validate date formats if provided
  if (from_date && !isValidDate(from_date)) {
    return res.status(400).json({ 
      error: 'from_date must be in YYYY-MM-DD format.' 
    });
  }
  
  if (to_date && !isValidDate(to_date)) {
    return res.status(400).json({ 
      error: 'to_date must be in YYYY-MM-DD format.' 
    });
  }
  
  // Build SQL query for aggregation
  let sql = `
    SELECT 
      category,
      subcategory,
      COUNT(*) as transaction_count,
      SUM(amount) as total_amount,
      AVG(amount) as average_amount,
      MIN(amount) as min_amount,
      MAX(amount) as max_amount,
      MIN(date) as earliest_transaction,
      MAX(date) as latest_transaction
    FROM expenses 
    WHERE date >= ? AND date <= ?
  `;
  
  const params = [fromDate, toDate];
  
  // Optional category filtering
  if (category && typeof category === 'string' && category.trim() !== '') {
    sql += ' AND category = ?';
    params.push(category.trim());
  }
  
  sql += ' GROUP BY category, subcategory ORDER BY category, total_amount DESC';
  
  db.all(sql, params, (err, summaryData) => {
    if (handleDbError(res, err)) return;
    
    // Calculate overall statistics
    const overallStats = {
      totalTransactions: 0,
      totalAmount: 0,
      categoryCount: new Set(),
      subcategoryCount: summaryData.length
    };
    
    const categoryTotals = {};
    const monthlyBreakdown = {};
    
    summaryData.forEach(item => {
      overallStats.totalTransactions += item.transaction_count;
      overallStats.totalAmount += item.total_amount;
      overallStats.categoryCount.add(item.category);
      
      // Category totals
      if (!categoryTotals[item.category]) {
        categoryTotals[item.category] = {
          total_amount: 0,
          transaction_count: 0,
          subcategories: []
        };
      }
      categoryTotals[item.category].total_amount += item.total_amount;
      categoryTotals[item.category].transaction_count += item.transaction_count;
      categoryTotals[item.category].subcategories.push({
        subcategory: item.subcategory,
        total_amount: item.total_amount,
        transaction_count: item.transaction_count,
        average_amount: Math.round(item.average_amount * 100) / 100
      });
    });
    
    // Get monthly breakdown
    let monthlySQL = `
      SELECT 
        strftime('%Y-%m', date) as month,
        category,
        subcategory,
        SUM(amount) as monthly_amount,
        COUNT(*) as monthly_count
      FROM expenses 
      WHERE date >= ? AND date <= ?
    `;
    
    const monthlyParams = [fromDate, toDate];
    
    if (category && typeof category === 'string' && category.trim() !== '') {
      monthlySQL += ' AND category = ?';
      monthlyParams.push(category.trim());
    }
    
    monthlySQL += ' GROUP BY month, category, subcategory ORDER BY month DESC, category, subcategory';
    
    db.all(monthlySQL, monthlyParams, (err, monthlyData) => {
      if (handleDbError(res, err)) return;
      
      // Process monthly data
      monthlyData.forEach(item => {
        if (!monthlyBreakdown[item.month]) {
          monthlyBreakdown[item.month] = {
            total_amount: 0,
            total_transactions: 0,
            categories: {}
          };
        }
        
        monthlyBreakdown[item.month].total_amount += item.monthly_amount;
        monthlyBreakdown[item.month].total_transactions += item.monthly_count;
        
        if (!monthlyBreakdown[item.month].categories[item.category]) {
          monthlyBreakdown[item.month].categories[item.category] = {};
        }
        
        monthlyBreakdown[item.month].categories[item.category][item.subcategory] = {
          amount: item.monthly_amount,
          count: item.monthly_count
        };
      });
      
      // Round amounts in monthly breakdown
      Object.keys(monthlyBreakdown).forEach(month => {
        monthlyBreakdown[month].total_amount = Math.round(monthlyBreakdown[month].total_amount * 100) / 100;
        
        Object.keys(monthlyBreakdown[month].categories).forEach(category => {
          Object.keys(monthlyBreakdown[month].categories[category]).forEach(subcategory => {
            monthlyBreakdown[month].categories[category][subcategory].amount = 
              Math.round(monthlyBreakdown[month].categories[category][subcategory].amount * 100) / 100;
          });
        });
      });

      res.status(200).json({
        monthlyBreakdown: monthlyBreakdown
      });
    });
  });
});

// GET /api/v1/expense/:uuid - Get specific expense by UUID
router.get('/:uuid', (req, res) => {
  const { uuid } = req.params;
  
  if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
    return res.status(400).json({ 
      error: 'Valid UUID is required.' 
    });
  }
  
  db.get(
    'SELECT id, uuid, date, category, subcategory, amount, description, created_at FROM expenses WHERE uuid = ?',
    [uuid.trim()],
    (err, expense) => {
      if (handleDbError(res, err)) return;
      
      if (!expense) {
        return res.status(404).json({ 
          error: 'Expense not found.' 
        });
      }
      
      res.status(200).json({
        id: expense.id,
        uuid: expense.uuid,
        date: expense.date,
        category: expense.category,
        subcategory: expense.subcategory,
        amount: expense.amount,
        description: expense.description,
        createdAt: expense.created_at
      });
    }
  );
});

// PUT /api/v1/expense/:uuid - Update existing expense
router.put('/:uuid', (req, res) => {
  const { uuid } = req.params;
  const { date, category, subcategory, amount, description } = req.body;
  
  if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
    return res.status(400).json({ 
      error: 'Valid UUID is required.' 
    });
  }
  
  // Check if expense exists
  db.get('SELECT id FROM expenses WHERE uuid = ?', [uuid.trim()], (err, expense) => {
    if (handleDbError(res, err)) return;
    
    if (!expense) {
      return res.status(404).json({ 
        error: 'Expense not found.' 
      });
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    
    if (date !== undefined) {
      if (!isValidDate(date)) {
        return res.status(400).json({ 
          error: 'Date must be in YYYY-MM-DD format.' 
        });
      }
      updates.push('date = ?');
      params.push(date);
    }
    
    if (category !== undefined) {
      if (typeof category !== 'string' || category.trim() === '') {
        return res.status(400).json({ 
          error: 'Category must be a non-empty string.' 
        });
      }
      updates.push('category = ?');
      params.push(category.trim());
    }
    
    if (subcategory !== undefined) {
      if (typeof subcategory !== 'string' || subcategory.trim() === '') {
        return res.status(400).json({ 
          error: 'Subcategory must be a non-empty string.' 
        });
      }
      updates.push('subcategory = ?');
      params.push(subcategory.trim());
    }
    
    if (amount !== undefined) {
      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ 
          error: 'Amount must be a positive number.' 
        });
      }
      updates.push('amount = ?');
      params.push(amount);
    }
    
    if (description !== undefined) {
      if (description !== null && typeof description !== 'string') {
        return res.status(400).json({ 
          error: 'Description must be a string or null.' 
        });
      }
      updates.push('description = ?');
      params.push(description ? description.trim() : null);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'At least one field must be provided for update.' 
      });
    }
    
    params.push(uuid.trim());
    const sql = `UPDATE expenses SET ${updates.join(', ')} WHERE uuid = ?`;
    
    db.run(sql, params, function(err) {
      if (handleDbError(res, err)) return;
      
      res.status(200).json({
        message: 'Expense updated successfully',
        uuid: uuid.trim(),
        updatedFields: updates.length
      });
    });
  });
});

// DELETE /api/v1/expense/:uuid - Delete expense by UUID
router.delete('/:uuid', (req, res) => {
  const { uuid } = req.params;
  
  if (!uuid || typeof uuid !== 'string' || uuid.trim() === '') {
    return res.status(400).json({ 
      error: 'Valid UUID is required.' 
    });
  }
  
  // Check if expense exists
  db.get('SELECT id FROM expenses WHERE uuid = ?', [uuid.trim()], (err, expense) => {
    if (handleDbError(res, err)) return;
    
    if (!expense) {
      return res.status(404).json({ 
        error: 'Expense not found.' 
      });
    }
    
    db.run('DELETE FROM expenses WHERE uuid = ?', [uuid.trim()], function(err) {
      if (handleDbError(res, err)) return;
      
      res.status(200).json({
        message: 'Expense deleted successfully',
        uuid: uuid.trim()
      });
    });
  });
});

module.exports = router;