# Ultra Pro 24/7 Crypto Signal Bot

Educational production-style starter implementing the "Ultra Pro" feature set:
- Multi-timeframe confirmation (1m/5m/15m)
- 12+ technical indicators (RSI, MACD, EMA, SMA, ATR, ADX, Stochastic, Bollinger)
- Multi TP/SL (TP1/TP2/TP3), RR calculation
- Confidence scoring (ensemble)
- Feature & signal persistence in SQLite for future ML
- Optional Binance websocket for low-latency price streaming
- Telegram alerts with professional formatting
- Health endpoints

## Quick start (local)
1. Copy files to a folder
2. `cp .env.example .env` and fill values (or use Render env vars)
3. `npm install`
4. `npm start` (or `npm run dev` for development)

## Deploy to Render
1. Push repo to GitHub
2. On Render, create a **Worker** or **Web Service**:
   - Environment: Node
   - Build command: `npm install`
   - Start command: `npm start`
3. Add environment variables in Render settings (see `.env.example`)
4. Deploy

## Important notes & next steps
- This is a starter; **do not** trade real money without backtesting and manual review.
- Add authentication & HTTPS if you extend the dashboard.
- To turn this into an auto-execution bot: implement authenticated exchange APIs and rigorous risk controls.
- If you want real ML, you can export `features` table and train a model offline; then implement a model loader to score live inputs.

# Ultra-Pro-Crypto-Bot
