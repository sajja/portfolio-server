const express = require('express');
const router = express.Router();
const db = require('./db');

// POST /api/v1/expense
router.post('/', (req, res) => {
  const { Year, Month, Expenses } = req.body;
  // Normalize Month to Title Case (e.g., 'jun' -> 'Jun')
  if (typeof Year !== 'number' || !Year || typeof Month !== 'number' || Month < 1 || Month > 12 || !Array.isArray(Expenses) || Expenses.length === 0) {
    return res.status(400).json({ error: 'Request body must include Year (number), Month (number 1-12), and a non-empty Expenses array.' });
  }
  const monthStr = Month.toString().padStart(2, '0');
  console.log(`Importing expenses for Year: ${Year}, Month: ${monthStr}`);
  db.get('SELECT 1 FROM expense_meta WHERE year = ? AND month = ?', [Year, monthStr], (err, row) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error.' });
    }
    if (row) {
      console.warn(`Expenses for Year ${Year} and Month ${Month} already imported.`);
      return res.status(409).json({ error: `Expenses for Year ${Year} and Month ${Month} already imported.` });
    }
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.run('INSERT INTO expense_meta (year, month) VALUES (?, ?)', [Year, monthStr], function(metaErr) {
        if (metaErr) {
          db.run('ROLLBACK');
          if (metaErr.code === 'SQLITE_CONSTRAINT') {
            return res.status(409).json({ error: `Expenses for Year ${Year} and Month ${Month} already imported.` });
          }
          console.error('Error inserting into expense_meta:', metaErr);
          return res.status(500).json({ error: 'Failed to update expense_meta.' });
        }
        const stmt = db.prepare(`INSERT INTO expenses (date, amount, category, subcategory, description) VALUES (?, ?, ?, ?, ?)`);
        const results = [];
        let hasError = false;
        let pending = Expenses.length;
        if (pending === 0) {
          db.run('COMMIT', () => res.status(200).json({ Year, Month, results }));
          return;
        }
        for (const exp of Expenses) {
          const { Date, Amount, Category, Subcategory, Description } = exp;
          const absAmount = Math.abs(Amount);
          if (!Date || !Category || !Subcategory) {
            console.error('Invalid expense:', exp);
            if (!hasError) {
              hasError = true;
              db.run('ROLLBACK');
              return res.status(400).json({ error: 'Invalid expense record found. Transaction rolled back.' });
            }
            continue;
          }
          stmt.run([Date, absAmount, Category, Subcategory, Description || null], function (err) {
            if (err && !hasError) {
              hasError = true;
              db.run('ROLLBACK');
              console.error('Error inserting expense:', err);
              return res.status(500).json({ error: 'Failed to add expenses. Transaction rolled back.' });
            }
            if (!err) {
              results.push({ id: this.lastID, Date, Amount: absAmount, Category, Subcategory, Description });
            }
            if (--pending === 0 && !hasError) {
              stmt.finalize((finalizeErr) => {
                if (finalizeErr) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: 'Failed to finalize statement. Transaction rolled back.' });
                }
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    return res.status(500).json({ error: 'Failed to commit transaction.' });
                  }
                  res.status(200).json({ Year, Month, results });
                });
              });
            }
          });
        }
      });
    });
  });
});

// GET /api/v1/expense?year=YYYY&month=MonthName
router.get('/', (req, res) => {
  const { year, month } = req.query;
  if (!year || !month) {
    return res.status(400).json({ error: 'Query parameters year and month are required.' });
  }
  db.all(
    `SELECT id, date, amount, category, subcategory, description FROM expenses 
     WHERE strftime('%Y', date) = ? AND strftime('%m', date) = ?`,
    [year, month.padStart(2, '0')],
    (err, rows) => {
      if (err) {
        console.error('Error fetching expenses:', err);
        return res.status(500).json({ error: 'Failed to fetch expenses.' });
      }
      res.status(200).json({ year, month, expenses: rows });
    }
  );
});

// GET /api/v1/expense/summary?months=N
router.get('/summary', (req, res) => {
  const period = parseInt(req.query.months, 10) || 6;
  const now = new Date();
  const months = [];
  for (let i = 0; i < period; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear().toString(),
      month: (d.getMonth() + 1).toString().padStart(2, '0'),
      label: `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
    });
  }

  const placeholders = months.map(() => '(strftime("%Y", date) = ? AND strftime("%m", date) = ?)').join(' OR ');
  const params = months.flatMap(m => [m.year, m.month]);

  db.all(
    `SELECT strftime('%Y', date) as year, strftime('%m', date) as month, category, subcategory, SUM(amount) as total
     FROM expenses
     WHERE ${placeholders}
     GROUP BY year, month, category, subcategory
     ORDER BY year DESC, month DESC, category, subcategory`,
    params,
    (err, rows) => {
      if (err) {
        console.error('Error fetching summary:', err);
        return res.status(500).json({ error: 'Failed to fetch summary.' });
      }
      const summary = {};
      for (const m of months) {
        summary[m.label] = { total: 0, categories: {} };
      }
      for (const row of rows) {
        const label = `${row.year}-${row.month}`;
        if (!summary[label]) continue;
        summary[label].total += row.total;
        if (!summary[label].categories[row.category]) {
          summary[label].categories[row.category] = { total: 0, subcategories: {} };
        }
        summary[label].categories[row.category].total += row.total;
        summary[label].categories[row.category].subcategories[row.subcategory] = row.total;
      }
      res.status(200).json(summary);
    }
  );
});

module.exports = router;
