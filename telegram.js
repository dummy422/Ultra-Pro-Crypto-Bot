// telegram.js
const axios = require('axios');
const logger = require('./logger');

const BOT = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = process.env.TELEGRAM_CHAT_ID;
const TG_BASE = `https://api.telegram.org/bot${BOT}`;

function mdEscape(text) {
  return String(text).replace(/([_\*\[\]\(\)~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function send(signal) {
  // signal: object returned from strategy
  if (!signal) return;
  const lines = [];
  lines.push(`🟢 *${mdEscape(signal.symbol)} ${signal.side.toUpperCase()}* 🟢`);
  lines.push('');
  lines.push(`🎯 ENTRY: \\$${signal.entry.toFixed(6)}`);
  lines.push(`✅ TP1: \\$${signal.tpLevels[0].toFixed(6)} (\\+${((signal.tpLevels[0]/signal.entry-1)*100).toFixed(2)}\\%)`);
  lines.push(`✅ TP2: \\$${signal.tpLevels[1].toFixed(6)} (\\+${((signal.tpLevels[1]/signal.entry-1)*100).toFixed(2)}\\%)`);
  lines.push(`✅ TP3: \\$${signal.tpLevels[2].toFixed(6)} (\\+${((signal.tpLevels[2]/signal.entry-1)*100).toFixed(2)}\\%)`);
  lines.push(`❌ SL: \\$${signal.sl.toFixed(6)} (\\-${((signal.entry - signal.sl)/signal.entry*100).toFixed(2)}\\%)`);
  lines.push('');
  lines.push(`⚡ *CONFIDENCE*: ${Math.round(signal.confidence * 100)}\\%`);
  lines.push(`⚖️ R/R: 1:${(signal.rr).toFixed(2)}`);
  lines.push('');
  lines.push(`📊 META: TF confirmed: ${signal.meta.tfConfirmed ? '✅' : '❌'}`);
  lines.push(`⏰ TIME: ${new Date(signal.time).toISOString()}`);
  lines.push('');
  lines.push(`_Note: This is an automated signal. Validate before trading._`);

  const text = lines.join('\n');

  try {
    await axios.post(`${TG_BASE}/sendMessage`, {
      chat_id: CHAT,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    }, { timeout: 10000 });
    logger.info(`Telegram sent for ${signal.symbol}`);
  } catch (err) {
    logger.error('Telegram send error: ' + (err?.response?.data || err.message));
  }
}

module.exports = { send };
