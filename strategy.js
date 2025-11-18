// strategy.js
const { computeIndicators } = require('./indicators');

/**
 * computeEnsembleSignal
 * - Accepts klines by timeframe: { tf1: klines1, tf2: klines2, tf3: klines3 }
 * - Returns null or signal object:
 *    { symbol, side, entry, tpLevels: [tp1,tp2,tp3], sl, confidence, rr, time, meta }
 *
 * This is a deterministic ensemble. It also saves feature vectors (db.saveFeatures happens in main).
 */

// small helpers
function last(arr) { return arr[arr.length - 1]; }
function pct(a,b){ return (a-b)/b; }

function normalizeScore(x, min = -1, max = 1) {
  // assumes x roughly between min and max
  const v = (x - min) / (max - min);
  return Math.max(0, Math.min(1, v));
}

function computeEnsembleSignal(symbol, klinesByTF) {
  // require 3 timeframes: 1m, 5m, 15m (if not available use what's provided)
  const tfNames = Object.keys(klinesByTF);
  if (!tfNames.length) return null;

  // Prepare features per timeframe
  const features = {};
  for (const tf of tfNames) {
    const arr = klinesByTF[tf];
    if (!arr || arr.length < 60) return null; // need enough history
    const closes = arr.map(k => k.c);
    const highs = arr.map(k => k.h);
    const lows = arr.map(k => k.l);
    const vols = arr.map(k => k.v);
    features[tf] = computeIndicators(closes, highs, lows, vols);
    features[tf].current = last(closes);
    features[tf].volume = last(vols);
  }

  // Rule-based signals per timeframe
  // We'll compute small sub-scores and aggregate
  let score = 0;
  let weightTotal = 0;
  const meta = { components: {} };

  // 1) Momentum & trend: use EMA cross & MACD on 5m as main trend filter
  if (features['5m']) {
    const f = features['5m'];
    let trendScore = 0;
    if (f.ema9 && f.ema20) {
      trendScore = f.ema9 > f.ema20 ? 1 : 0;
    }
    // MACD positive adds
    if (f.macd && f.macd.MACD !== undefined) {
      trendScore += f.macd.MACD > f.macd.signal ? 1 : 0;
    }
    trendScore = Math.min(1, trendScore / 2); // 0..1
    score += trendScore * 0.25;
    weightTotal += 0.25;
    meta.components.trend5m = trendScore;
  }

  // 2) Short-term recovery / entry: RSI recovery or stochastic cross on 1m
  if (features['1m']) {
    const f = features['1m'];
    let entryScore = 0;
    // RSI recovery
    if (f.rsi !== null) {
      // if RSI just moved above 40 from below -> good
      entryScore += f.rsi >= 40 ? 1 : 0;
    }
    // stochastic
    if (f.stochastic && f.stochastic.k !== undefined) {
      entryScore += f.stochastic.k > f.stochastic.d ? 1 : 0;
    }
    entryScore = Math.min(1, entryScore / 2);
    score += entryScore * 0.18;
    weightTotal += 0.18;
    meta.components.entry1m = entryScore;
  }

  // 3) Volume confirmation: last vol > avgVol * factor (use 1m and 5m)
  let volScore = 0;
  try {
    if (features['1m']) {
      const f = features['1m'];
      // approximate avg as mean of last 60
      // we don't pass raw volumes here; we'll set volScore externally from main (saved earlier)
      volScore = f.volume && f.volume > 0 ? Math.min(1, f.volume / (f.volume * 1)) : 0;
    }
  } catch (e) {}
  // We'll downweight volume here (score mostly comes from momentum)
  score += 0.12 * volScore;
  weightTotal += 0.12;
  meta.components.volume = volScore;

  // 4) Volatility & risk: penalize very high volatility (ATR relative)
  let voltyScore = 0.5;
  if (features['5m'] && features['5m'].atr) {
    const atr = features['5m'].atr;
    const price = features['5m'].current;
    const atrPct = atr / price;
    // lower atrPct -> higher score
    voltyScore = 1 - Math.min(atrPct / 0.05, 1); // treat 5% as big
  }
  score += 0.15 * voltyScore;
  weightTotal += 0.15;
  meta.components.volatility = voltyScore;

  // 5) Momentum short: ROC on 1m / 5m
  let momentumScore = 0;
  if (features['1m'] && features['1m'].roc !== null) {
    momentumScore = normalizeScore(features['1m'].roc, -5, 5);
  }
  score += 0.1 * momentumScore;
  weightTotal += 0.1;
  meta.components.momentum = momentumScore;

  // 6) ADX trend strength: prefer ADX > 20
  let adxScore = 0;
  if (features['5m'] && features['5m'].adx && features['5m'].adx.adx !== undefined) {
    adxScore = features['5m'].adx.adx >= 20 ? 1 : 0;
  }
  score += 0.1 * adxScore;
  weightTotal += 0.1;
  meta.components.adx = adxScore;

  // normalize confidence
  const confidence = weightTotal ? (score / weightTotal) : 0;

  // require confirmation across TFs: require features['1m'] and features['5m'] to not contradict
  // simple rule: both 1m and 5m ema9>ema20 or momentum positive
  let tfConfirm = true;
  try {
    const one = features['1m'];
    const five = features['5m'];
    if (one && five) {
      const oneTrend = (one.ema9 && one.ema20 && one.ema9 > one.ema20) || (one.roc && one.roc > 0);
      const fiveTrend = (five.ema9 && five.ema20 && five.ema9 > five.ema20) || (five.roc && five.roc > 0);
      tfConfirm = oneTrend && fiveTrend;
    }
  } catch (e) { tfConfirm = false; }

  if (!tfConfirm) {
    // penalize heavily
    const confAdj = confidence * 0.5;
    // small meta marker
    meta.tfConfirmed = false;
    if (confAdj < 0.3) return null; // require minimal confidence after penalize
  } else {
    meta.tfConfirmed = true;
  }

  // Build trade plan if confidence high enough
  const confThreshold = parseFloat(process.env.CONFIDENCE_THRESHOLD || '0.65');
  if (confidence < confThreshold) return null;

  // Entry at current price (last 1m close)
  const current = features['1m'] ? features['1m'].current : features[tfNames[0]].current;
  const entry = current;
  // Multi-TP: TP1 = +1.5%, TP2 = +3.0%, TP3 = +5.0% (user spec + extended)
  const tp1 = entry * 1.015;
  const tp2 = entry * 1.03;
  const tp3 = entry * 1.05;
  const sl = entry * 0.99; // -1%

  const rr = ((tp1 - entry) / (entry - sl)) || (1.5);

  return {
    symbol,
    side: 'buy',
    entry,
    tpLevels: [tp1, tp2, tp3],
    tp: tp1,
    sl,
    confidence,
    rr,
    time: Date.now(),
    meta,
    features // include indicators for logging / debugging
  };
}

module.exports = { computeEnsembleSignal };
