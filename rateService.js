const axios = require('axios');
const cheerio = require('cheerio');

let usdBuyingRateCache = {
  rate: null,
  timestamp: null,
};

const NTB_URL = 'https://www.nationstrust.com/foreign-exchange-rates';

async function getUsdBuyingRate() {
  try {
    const { data } = await axios.get(NTB_URL);
    const $ = cheerio.load(data);
    let rate = null;

    $('table tbody tr').each((index, element) => {
      const currencyCell = $(element).find('td').first();
      if (currencyCell.text().trim() === 'USD') {
        const buyingRateCell = $(element).find('td').eq(1);
        rate = buyingRateCell.text().trim();
        return false; // Exit loop
      }
    });

    if (rate) {
      console.log(`Successfully fetched USD Buying Rate: ${rate}`);
      return parseFloat(rate);
    } else {
      console.log('Could not find the USD buying rate on the page.');
      return null;
    }
  } catch (error) {
    console.error('Error fetching or parsing the page for USD rate:', error.message);
    return null;
  }
}

async function refreshUsdRate() {
  console.log('Attempting to refresh USD buying rate...');
  const rate = await getUsdBuyingRate();
  if (rate !== null) {
    usdBuyingRateCache.rate = rate;
    usdBuyingRateCache.timestamp = new Date().toISOString();
    console.log('USD buying rate cache updated.');
  } else {
    console.log('Failed to refresh USD buying rate. Keeping stale data if available.');
  }
}

function scheduleDailyRateRefresh() {
  const now = new Date();
  const nextRefresh = new Date();

  nextRefresh.setHours(9, 0, 0, 0);

  if (now > nextRefresh) {
    nextRefresh.setDate(nextRefresh.getDate() + 1);
  }

  const delay = nextRefresh.getTime() - now.getTime();

  console.log(`Next USD rate refresh scheduled for: ${nextRefresh.toLocaleString()}`);

  setTimeout(() => {
    console.log('Executing scheduled 9 AM USD rate refresh.');
    refreshUsdRate();
    setInterval(refreshUsdRate, 24 * 60 * 60 * 1000);
  }, delay);
}

module.exports = {
  usdBuyingRateCache,
  refreshUsdRate,
  scheduleDailyRateRefresh,
};
