const axios = require('axios');

class DividentExtract {
  static async fetchAllDividends() {
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
    return response.data?.Announcement?.['CASH DIVIDEND'] || [];
  }

  static filterAndMarkOwned(dividends, ownedSymbols) {
    return dividends.map(d => ({
      symbol: d.symbol,
      xd: d.xd,
      payment: d.payment,
      remarks: d.remarks,
      div_ps: d.votingDivPerShare,
      own: ownedSymbols.has((d.symbol || '').toUpperCase())
    }));
  }

  static async insertDividendsToDb(db, allDividends) {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM dividend', [], function (delErr) {
        if (delErr) return reject(delErr);
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
          db.run('COMMIT', (commitErr) => {
            if (commitErr) return reject(commitErr);
            resolve();
          });
        });
      });
    });
  }
}

module.exports = DividentExtract;
