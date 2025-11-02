const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./portfolio.db', (err) => {
  if (err) {
    console.error('Could not connect to SQLite database', err);
  } else {
    console.log('Connected to SQLite database');
  }
});

// Create table if not exists
db.run(`
  CREATE TABLE IF NOT EXISTS stocks (
    symbol TEXT PRIMARY KEY,
    qtty INTEGER NOT NULL,
    avg_price REAL NOT NULL,
    date TEXT NOT NULL,
    comment TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creating stocks table:', err);
  }
});

db.run(`
CREATE TABLE if not exists "dividend" (
    symbol TEXT NOT NULL,
    xd_date TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    remarks TEXT,
    div_ps REAL,
    PRIMARY KEY (symbol, xd_date)
  )
`, (err) => {
  if (err) {
    console.error('Error creating stocks table:', err);
  }
});

db.run(`
CREATE TABLE if not exists current_stock_values (
    symbol TEXT NOT NULL,
    last_updated TEXT NOT NULL,
    PRIMARY KEY (symbol)
  )
`, (err) => {
  if (err) {
    console.error('Error creating stocks table:', err);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stock TEXT NOT NULL,
    type TEXT NOT NULL,
    qtty INTEGER NOT NULL,
    price REAL NOT NULL,
    date TEXT NOT NULL,
    profit_loss REAL
  )
`, (err) => {
  if (err) {
    console.error('Error creating transactions table:', err);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NOT NULL,
    amount REAL NOT NULL,
    description TEXT
  )
`, (err) => {
  if (err) {
    console.error('Error creating expenses table:', err);
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS expense_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month TEXT NOT NULL,
    UNIQUE(year, month)
  )
`, (err) => {
  if (err) {
    console.error('Error creating expense_meta table:', err);
  }
});

// Create dividend_history table
db.run(`
  CREATE TABLE IF NOT EXISTS dividend_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (symbol) REFERENCES stocks(symbol)
  )
`, (err) => {
  if (err) {
    console.error('Error creating dividend_history table:', err);
  } else {
    console.log('dividend_history table ready');
  }
});

// Create fixed_deposits table
db.run(`
  CREATE TABLE IF NOT EXISTS fixed_deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name TEXT NOT NULL,
    principal_amount REAL NOT NULL,
    interest_rate REAL NOT NULL,
    maturity_period INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    maturity_date TEXT NOT NULL,
    maturity_value REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating fixed_deposits table:', err);
  } else {
    console.log('fixed_deposits table ready');
  }
});

// Add maturity_value column to existing fixed_deposits table if it doesn't exist
db.run(`
  ALTER TABLE fixed_deposits ADD COLUMN maturity_value REAL DEFAULT 0
`, (err) => {
  if (err && !err.message.includes('duplicate column name')) {
    console.error('Error adding maturity_value column:', err);
  } else if (!err) {
    console.log('maturity_value column added to fixed_deposits table');
  }
});

// Create deposits table for FX deposits
db.run(`
  CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name TEXT NOT NULL,
    amount REAL NOT NULL,
    interest_rate REAL NOT NULL,
    currency TEXT NOT NULL,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating deposits table:', err);
  } else {
    console.log('deposits table ready');
  }
});

// Create index_fund table
db.run(`
  CREATE TABLE IF NOT EXISTS index_fund (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL,
    rate REAL NOT NULL,
    fund_holder TEXT NOT NULL,
    fund_type TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating index_fund table:', err);
  } else {
    console.log('index_fund table ready');
    // Rename bank column to fund_holder if it exists
    db.all("PRAGMA table_info(index_fund)", (err, columns) => {
      if (err) {
        console.error("Error getting table info for index_fund:", err);
        return;
      }
      const hasBankColumn = columns.some(col => col.name === 'bank');
      if (hasBankColumn) {
        db.run('ALTER TABLE index_fund RENAME COLUMN bank TO fund_holder', (err) => {
          if (err) {
            console.error('Error renaming column bank to fund_holder:', err);
          } else {
            console.log('Renamed column bank to fund_holder in index_fund table.');
          }
        });
      }
    });
  }
});

// Create bonds table
db.run(`
  CREATE TABLE IF NOT EXISTS bonds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    issuer TEXT NOT NULL,
    bond_type TEXT NOT NULL,
    amount REAL NOT NULL,
    coupon_rate REAL NOT NULL,
    issue_date TEXT NOT NULL,
    maturity_date TEXT NOT NULL,
    maturity_value REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) {
    console.error('Error creating bonds table:', err);
  } else {
    console.log('bonds table ready');
    
    // Migration: Rename interest_rate to coupon_rate if it exists
    db.all("PRAGMA table_info(bonds)", (err, columns) => {
      if (err) {
        console.error("Error getting table info for bonds:", err);
        return;
      }
      const hasInterestRateColumn = columns.some(col => col.name === 'interest_rate');
      if (hasInterestRateColumn) {
        db.run('ALTER TABLE bonds RENAME COLUMN interest_rate TO coupon_rate', (err) => {
          if (err) {
            console.error('Error renaming column interest_rate to coupon_rate in bonds table:', err);
          } else {
            console.log('Renamed column interest_rate to coupon_rate in bonds table.');
          }
        });
      }
    });
  }
});

// Create an index on the 'date' column of the expenses table for faster queries
function createExpensesDateIndex() {
  db.run(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)`);
}

function insertExpense({ Date, amount, category, Subcategory, Description }, cb) {
  const stmt = db.prepare(`INSERT INTO expenses (date, amount, category, subcategory, description) VALUES (?, ?, ?, ?, ?)`);
  stmt.run([Date, amount, category, Subcategory, Description || null], function (err) {
    cb(err, this ? this.lastID : null);
  });
  stmt.finalize();
}

module.exports = db;