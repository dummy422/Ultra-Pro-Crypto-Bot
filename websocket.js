// websocket.js
const WebSocket = require('ws');
const logger = require('./logger');

let ws = null;
let handlers = {};

function subscribeMiniTicker(symbols = []) {
  // builds combined stream URL for miniTicker: symbol@miniTicker
  if (!symbols || symbols.length === 0) return;
  // Binance requires lowercase symbol names in stream
  const streams = symbols.map(s => s.toLowerCase() + '@miniTicker').join('/');
  const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;
  ws = new WebSocket(url);

  ws.on('open', () => logger.info('Binance WS connected'));
  ws.on('close', () => {
    logger.warn('Binance WS closed - reconnecting in 5s');
    setTimeout(() => subscribeMiniTicker(symbols), 5000);
  });
  ws.on('error', (err) => logger.error('Binance WS err: ' + err.message));
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg && msg.data && msg.stream) {
        // msg.data contains miniTicker fields
        const s = msg.data.s;
        const handler = handlers[s];
        if (handler) handler(msg.data);
      }
    } catch (e) {
      // ignore parse errors
    }
  });
}

function addHandler(symbol, cb) {
  handlers[symbol] = cb;
}

module.exports = { subscribeMiniTicker, addHandler };
