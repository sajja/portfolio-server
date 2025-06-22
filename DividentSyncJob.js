const DividentExtract = require('./DividentExtract');
const db = require('./db');

class DividentSyncJob {
  static async runJob() {
    try {
        console.log(`[DividentSyncJob] Starting sync at ${new Date().toISOString()}`);
      // Get owned symbols for marking
      const ownedSymbols = await new Promise((resolve, reject) => {
        db.all('SELECT symbol FROM stocks WHERE qtty > 0', [], (err, rows) => {
          if (err) return reject(err);
          resolve(new Set(rows.map(r => r.symbol.toUpperCase())));
        });
      });
      // Fetch all dividends
      const allDividends = await DividentExtract.fetchAllDividends();
      // Insert into DB
      await DividentExtract.insertDividendsToDb(db, allDividends);
      // Optionally log or handle filtered result
      const filtered = DividentExtract.filterAndMarkOwned(allDividends, ownedSymbols);
      console.log(`[DividentSyncJob] Synced ${filtered.length} dividends at ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[DividentSyncJob] Error during sync:', err);
    }
  }

  static startScheduler() {
    // Run immediately at startup
    this.runJob();
    // Then every 12 hours
    setInterval(() => {
      this.runJob();
    }, 12 * 60 * 60 * 1000); // 12 hours in ms
  }
}

module.exports = DividentSyncJob;
