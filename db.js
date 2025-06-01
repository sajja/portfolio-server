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

module.exports = db;