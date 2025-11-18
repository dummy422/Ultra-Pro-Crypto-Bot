// db.js
const Database = require('better-sqlite3');
const logger = require('./logger');
const path = process.env.DB_PATH || './signals.db';
const db = new Database(path);

function init() {
  db.prepare(`CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    side TEXT,
    entry REAL,
    tp REAL,
    sl REAL,
    confidence REAL,
    rr REAL,
    payload TEXT,
    timestamp INTEGER
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT,
    timestamp INTEGER,
    feature_json TEXT
  )`).run();

  logger.info('DB initialized at ' + path);
}

function saveSignal(obj) {
  const stmt = db.prepare(`INSERT INTO signals (symbol, side, entry, tp, sl, confidence, rr, payload, timestamp)
    VALUES (@symbol,@side,@entry,@tp,@sl,@confidence,@rr,@payload,@timestamp)`);
  stmt.run({
    symbol: obj.symbol,
    side: obj.side,
    entry: obj.entry,
    tp: obj.tp,
    sl: obj.sl,
    confidence: obj.confidence,
    rr: obj.rr,
    payload: JSON.stringify(obj),
    timestamp: obj.time || Date.now()
  });
}

function saveFeatures(symbol, timestamp, featureObj) {
  const stmt = db.prepare(`INSERT INTO features (symbol, timestamp, feature_json) VALUES (?, ?, ?)`);
  stmt.run(symbol, timestamp, JSON.stringify(featureObj));
}

module.exports = { init, saveSignal, saveFeatures, db };
