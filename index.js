// index.js
require('dotenv').config();
const logger = require('./logger');
const NodeCache = require('node-cache');
const { fetchTopSymbols, fetchKlines } = require('./binance-utils');
const { computeEnsembleSignal } = require('./strategy');
const tg = require('./telegram');
const db = require('./db');
const wsClient = require('./websocket');

const POLL_INTERVAL_SEC = parseInt(process.env.POLL_INTERVAL_SEC || '120', 10);
const COOLDOWN_MIN = parseInt(process.env.COOLDOWN_MIN || '10', 10);
const SYMBOL_COUNT = parseInt(process.env.SYMBOL_COUNT || '50', 10);
const USE_WS = (process.env.USE_WEBSOCKET || 'true') === 'true';
const cache = new NodeCache();

db.init();

function isCoolingDown(sym) {
  const key = `cd_${sym}`;
  const ts = cache.get(key);
  return ts && Date.now() < ts;
}
function startCooldown(sym) {
  const key = `cd_${sym}`;
  cache.set(key, Date.now() + COOLDOWN_MIN * 60 * 1000, COOLDOWN_MIN * 60);
}

async function processSymbol(symbol) {
  try {
    if (isCoolingDown(symbol)) return;
    // fetch klines for 1m,5m,15m
    const k1 = await fetchKlines(symbol, 200, '1m');
    const k5 = await fetchKlines(symbol, 400, '5m');
    const k15 = await fetchKlines(symbol, 600, '15m');
    if (!k1.length || !k5.length) return;

    const klines = { '1m': k1, '5m': k5, '15m': k15.length ? k15 : k5 };

    // save features for future ML
    // features saved inside strategy return object (which includes features)
    const signal = computeEnsembleSignal(symbol, klines);
    if (!signal) return;

    // Save features and signal into DB
    try {
      db.saveFeatures(symbol, signal.time, signal.features);
      db.saveSignal({
        symbol: signal.symbol,
        side: signal.side,
        entry: signal.entry,
        tp: signal.tp,
        sl: signal.sl,
        confidence: signal.confidence,
        rr: signal.rr,
        time: signal.time
      });
    } catch (e) {
      logger.error('DB save error: ' + e.message);
    }

    // Send Telegram
    await tg.send(signal);

    // Start cooldown
    startCooldown(symbol);
  } catch (err) {
    logger.error(`processSymbol ${symbol} error: ${err.message}`);
  }
}

async function pollAll() {
  logger.info('Poll cycle started');
  const symbols = await fetchTopSymbols(SYMBOL_COUNT);
  if (!symbols.length) {
    logger.warn('No symbols, skipping cycle');
    return;
  }
  // process in small batches
  const batchSize = 6;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    await Promise.all(batch.map(s => processSymbol(s)));
    await sleep(900); // avoid rate-limits
  }
  logger.info('Poll cycle completed');
}

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

// health server
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('OK - Ultra Pro Crypto Bot running'));
app.get('/status', (req, res) => {
  res.json({ uptime: process.uptime(), nextPollInSec: POLL_INTERVAL_SEC, cooldowns: cache.keys().length });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Health server listening on ${PORT}`));

// start websocket (optional)
if (USE_WS) {
  // We'll subscribe to miniTicker for top symbols to get fast price updates (non-critical)
  (async () => {
    const top = await fetchTopSymbols(SYMBOL_COUNT);
    if (top.length) {
      wsClient.subscribeMiniTicker(top.slice(0, 80));
      // basic handler: simply log price changes (you can extend)
      top.forEach(s => {
        wsClient.addHandler(s, (data) => {
          // data includes c = close price string, v = volume
          // we don't need to use ws in current flow; this is optional
          // logger.debug(`WS ${s} price ${data.c}`);
        });
      });
    }
  })();
}

// initial immediate run then interval
(async () => {
  logger.info('Ultra Pro Bot starting');
  await pollAll();
  setInterval(pollAll, POLL_INTERVAL_SEC * 1000);
})();
