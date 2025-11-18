// binance-utils.js
const axios = require('axios');
const logger = require('./logger');

async function fetchTopSymbols(count = 50) {
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: { vs_currency: 'usd', order: 'market_cap_desc', per_page: Math.min(count,250), page: 1, sparkline: false },
      timeout: 15000
    });
    const syms = res.data
      .map(c => c.symbol?.toUpperCase())
      .filter(Boolean)
      .map(s => s + 'USDT');
    const uniq = [...new Set(syms)];
    logger.info(`Fetched ${uniq.length} top symbols from CoinGecko`);
    return uniq.slice(0, count);
  } catch (err) {
    logger.error('fetchTopSymbols error: ' + (err.message || err));
    return [];
  }
}

async function fetchKlines(symbol, limit = 200, interval = '1m') {
  try {
    const res = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol, interval, limit },
      timeout: 12000
    });
    return res.data.map(k => ({
      t: k[0],
      o: parseFloat(k[1]),
      h: parseFloat(k[2]),
      l: parseFloat(k[3]),
      c: parseFloat(k[4]),
      v: parseFloat(k[5])
    }));
  } catch (err) {
    // symbol might not exist on Binance
    // logger.warn(`fetchKlines ${symbol} failed: ${err.message}`);
    return [];
  }
}

module.exports = { fetchTopSymbols, fetchKlines };
