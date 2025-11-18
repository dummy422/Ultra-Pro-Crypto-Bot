// indicators.js
const ta = require('technicalindicators');

/**
 * computeIndicators
 * inputs: closes[], highs[], lows[], volumes[]
 * returns object with many indicators (RSI, MACD, EMA, SMA, BB, ATR, ROC, Stochastic, ADX)
 */
function computeIndicators(closes, highs, lows, volumes) {
  const out = {};

  // RSI 14
  out.rsi = ta.RSI.calculate({ period: 14, values: closes }).slice(-1)[0] || null;

  // MACD
  const macd = ta.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  out.macd = macd.length ? macd[macd.length - 1] : null;

  // EMAs
  out.ema9 = ta.EMA.calculate({ period: 9, values: closes }).slice(-1)[0] || null;
  out.ema20 = ta.EMA.calculate({ period: 20, values: closes }).slice(-1)[0] || null;
  out.ema50 = ta.EMA.calculate({ period: 50, values: closes }).slice(-1)[0] || null;

  // SMA
  out.sma200 = ta.SMA.calculate({ period: 200, values: closes }).slice(-1)[0] || null;

  // Bollinger Bands (20,2)
  const bb = ta.BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  out.bb = bb.length ? bb[bb.length - 1] : null;

  // ATR 14
  const atr = ta.ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  out.atr = atr.length ? atr[atr.length - 1] : null;

  // ROC 9
  const roc = ta.ROC.calculate({ period: 9, values: closes });
  out.roc = roc.length ? roc[roc.length - 1] : null;

  // Stochastic 14,3,3
  const stoch = ta.Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
  out.stochastic = stoch.length ? stoch[stoch.length - 1] : null;

  // ADX 14
  const adx = ta.ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  out.adx = adx.length ? adx[adx.length - 1] : null;

  // OBV
  try {
    out.obv = ta.OnBalanceVolume.calculate({ close: closes, volume: volumes }).slice(-1)[0] || null;
  } catch (e) { out.obv = null; }

  return out;
}

module.exports = { computeIndicators };
